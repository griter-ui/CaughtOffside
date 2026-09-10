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
  bio: { type: String, default: 'Passionate football player looking for good weekend matches.' },
  location: { type: String, default: 'Indiranagar, Bangalore' },
  availability: { type: String, default: 'Weekends & Evening slots' },
  stats: {
    matchesPlayed: { type: Number, default: 12 },
    tournamentsWon: { type: Number, default: 2 },
    motmCount: { type: Number, default: 3 },
    gearBoughtSold: { type: Number, default: 4 }
  },
  avatarUrl: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
