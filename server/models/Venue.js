const mongoose = require('mongoose');

const venueSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: { type: String, required: true },
  area: { type: String, required: true },
  pricePerHour: { type: Number, required: true },
  sportType: { type: String, enum: ['5-a-side', '7-a-side', '11-a-side', 'Box Cricket & Football'], default: '5-a-side' },
  rating: { type: Number, default: 0 },
  photos: [{ type: String }],
  description: { type: String, default: '' },
  amenities: [{ type: String }],
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Venue', venueSchema);
