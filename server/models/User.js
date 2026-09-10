const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['player', 'owner'], default: 'player' },
  position: { type: String, enum: ['FW', 'MF', 'DF', 'GK'], default: 'MF' },
  experienceLevel: { type: String, enum: ['beginner', 'intermediate', 'advanced', 'pro'], default: 'intermediate' },
  preferredFoot: { type: String, enum: ['Left', 'Right', 'Ambidextrous'], default: 'Right' },
  skills: {
    pace: { type: Number, min: 1, max: 99, default: 75 },
    passing: { type: Number, min: 1, max: 99, default: 78 },
    shooting: { type: Number, min: 1, max: 99, default: 72 },
    defending: { type: Number, min: 1, max: 99, default: 65 },
    stamina: { type: Number, min: 1, max: 99, default: 80 }
  },
  bio: { type: String, default: '' },
  location: { type: String, default: '' },
  availability: { type: String, default: 'Weekends & Evening slots' },
  stats: {
    matchesPlayed: { type: Number, default: 0 },
    tournamentsWon: { type: Number, default: 0 },
    motmCount: { type: Number, default: 0 },
    gearBoughtSold: { type: Number, default: 0 }
  },
  avatarUrl: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
