// A reservation owns one venue/date/slot. Hosting creates or claims this record
// in the same transaction as the match, so an open game always has a reserved turf.
const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  venueId: { type: mongoose.Schema.Types.ObjectId, ref: 'Venue', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  matchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match' },
  // Snapshot the player's chosen format; owner edits do not rewrite receipts.
  format: { type: String, enum: require('../utils/venueFormats').FORMATS },
  date: { type: String, required: true }, // Format: YYYY-MM-DD
  timeSlot: { type: String, required: true }, // e.g., "07:00 PM - 08:00 PM"
  // Snapshot of the venue price when booked; later listing-price edits do not change it.
  price: { type: Number, required: true },
  // The active route writes pay_at_venue. Other allowed labels do not implement payments.
  paymentStatus: { type: String, enum: ['pay_at_venue', 'simulated', 'paid', 'pending', 'cancelled'], default: 'pay_at_venue' },
  receiptId: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now }
});

// MongoDB enforces at most one stored reservation for this exact tuple, even when
// two requests pass an earlier conflict lookup. server.js awaits index initialization.
// Archived records remain in this index because they have not been deleted.
bookingSchema.index({ venueId: 1, date: 1, timeSlot: 1 }, { unique: true });

module.exports = mongoose.model('Booking', bookingSchema);
