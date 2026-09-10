const express = require('express');
const router = express.Router();
const Venue = require('../models/Venue');
const Booking = require('../models/Booking');
const { authenticateToken } = require('../middleware/auth');

const { DEFAULT_SLOTS, isValidDate, isSlotExpired } = require('../utils/slots');

// GET /api/venues (Browse Venues with Filters)
router.get('/', async (req, res) => {
  try {
    const { sportType, area, maxPrice, search } = req.query;

    let query = {};

    if (sportType && sportType !== 'All') {
      query.sportType = sportType;
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

    const venues = await Venue.find(query).sort({ rating: -1 });
    res.json({ venues });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching venues.', error: error.message });
  }
});

// GET /api/venues/:id
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

// GET /api/venues/:id/slots?date=YYYY-MM-DD
router.get('/:id/slots', async (req, res) => {
  try {
    const { date } = req.query;
    if (!isValidDate(date)) {
      return res.status(400).json({ message: 'A valid date in YYYY-MM-DD format is required.' });
    }

    const bookings = await Booking.find({ venueId: req.params.id, date });
    const bookedTimeSlots = bookings.map(b => b.timeSlot);

    const slotGrid = DEFAULT_SLOTS.map(timeSlot => {
      const isBooked = bookedTimeSlots.includes(timeSlot);
      const expired = isSlotExpired(date, timeSlot);

      let status = 'available';
      if (isBooked) status = 'booked';
      if (expired) status = 'expired';

      return { timeSlot, status };
    });

    res.json({ date, slots: slotGrid });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching slot availability.', error: error.message });
  }
});

// POST /api/venues (Owner Listing Creation)
router.post('/', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'owner') return res.status(403).json({ message: 'Sign in with a turf owner account to list a venue.' });
    const { name, location, area, pricePerHour, sportType, description, amenities, photos } = req.body;

    if (!name || !location || !Number.isFinite(Number(pricePerHour)) || Number(pricePerHour) <= 0) {
      return res.status(400).json({ message: 'Name, location, and pricePerHour are required.' });
    }

    const newVenue = new Venue({
      name,
      location,
      area: area || location.split(',')[0],
      pricePerHour: Number(pricePerHour),
      sportType: sportType || '5-a-side',
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
    res.status(500).json({ message: 'Error creating venue.', error: error.message });
  }
});

module.exports = router;
