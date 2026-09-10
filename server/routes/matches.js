const express = require('express');
const router = express.Router();
const Match = require('../models/Match');
const MatchComment = require('../models/MatchComment');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

// GET /api/matches (Browse Open Matches)
router.get('/', async (req, res) => {
  try {
    const { format, status } = req.query;

    let query = {};
    if (format && format !== 'All') {
      query.format = format;
    }
    if (status && status !== 'All') {
      query.status = status;
    } else {
      query.status = { $in: ['open', 'full'] };
    }

    const matches = await Match.find(query)
      .populate('hostId', 'name position avatarUrl skills stats location')
      .populate('venueId', 'name location sportType pricePerHour photos')
      .populate('acceptedPlayers', 'name position avatarUrl skills stats')
      .sort({ createdAt: -1 });

    res.json({ matches });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching open matches.', error: error.message });
  }
});

// GET /api/matches/my-matches
router.get('/my-matches', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const hostedMatches = await Match.find({ hostId: userId })
      .populate('venueId', 'name location sportType')
      .populate('acceptedPlayers', 'name position avatarUrl skills stats email location')
      .populate('pendingRequests', 'name position avatarUrl skills stats email location')
      .sort({ createdAt: -1 });

    const joinedMatches = await Match.find({ acceptedPlayers: userId, hostId: { $ne: userId } })
      .populate('hostId', 'name position avatarUrl')
      .populate('venueId', 'name location sportType')
      .populate('acceptedPlayers', 'name position avatarUrl skills stats')
      .sort({ createdAt: -1 });

    res.json({ hostedMatches, joinedMatches });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user matches.', error: error.message });
  }
});

// POST /api/matches (Host a Match)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { venueId, date, timeSlot, format, totalSpots, pricePerSpot, notes } = req.body;

    if (!venueId || !date || !timeSlot) {
      return res.status(400).json({ message: 'Venue, date, and time slot are required to host a match.' });
    }

    const match = new Match({
      hostId: req.user.userId,
      venueId,
      date,
      timeSlot,
      format: format || '5v5',
      totalSpots: Number(totalSpots) || 10,
      pricePerSpot: Number(pricePerSpot) || 200,
      notes: notes || 'Casual competitive game. Be punctual!',
      acceptedPlayers: [req.user.userId], // Host is automatically the first accepted player
      pendingRequests: []
    });

    await match.save();

    const populatedMatch = await Match.findById(match._id)
      .populate('hostId', 'name position avatarUrl')
      .populate('venueId', 'name location sportType');

    res.status(201).json({ message: 'Match hosted successfully!', match: populatedMatch });
  } catch (error) {
    res.status(500).json({ message: 'Error hosting match.', error: error.message });
  }
});

// POST /api/matches/:id/join (Request to Join Match)
router.post('/:id/join', authenticateToken, async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ message: 'Match not found.' });
    }

    const userId = req.user.userId;

    if (match.acceptedPlayers.includes(userId)) {
      return res.status(400).json({ message: 'You are already an accepted player in this match.' });
    }

    if (match.pendingRequests.includes(userId)) {
      return res.status(400).json({ message: 'You have already requested to join this match.' });
    }

    if (match.acceptedPlayers.length >= match.totalSpots) {
      return res.status(400).json({ message: 'Match is already full.' });
    }

    match.pendingRequests.push(userId);
    await match.save();

    res.json({ message: 'Join request sent to the match host!' });
  } catch (error) {
    res.status(500).json({ message: 'Error requesting to join match.', error: error.message });
  }
});

// POST /api/matches/:id/respond (Host Accept / Decline Player Request)
router.post('/:id/respond', authenticateToken, async (req, res) => {
  try {
    const { playerId, action } = req.body; // action: 'accept' or 'decline'
    const match = await Match.findById(req.params.id);

    if (!match) {
      return res.status(404).json({ message: 'Match not found.' });
    }

    if (match.hostId.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Only the host can approve or decline join requests.' });
    }

    // Remove from pending
    match.pendingRequests = match.pendingRequests.filter(id => id.toString() !== playerId);

    if (action === 'accept') {
      if (match.acceptedPlayers.length >= match.totalSpots) {
        return res.status(400).json({ message: 'Match has reached maximum player capacity.' });
      }
      if (!match.acceptedPlayers.includes(playerId)) {
        match.acceptedPlayers.push(playerId);
      }
      if (match.acceptedPlayers.length >= match.totalSpots) {
        match.status = 'full';
      }
    }

    await match.save();

    const updatedMatch = await Match.findById(match._id)
      .populate('acceptedPlayers', 'name position avatarUrl skills stats email location')
      .populate('pendingRequests', 'name position avatarUrl skills stats email location');

    res.json({ message: `Player request ${action}ed successfully!`, match: updatedMatch });
  } catch (error) {
    res.status(500).json({ message: 'Error responding to player request.', error: error.message });
  }
});

// GET /api/matches/:id/comments (Match Notice Board Comments - Option B)
router.get('/:id/comments', async (req, res) => {
  try {
    const comments = await MatchComment.find({ matchId: req.params.id }).sort({ createdAt: 1 });
    res.json({ comments });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching notice board comments.' });
  }
});

// POST /api/matches/:id/comments (Post Notice Board Comment - Option B)
router.post('/:id/comments', authenticateToken, async (req, res) => {
  try {
    const { commentText } = req.body;
    if (!commentText || !commentText.trim()) {
      return res.status(400).json({ message: 'Comment text cannot be empty.' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const comment = new MatchComment({
      matchId: req.params.id,
      userId: user._id,
      userName: user.name,
      userPosition: user.position,
      commentText: commentText.trim()
    });

    await comment.save();

    // Broadcast live notice board comment via socket if available
    const io = req.app.get('io');
    if (io) {
      io.emit(`match_comment_${req.params.id}`, comment);
    }

    res.status(201).json({ message: 'Comment posted on Match Notice Board!', comment });
  } catch (error) {
    res.status(500).json({ message: 'Error posting comment.', error: error.message });
  }
});

module.exports = router;
