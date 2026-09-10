const express = require('express');
const router = express.Router();
const Connection = require('../models/Connection');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

// GET /api/connections/my-connections (Accepted & Pending Connections)
router.get('/my-connections', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Accepted connections
    const acceptedConns = await Connection.find({
      $or: [
        { requesterId: userId, status: 'accepted' },
        { recipientId: userId, status: 'accepted' }
      ]
    }).populate('requesterId recipientId', 'name position avatarUrl skills stats bio location preferredFoot experienceLevel');

    const acceptedFriends = acceptedConns.map(conn => {
      return conn.requesterId._id.toString() === userId ? conn.recipientId : conn.requesterId;
    });

    // Pending incoming requests
    const pendingIncoming = await Connection.find({ recipientId: userId, status: 'pending' })
      .populate('requesterId', 'name position avatarUrl skills stats bio location preferredFoot experienceLevel');

    // Pending outgoing requests
    const pendingOutgoing = await Connection.find({ requesterId: userId, status: 'pending' })
      .populate('recipientId', 'name position avatarUrl skills stats bio location preferredFoot experienceLevel');

    res.json({
      acceptedFriends,
      pendingIncoming: pendingIncoming.map(c => ({ connectionId: c._id, user: c.requesterId })),
      pendingOutgoing: pendingOutgoing.map(c => ({ connectionId: c._id, user: c.recipientId }))
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching connections.', error: error.message });
  }
});

// POST /api/connections/request (Send Connection Request)
router.post('/request', authenticateToken, async (req, res) => {
  try {
    const { recipientId } = req.body;
    const requesterId = req.user.userId;

    if (requesterId === recipientId) {
      return res.status(400).json({ message: 'You cannot connect with yourself.' });
    }

    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ message: 'Target player not found.' });
    }

    const existing = await Connection.findOne({
      $or: [
        { requesterId, recipientId },
        { requesterId: recipientId, recipientId: requesterId }
      ]
    });

    if (existing) {
      return res.status(400).json({ message: `Connection request already exists or status is '${existing.status}'.` });
    }

    const connection = new Connection({
      requesterId,
      recipientId,
      status: 'pending'
    });

    await connection.save();
    res.status(201).json({ message: 'Connection request sent!', connection });
  } catch (error) {
    res.status(500).json({ message: 'Error sending connection request.', error: error.message });
  }
});

// POST /api/connections/respond (Accept or Decline Request)
router.post('/respond', authenticateToken, async (req, res) => {
  try {
    const { connectionId, action } = req.body; // action: 'accept' or 'decline'

    const connection = await Connection.findById(connectionId);
    if (!connection) {
      return res.status(404).json({ message: 'Connection request not found.' });
    }

    if (connection.recipientId.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Unauthorized to respond to this request.' });
    }

    if (action === 'accept') {
      connection.status = 'accepted';
      await connection.save();
    } else {
      connection.status = 'declined';
      await connection.save();
    }

    res.json({ message: `Connection request ${action}ed!` });
  } catch (error) {
    res.status(500).json({ message: 'Error responding to connection request.', error: error.message });
  }
});

module.exports = router;
