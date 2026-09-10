const express = require('express');
const router = express.Router();
const User = require('../models/User');

// GET /api/players (Filterable Player Directory)
router.get('/', async (req, res) => {
  try {
    const { position, experienceLevel, preferredFoot, minPace, minPassing, minShooting, sortBy, search } = req.query;

    let query = { role: 'player' };

    if (position && position !== 'All') {
      query.position = position;
    }
    if (experienceLevel && experienceLevel !== 'All') {
      query.experienceLevel = experienceLevel;
    }
    if (preferredFoot && preferredFoot !== 'All') {
      query.preferredFoot = preferredFoot;
    }
    if (minPace) {
      query['skills.pace'] = { $gte: Number(minPace) };
    }
    if (minPassing) {
      query['skills.passing'] = { $gte: Number(minPassing) };
    }
    if (minShooting) {
      query['skills.shooting'] = { $gte: Number(minShooting) };
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
        { bio: { $regex: search, $options: 'i' } }
      ];
    }

    let sortOption = { 'stats.matchesPlayed': -1 }; // Default sort by matches played
    if (sortBy === 'experience') {
      sortOption = { experienceLevel: -1 };
    } else if (sortBy === 'name') {
      sortOption = { name: 1 };
    } else if (sortBy === 'motm') {
      sortOption = { 'stats.motmCount': -1 };
    }

    const players = await User.find(query).select('-password -email').sort(sortOption);
    res.json({ players });
  } catch (error) {
    console.error('Fetch players error:', error);
    res.status(500).json({ message: 'Error fetching player directory.', error: error.message });
  }
});

// GET /api/players/:id (Football Passport Card details)
router.get('/:id', async (req, res) => {
  try {
    const player = await User.findById(req.params.id).select('-password -email');
    if (!player) {
      return res.status(404).json({ message: 'Player passport not found.' });
    }
    res.json({ player });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching player passport.' });
  }
});

module.exports = router;
