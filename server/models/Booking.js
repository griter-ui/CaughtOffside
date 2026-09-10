const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  venueId: { type: mongoose.Schema.Types.ObjectId, ref: 'Venue', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true }, // Format: YYYY-MM-DD
  timeSlot: { type: String, required: true }, // e.g., "07:00 PM - 08:00 PM"
  price: { type: Number, required: true },
  paymentStatus: { type: String, enum: ['paid', 'pending', 'cancelled'], default: 'paid' },
  receiptId: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now }
});

// Conflict-safe unique index to prevent double bookings
bookingSchema.index({ venueId: 1, date: 1, timeSlot: 1 }, { unique: true });

module.exports = mongoose.model('Booking', bookingSchema);
