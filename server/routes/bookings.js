// Reservations at /api/bookings: validate -> identify venue -> save -> notify -> reply.
// Read alongside models/Booking.js (unique index) and utils/slots.js (India-time rules).
const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Venue = require('../models/Venue');
const { cancelBooking, sendBookingError } = require('../services/matchBookings');
const { authenticateToken } = require('../middleware/auth');
const { DEFAULT_SLOTS, isValidDate, isSlotExpired } = require('../utils/slots');
const { selectBookingFormat } = require('../utils/venueFormats');

// POST /api/bookings - Conflict-Safe Turf Reservation Creation
// 1. Trigger: Slot selection & "Confirm Pay at Venue Booking" button (BookingModal.jsx) via POST /api/bookings
// 2. Input: req.body: { venueId, date, timeSlot, format }; verified req.user supplies identity.
// 3. Permission: Login required (authenticateToken).
// 4. Rules: Validates presence of venueId/date/timeSlot; validates date via isValidDate(); checks slot in DEFAULT_SLOTS; verifies slot is not expired (isSlotExpired). Early duplicate check via Booking.findOne. Missing rules: max active bookings per player cap.
// 5. Storage: Booking model (new record saved). Database enforces compound unique index on { venueId, date, timeSlot } preventing race conditions.
// 6. Output: 201 Created ({ message, booking: populatedBooking }); 400 Bad Request; 404 Not Found (venue missing); 409 Conflict (slot already taken or E11000 index race collision); 500 Server Error. Emits socket event slot_booked ({ venueId, date, timeSlot }). Browser closes modal, adds booking to My Bookings, live socket marks slot booked on all active clients.
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { venueId, date, timeSlot } = req.body;

    if (!venueId || !date || !timeSlot) {
      return res.status(400).json({ message: 'Venue, date, and time slot are required.' });
    }

    // Revalidate at write time: a slot displayed earlier may now have started.
    if (!isValidDate(date) || !DEFAULT_SLOTS.includes(timeSlot) || isSlotExpired(date, timeSlot)) {
      return res.status(400).json({ message: 'Choose a valid, upcoming slot (India time).' });
    }

    const venue = await Venue.findById(venueId);
    if (!venue) {
      return res.status(404).json({ message: 'Venue not found.' });
    }
    const format = selectBookingFormat(venue, req.body.format);

    // Friendly early conflict check. This alone is not race-safe: overlapping
    // requests can both pass it. MongoDB's unique slot index is the final guard.
    const existing = await Booking.findOne({ venueId, date, timeSlot });
    if (existing) {
      return res.status(409).json({ message: 'Slot has already been booked by another player. Please select a different time slot.' });
    }

    // Human-readable reference, not a payment transaction or an idempotency key.
    const receiptId = 'REC-' + Math.random().toString(36).substring(2, 9).toUpperCase();

    // Trust server data for identity and price, not userId/price sent by a browser.
    // This saves a pay-at-venue reservation; no payment gateway is called.
    const booking = new Booking({
      venueId,
      userId: req.user.userId,
      date,
      timeSlot,
      format,
      price: venue.pricePerHour,
      paymentStatus: 'pay_at_venue',
      receiptId
    });

    await booking.save();

    // populate replaces a reference with selected venue details in this response;
    // it does not duplicate all those details into the stored booking document.
    const populatedBooking = await Booking.findById(booking._id).populate('venueId', 'name location sportType formats photos');

    // Broadcast only after a successful save. MongoDB is durable; the socket event
    // is a live UI hint and is not a replacement for refetching after a reconnect.
    const io = req.app.get('io');
    if (io) {
      io.emit('slot_booked', { venueId, date, timeSlot });
    }

    res.status(201).json({
      message: 'Reservation confirmed. Payment is arranged directly with the venue.',
      booking: populatedBooking
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    // A concurrent insert losing the unique-index race reaches this branch.
    // Any duplicate key is mapped here, including a rare receiptId collision.
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Slot locking conflict! This slot was just taken by another user.' });
    }
    console.error('Booking error:', error);
    res.status(500).json({ message: 'Error processing booking.', error: error.message });
  }
});

// GET /api/bookings/my-bookings - Authenticated Player Booking History
// 1. Trigger: Player opening "My Bookings" page (MyBookingsPage.jsx) calling GET /api/bookings/my-bookings
// 2. Input: req.params: none | req.query: none | req.body: none | req.user: { userId, ... } (verified caller)
// 3. Permission: Login required (authenticateToken). Scoped strictly to caller's userId.
// 4. Rules: Filters by userId: req.user.userId. Missing rules: pagination / limits.
// 5. Storage: Booking model (find populated with venue details, sorted by createdAt descending).
// 6. Output: 200 OK ({ bookings: [...] }); 401 Unauthorized; 500 Server Error. No socket events. Browser renders cards/list of player's booked slots.
router.get('/my-bookings', authenticateToken, async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.user.userId })
      .populate('venueId', 'name location sportType formats pricePerHour photos')
      .sort({ createdAt: -1 });

    res.json({ bookings });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching bookings.', error: error.message });
  }
});

// GET /api/bookings/owner - Turf Owner Reservations Dashboard
// 1. Trigger: Turf Owner navigating to Owner Dashboard (OwnerDashboard.jsx) calling GET /api/bookings/owner
// 2. Input: req.params: none | req.query: none | req.body: none | req.user: { userId, ... } (verified caller)
// 3. Permission: Login required (authenticateToken). Scoped to venues owned by req.user.userId.
// 4. Rules: Two-stage lookup: finds venues where ownerId === req.user.userId, then queries bookings matching those venueIds. Missing rules: explicit role check (req.user.role === 'owner').
// 5. Storage: Venue model (lookup venue IDs) & Booking model (queries matching bookings, populated with player & venue details).
// 6. Output: 200 OK ({ bookings: [...] }); 401 Unauthorized; 500 Server Error. No socket events. Browser renders owner reservation table with player details.
router.get('/owner', authenticateToken, async (req, res) => {
  try {
    // Two-stage lookup: this user's venues -> bookings whose venueId is in that set.
    // The read is scoped by actual ownership rather than a body-supplied owner ID.
    const ownerVenues = await Venue.find({ ownerId: req.user.userId });
    const venueIds = ownerVenues.map(v => v._id);

    const bookings = await Booking.find({ venueId: { $in: venueIds } })
      .populate('venueId', 'name location')
      .populate('userId', 'name email position location')
      .sort({ createdAt: -1 });

    res.json({ bookings });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching owner bookings.' });
  }
});

// Both player and venue-owner cancellation use the same transaction. Withdrawing
// a reservation also cancels its linked match, so joining cannot outlive the turf.
function cancellationHandler(asOwner) {
  return async (req, res) => {
    try {
      const booking = await cancelBooking(req.params.id, req.user.userId, asOwner);
      const io = req.app.get('io');
      io?.emit('slot_cancelled', { venueId: String(booking.venueId), date: booking.date, timeSlot: booking.timeSlot });
      io?.emit('match_updated');
      res.json({ message: 'Reservation cancelled, linked match withdrawn, and slot freed.' });
    } catch (error) {
      sendBookingError(res, error);
    }
  };
}
router.delete('/owner/:id', authenticateToken, cancellationHandler(true));
router.delete('/:id', authenticateToken, cancellationHandler(false));

module.exports = router;
