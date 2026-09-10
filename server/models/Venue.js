const mongoose = require('mongoose');

const venueSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: { type: String, required: true },
  area: { type: String, required: true },
  pricePerHour: { type: Number, required: true },
  sportType: { type: String, enum: ['5-a-side', '7-a-side', '11-a-side', 'Box Cricket & Football'], default: '5-a-side' },
  rating: { type: Number, default: 4.8 },
  photos: [{ type: String }],
  description: { type: String, default: 'Premium FIFA grade artificial turf with LED floodlights and changing rooms.' },
  amenities: [{ type: String }],
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Venue', venueSchema);
