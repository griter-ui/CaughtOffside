const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  venueId: { type: mongoose.Schema.Types.ObjectId, ref: 'Venue', required: true },
  date: { type: String, required: true },
  timeSlot: { type: String, required: true },
  format: { type: String, enum: ['5v5', '7v7', '11-a-side'], default: '5v5' },
  totalSpots: { type: Number, default: 10 },
  pricePerSpot: { type: Number, default: 200 },
  notes: { type: String, default: 'Casual competitive match! Bring bibs if you have them.' },
  acceptedPlayers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  pendingRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  status: { type: String, enum: ['open', 'full', 'completed', 'cancelled'], default: 'open' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Match', matchSchema);
