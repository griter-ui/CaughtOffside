// Social game listing backed by a reservation. Legacy unlinked games remain in
// history but cannot be discovered or joined until backed by a real booking.
const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  hostingRequestId: { type: String },
  venueId: { type: mongoose.Schema.Types.ObjectId, ref: 'Venue', required: true },
  date: { type: String, required: true },
  timeSlot: { type: String, required: true },
  format: { type: String, enum: ['5v5', '7v7', '11-a-side'], default: '5v5' },
  totalSpots: { type: Number, default: 10 },
  pricePerSpot: { type: Number, default: 200 },
  notes: { type: String, default: 'Casual competitive match! Bring bibs if you have them.' },
  // Only accepted players consume spots; creation puts the host in this array too.
  // Arrays store user IDs; populate supplies names/profile fields for responses.
  acceptedPlayers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  pendingRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // Booking cancellation withdraws the match. Completion is still a history view.
  status: { type: String, enum: ['open', 'full', 'completed', 'cancelled'], default: 'open' },
  createdAt: { type: Date, default: Date.now }
});

// Partial indexes preserve legacy records without allowing two matches to claim
// one booking or a retried host request to create duplicate reservations.
matchSchema.index({ bookingId: 1 }, { unique: true, partialFilterExpression: { bookingId: { $type: 'objectId' } } });
matchSchema.index({ hostId: 1, hostingRequestId: 1 }, { unique: true, partialFilterExpression: { hostingRequestId: { $type: 'string' } } });

module.exports = mongoose.model('Match', matchSchema);
