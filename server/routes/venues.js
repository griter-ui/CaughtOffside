const express = require('express');
const router = express.Router();
const Venue = require('../models/Venue');
const Booking = require('../models/Booking');
const { authenticateToken } = require('../middleware/auth');

// Helper to check if a slot has passed/expired in real time
function isSlotExpired(dateStr, timeSlotStr) {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  if (dateStr < todayStr) return true;
  if (dateStr > todayStr) return false;

  // Date is today! Check time component.
  const parts = timeSlotStr.split(' - ');
  if (parts.length < 2) return false;
  const endTimeStr = parts[1].trim(); // e.g. "07:00 AM" or "05:00 PM"

  const match = endTimeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return false;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const modifier = match[3].toUpperCase();

  if (modifier === 'PM' && hours < 12) hours += 12;
  if (modifier === 'AM' && hours === 12) hours = 0;

  const slotEndTime = new Date();
  slotEndTime.setHours(hours, minutes, 0, 0);

  return now >= slotEndTime;
}

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
    if (!date) {
      return res.status(400).json({ message: 'Date parameter is required.' });
    }

    // Default slot times for turfs
    const defaultSlots = [
      '06:00 AM - 07:00 AM',
      '07:00 AM - 08:00 AM',
      '08:00 AM - 09:00 AM',
      '09:00 AM - 10:00 AM',
      '10:00 AM - 11:00 AM',
      '04:00 PM - 05:00 PM',
      '05:00 PM - 06:00 PM',
      '06:00 PM - 07:00 PM',
      '07:00 PM - 08:00 PM',
      '08:00 PM - 09:00 PM',
      '09:00 PM - 10:00 PM',
      '10:00 PM - 11:00 PM'
    ];

    const bookings = await Booking.find({ venueId: req.params.id, date, paymentStatus: 'paid' });
    const bookedTimeSlots = bookings.map(b => b.timeSlot);

    const slotGrid = defaultSlots.map(timeSlot => {
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
    const { name, location, area, pricePerHour, sportType, description, amenities, photos } = req.body;

    if (!name || !location || !pricePerHour) {
      return res.status(400).json({ message: 'Name, location, and pricePerHour are required.' });
    }

    const newVenue = new Venue({
      name,
      location,
      area: area || location.split(',')[0],
      pricePerHour: Number(pricePerHour),
      sportType: sportType || '5-a-side',
      description: description || 'High performance turf with floodlights and spectator seating.',
      amenities: amenities || ['LED Floodlights', 'Bibs Provided', 'Changing Rooms', 'Drinking Water', 'Free Parking'],
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
