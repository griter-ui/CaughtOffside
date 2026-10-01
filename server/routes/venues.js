// Ground discovery, computed availability and owner-only creation, at /api/venues.
// Venue stores the listing; Booking stores reservations used to build the slot grid.
const express = require('express');
const router = express.Router();
const Venue = require('../models/Venue');
const Booking = require('../models/Booking');
const { authenticateToken } = require('../middleware/auth');
const mongoose = require('mongoose');
const { definitions, getVenueFormats, validateFormats, legacySportType } = require('../utils/venueFormats');

const { DEFAULT_SLOTS, isValidDate, isSlotExpired } = require('../utils/slots');

// GET /api/venues - Browse Venues with Search & Filters
// 1. Trigger: Venues Page load or search/filter bar submission (VenuesPage.jsx) calling GET /api/venues
// 2. Input: req.params: none | req.query: { sportType, area, maxPrice, search } | req.body: none | req.user: none
// 3. Permission: None (Public endpoint)
// 4. Rules: Parses maxPrice to Number. Missing rules: regex search pattern escaping, pagination limits.
// 5. Storage: Venue model (find query sorted by rating descending).
// 6. Output: 200 OK ({ venues: [...] }); 500 Server Error. No socket events. Browser renders turf grid cards.
router.get('/', async (req, res) => {
  try {
    const { sportType, area, maxPrice, search } = req.query;

    // req.query contains URL filters, e.g. ?maxPrice=1000. Build one MongoDB filter:
    // $lte means <=, $or accepts any listed condition, regex 'i' ignores letter case.
    let query = {};

    if (sportType && sportType !== 'All') {
      const format = definitions.find(item => item.value === sportType || item.legacySportType === sportType);
      if (format) {
        // Keep the format predicate separate from the search $or below.
        query.$and = [{ $or: [
          { formats: format.value },
          { formats: { $exists: false }, sportType: format.legacySportType }
        ] }];
      } else if (sportType === 'Box Cricket & Football') query.sportType = sportType;
      else return res.status(400).json({ message: 'Unknown football format.' });
    }
    if (area && area !== 'All') {
      query.area = { $regex: area, $options: 'i' };
    }
    if (maxPrice) {
      query.pricePerHour = { $lte: Number(maxPrice) };
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // -1 sorts descending. This endpoint currently has no pagination, and search
    // input is interpreted as a regex pattern rather than escaped literal text.
    const venues = await Venue.find(query).sort({ rating: -1 });
    res.json({ venues });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching venues.', error: error.message });
  }
});

// GET /api/venues/:id - Get Venue Details
// 1. Trigger: Selecting a venue card or opening Venue details modal calling GET /api/venues/:id
// 2. Input: req.params: { id } (Venue ID) | req.query: none | req.body: none | req.user: none
// 3. Permission: None (Public endpoint)
// 4. Rules: Mongoose validates ObjectId format. Missing rules: none.
// 5. Storage: Venue model (findById).
// 6. Output: 200 OK ({ venue }); 404 Not Found; 500 Server Error. No socket events. Browser displays full venue details.
router.get('/:id', async (req, res) => {
  try {
    const venue = await Venue.findById(req.params.id);
    if (!venue) {
      return res.status(404).json({ message: 'Venue not found.' });
    }
    res.json({ venue });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching venue details.' });
  }
});

// GET /api/venues/:id/slots - Venue Slot Availability Grid
// 1. Trigger: Date picker change in Venue Modal or Slot Picker (SlotPicker.jsx) calling GET /api/venues/:id/slots?date=YYYY-MM-DD
// 2. Input: req.params: { id } (Venue ID) | req.query: { date } (YYYY-MM-DD format) | req.body: none | req.user: none
// 3. Permission: None (Public endpoint)
// 4. Rules: Validates date string shape & calendar validity via isValidDate(date). Computes expiry via isSlotExpired(date, timeSlot). Missing rules: checking whether venue ID exists in DB prior to query.
// 5. Storage: Booking model (queries reservations by venueId and date). Cross-referenced against DEFAULT_SLOTS.
// 6. Output: 200 OK ({ date, slots: [{ timeSlot, status: 'available'|'booked'|'expired' }] }); 400 Bad Request (invalid date); 500 Server Error. No socket events. Browser updates slot availability picker.
router.get('/:id/slots', async (req, res) => {
  try {
    const { date } = req.query;
    if (!isValidDate(date)) {
      return res.status(400).json({ message: 'A valid date in YYYY-MM-DD format is required.' });
    }

    // Availability is derived on each read, not stored as a separate Slot collection.
    // A date + venue lookup identifies which of the predefined slots are reserved.
    const bookings = await Booking.find({ venueId: req.params.id, date });
    const bookedTimeSlots = bookings.map(b => b.timeSlot);

    const slotGrid = DEFAULT_SLOTS.map(timeSlot => {
      const isBooked = bookedTimeSlots.includes(timeSlot);
      const expired = isSlotExpired(date, timeSlot);

      let status = 'available';
      if (isBooked) status = 'booked';
      if (expired) status = 'expired'; // Expiry takes display priority over booked.

      return { timeSlot, status };
    });

    res.json({ date, slots: slotGrid });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching slot availability.', error: error.message });
  }
});

// POST /api/venues - Turf Owner Venue Listing Creation
// 1. Trigger: Turf Owner submitting "Add Venue" form (AddVenueModal.jsx) via POST /api/venues
// 2. Input: req.params: none | req.query: none | req.body: { name, location, area, pricePerHour, sportType, description, amenities, photos } | req.user: { userId, role, ... } (verified identity)
// 3. Permission: Login required (authenticateToken), Owner role required (req.user.role === 'owner').
// 4. Rules: Validates presence of name, location, positive numeric pricePerHour. Derives ownerId from req.user.userId. Missing rules: verification of physical ground ownership, URL structure validation for photos.
// 5. Storage: Venue model (creates & saves new listing).
// 6. Output: 201 Created ({ message, venue }); 400 Bad Request (invalid inputs); 403 Forbidden (non-owner user); 500 Server Error. Emits socket broadcast venue_created. Browser updates owner list and live broadcasts new turf to all active browsers.
router.post('/', authenticateToken, async (req, res) => {
  try {
    // Middleware supplies the current database-backed role, not a body-supplied role.
    if (req.user.role !== 'owner') return res.status(403).json({ message: 'Sign in with a turf owner account to list a venue.' });
    const { name, location, area, pricePerHour, sportType, description, amenities, photos } = req.body;
    const formats = validateFormats(req.body.formats === undefined
      ? getVenueFormats({ sportType: sportType ?? '5-a-side' }) : req.body.formats);

    if (!name || !location || !Number.isFinite(Number(pricePerHour)) || Number(pricePerHour) <= 0) {
      return res.status(400).json({ message: 'Name, location, and pricePerHour are required.' });
    }

    // Derive ownerId from authentication so callers cannot create another user's listing.
    const newVenue = new Venue({
      name,
      location,
      area: area || location.split(',')[0],
      pricePerHour: Number(pricePerHour),
      sportType: legacySportType(formats[0]),
      formats,
      description: description || '',
      amenities: amenities || [],
      photos: photos || ['https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800'],
      ownerId: req.user.userId
    });

    await newVenue.save();

    // Broadcast new venue creation live via socket
    const io = req.app.get('io');
    if (io) {
      io.emit('venue_created', newVenue);
    }

    res.status(201).json({ message: 'Venue created successfully!', venue: newVenue });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.status ? error.message : 'Error creating venue.' });
  }
});

// Owners can update existing turfs too. Only this allowlisted field is editable;
// ownership, pricing, and existing booking format snapshots cannot be overwritten.
router.patch('/:id/formats', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'owner') return res.status(403).json({ message: 'Only turf owners can edit formats.' });
    if (!mongoose.isObjectIdOrHexString(req.params.id)) return res.status(400).json({ message: 'Invalid venue ID.' });
    const formats = validateFormats(req.body.formats);
    const venue = await Venue.findById(req.params.id);
    if (!venue) return res.status(404).json({ message: 'Venue not found.' });
    if (String(venue.ownerId) !== req.user.userId) return res.status(403).json({ message: 'You can only edit your own turf.' });
    venue.formats = formats;
    venue.sportType = legacySportType(formats[0]);
    await venue.save();
    req.app.get('io')?.emit('venue_updated', venue);
    res.json({ message: 'Turf formats updated.', venue });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.status ? error.message : 'Unable to update turf formats.' });
  }
});

module.exports = router;
