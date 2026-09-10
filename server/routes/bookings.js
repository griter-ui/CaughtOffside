const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Venue = require('../models/Venue');
const { authenticateToken } = require('../middleware/auth');
const { DEFAULT_SLOTS, isValidDate, isSlotExpired } = require('../utils/slots');

// POST /api/bookings (Conflict-Safe Booking Creation)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { venueId, date, timeSlot } = req.body;

    if (!venueId || !date || !timeSlot) {
      return res.status(400).json({ message: 'Venue, date, and time slot are required.' });
    }

    if (!isValidDate(date) || !DEFAULT_SLOTS.includes(timeSlot) || isSlotExpired(date, timeSlot)) {
      return res.status(400).json({ message: 'Choose a valid, upcoming slot (India time).' });
    }

    const venue = await Venue.findById(venueId);
    if (!venue) {
      return res.status(404).json({ message: 'Venue not found.' });
    }

    // Check conflict
    const existing = await Booking.findOne({ venueId, date, timeSlot });
    if (existing) {
      return res.status(409).json({ message: 'Slot has already been booked by another player. Please select a different time slot.' });
    }

    const receiptId = 'REC-' + Math.random().toString(36).substring(2, 9).toUpperCase();

    const booking = new Booking({
      venueId,
      userId: req.user.userId,
      date,
      timeSlot,
      price: venue.pricePerHour,
      paymentStatus: 'pay_at_venue',
      receiptId
    });

    await booking.save();

    // Populate venue details for receipt response
    const populatedBooking = await Booking.findById(booking._id).populate('venueId', 'name location sportType photos');

    // Notify socket clients in socket handler
    const io = req.app.get('io');
    if (io) {
      io.emit('slot_booked', { venueId, date, timeSlot });
    }

    res.status(201).json({
      message: 'Reservation confirmed. Payment is arranged directly with the venue.',
      booking: populatedBooking
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Slot locking conflict! This slot was just taken by another user.' });
    }
    console.error('Booking error:', error);
    res.status(500).json({ message: 'Error processing booking.', error: error.message });
  }
});

// GET /api/bookings/my-bookings (User's Bookings)
router.get('/my-bookings', authenticateToken, async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.user.userId })
      .populate('venueId', 'name location sportType pricePerHour photos')
      .sort({ createdAt: -1 });

    res.json({ bookings });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching bookings.', error: error.message });
  }
});

// GET /api/bookings/owner (Venue Owner Bookings)
router.get('/owner', authenticateToken, async (req, res) => {
  try {
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

// DELETE /api/bookings/owner/:id (Turf Owner cancels/removes a booking)
router.delete('/owner/:id', authenticateToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('venueId');
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    // Check if current user is owner of the venue (or if ownerId matches)
    const venueOwnerId = (booking.venueId?.ownerId?._id || booking.venueId?.ownerId || '').toString();
    const reqUserId = (req.user.userId || '').toString();

    if (!venueOwnerId || venueOwnerId !== reqUserId) {
      return res.status(403).json({ message: 'Unauthorized. Only the turf owner can remove this booking.' });
    }

    const venueObjId = booking.venueId?._id || booking.venueId;
    const { date, timeSlot } = booking;

    await Booking.findByIdAndDelete(req.params.id);

    // Real-time socket notification to free the slot for everyone
    const io = req.app.get('io');
    if (io) {
      io.emit('slot_cancelled', { venueId: venueObjId, date, timeSlot });
    }

    res.json({ message: 'Booking removed by turf owner. Slot has been freed!' });
  } catch (error) {
    console.error('Error removing booking by owner:', error);
    res.status(500).json({ message: 'Error removing booking.', error: error.message });
  }
});

// DELETE /api/bookings/:id (User cancels their own booking)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    const bookingUserId = (booking.userId._id || booking.userId || '').toString();
    const reqUserId = (req.user.userId || '').toString();

    if (bookingUserId !== reqUserId) {
      return res.status(403).json({ message: 'Unauthorized to cancel this booking.' });
    }

    const { venueId, date, timeSlot } = booking;
    await Booking.findByIdAndDelete(req.params.id);

    // Real-time socket notification to free the slot for everyone
    const io = req.app.get('io');
    if (io) {
      io.emit('slot_cancelled', { venueId, date, timeSlot });
    }

    res.json({ message: 'Reservation cancelled and slot freed.' });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({ message: 'Error cancelling booking.', error: error.message });
  }
});

module.exports = router;
