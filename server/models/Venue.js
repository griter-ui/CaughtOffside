// A ground listing, not its availability. Slot availability is derived from Bookings.
const mongoose = require('mongoose');
const { FORMATS } = require('../utils/venueFormats');

const venueSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: { type: String, required: true },
  area: { type: String, required: true },
  // Booking creation reads this server-side price instead of trusting the client.
  pricePerHour: { type: Number, required: true },
  sportType: { type: String, enum: ['5-a-side', '7-a-side', '11-a-side', 'Box Cricket & Football'], default: '5-a-side' },
  // Undefined preserves legacy single-format inference; new listings supply an
  // explicit nonempty set. All formats still share this turf's slot inventory.
  formats: { type: [{ type: String, enum: FORMATS }], default: undefined },
  rating: { type: Number, default: 0 },
  photos: [{ type: String }],
  description: { type: String, default: '' },
  amenities: [{ type: String }],
  // Reference used for owner dashboards and per-booking cancellation permission.
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Venue', venueSchema);
