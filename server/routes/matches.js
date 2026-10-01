// /api/matches combines game discovery, hosting, join approval and notice-board APIs.
// Follow the state journey: host is accepted -> guest is pending -> host accepts guest.
const express = require('express');
const router = express.Router();
const Match = require('../models/Match');
const MatchComment = require('../models/MatchComment');
const User = require('../models/User');
const Booking = require('../models/Booking');
const mongoose = require('mongoose');
const { isSlotExpired } = require('../utils/slots');
const { hostMatch, sendBookingError } = require('../services/matchBookings');
const { authenticateToken } = require('../middleware/auth');

// GET /api/matches (Browse Open Matches)
router.get('/', async (req, res) => {
  try {
    const { format, status } = req.query;

    // Server filters format/status. OpenMatchesPage separately hides expired and
    // self-hosted games; hiding them in the UI is not server-side write validation.
    let query = { bookingId: { $exists: true } };
    if (format && format !== 'All') {
      query.format = format;
    }
    if (status && status !== 'All') {
      query.status = status;
    } else {
      query.status = { $in: ['open', 'full'] };
    }

    // Populate selected related fields for readable cards, then return newest first.
    const matches = await Match.find(query)
      .populate('bookingId', 'receiptId paymentStatus')
      .populate('hostId', 'name position avatarUrl skills stats location')
      .populate('venueId', 'name location sportType pricePerHour photos')
      .populate('acceptedPlayers', 'name position avatarUrl skills stats')
      .sort({ createdAt: -1 });

    // Old unreserved listings and cancelled/deleted reservations never appear as games.
    res.json({ matches: matches.filter(match => match.bookingId && !isSlotExpired(match.date, match.timeSlot)) });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching open matches.', error: error.message });
  }
});

// GET /api/matches/my-matches
router.get('/my-matches', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Hosts need applicants for approval. Joined squads exclude the caller's own
    // hosted games because the host already appears in acceptedPlayers.
    const hostedMatches = await Match.find({ hostId: userId })
      .populate('bookingId', 'receiptId paymentStatus price')
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

// POST /api/matches: reserve a new slot OR claim the host's existing reservation.
// Only broadcast after the transaction commits; never advertise an unreserved game.
router.post('/', authenticateToken, async (req, res) => {
  try {
    const result = await hostMatch(req.user.userId, req.body);
    const match = await Match.findById(result.match._id)
      .populate('hostId', 'name position avatarUrl')
      .populate('bookingId', 'receiptId paymentStatus price')
      .populate('venueId', 'name location sportType');
    if (!result.replay) {
      const io = req.app.get('io');
      if (result.newBooking) io?.emit('slot_booked', {
        venueId: String(result.booking.venueId), date: result.booking.date, timeSlot: result.booking.timeSlot
      });
      io?.emit('match_updated');
    }
    res.status(result.replay ? 200 : 201).json({ message: 'Turf reserved and match hosted. Pay the venue directly.', match });
  } catch (error) {
    sendBookingError(res, error);
  }
});

// Legacy matches without reservations cannot accept new players.
async function requireReservedMatch(match) {
  if (!match.bookingId || !['open', 'full'].includes(match.status) || isSlotExpired(match.date, match.timeSlot)) return false;
  return Boolean(await Booking.exists({ _id: match.bookingId, matchId: match._id }));
}

// POST /api/matches/:id/join (Request to Join Match)
router.post('/:id/join', authenticateToken, async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ message: 'Match not found.' });
    }

    const userId = req.user.userId;
    if (!await requireReservedMatch(match)) return res.status(409).json({ message: 'This match has no active upcoming turf reservation.' });
    // One conditional write prevents duplicate requests and racing a cancellation.
    const updated = await Match.findOneAndUpdate({
      _id: match._id, status: 'open', acceptedPlayers: { $ne: userId }, pendingRequests: { $ne: userId },
      $expr: { $lt: [{ $size: '$acceptedPlayers' }, '$totalSpots'] }
    }, { $addToSet: { pendingRequests: userId } });
    if (!updated) return res.status(409).json({ message: 'Match is full, cancelled, or you have already joined/requested.' });

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

    // Record ownership is enforced on the server, independent of visible UI buttons.
    if (match.hostId.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Only the host can approve or decline join requests.' });
    }

    if (!mongoose.isObjectIdOrHexString(playerId) || !['accept', 'decline'].includes(action)) {
      return res.status(400).json({ message: 'Choose a pending player and accept or decline.' });
    }
    if (!await requireReservedMatch(match)) return res.status(409).json({ message: 'This match has no active upcoming turf reservation.' });
    const filter = { _id: match._id, status: { $in: ['open', 'full'] }, pendingRequests: playerId };
    const update = { $pull: { pendingRequests: playerId } };
    if (action === 'accept') {
      filter.$expr = { $lt: [{ $size: '$acceptedPlayers' }, '$totalSpots'] };
      update.$addToSet = { acceptedPlayers: playerId };
    }
    const changed = await Match.findOneAndUpdate(filter, update, { new: true });
    if (!changed) return res.status(409).json({ message: 'Request no longer pending, match cancelled, or squad full.' });
    // Conditional status update cannot reopen a concurrently cancelled match.
    await Match.updateOne({ _id: match._id, status: 'open', $expr: { $gte: [{ $size: '$acceptedPlayers' }, '$totalSpots'] } }, { $set: { status: 'full' } });

    const updatedMatch = await Match.findById(match._id)
      .populate('acceptedPlayers', 'name position avatarUrl skills stats email location')
      .populate('pendingRequests', 'name position avatarUrl skills stats email location');

    res.json({ message: `Player request ${action}ed successfully!`, match: updatedMatch });
  } catch (error) {
    res.status(500).json({ message: 'Error responding to player request.', error: error.message });
  }
});

// GET /api/matches/:id/comments: public history ordered oldest first; no login required.
router.get('/:id/comments', async (req, res) => {
  try {
    const comments = await MatchComment.find({ matchId: req.params.id }).sort({ createdAt: 1 });
    res.json({ comments });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching notice board comments.' });
  }
});

// POST /api/matches/:id/comments: login required, but accepted membership is NOT
// checked here. The UI hides the form from outsiders; a direct API request bypasses
// that display rule. Match existence, text type/length and membership need validation.
router.post('/:id/comments', authenticateToken, async (req, res) => {
  try {
    const { commentText } = req.body;
    if (!commentText || !commentText.trim()) {
      return res.status(400).json({ message: 'Comment text cannot be empty.' });
    }

    // Derive the author from authentication, not a submitted name or userId.
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

    // Save first, then broadcast. An event name containing matchId is not a private
    // room or authorization check: io.emit sends the event to all connected sockets.
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
