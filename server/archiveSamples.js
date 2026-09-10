const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Venue = require('./models/Venue');
const Match = require('./models/Match');
const Booking = require('./models/Booking');
const MatchComment = require('./models/MatchComment');
const Connection = require('./models/Connection');

module.exports = async function archiveSamples() {
  const samples = [
    ['owner@turf.com', 'Rajesh Sharma (Turf Owner)'], ['priya@turf.com', 'Priya Mehta (Arena Owner)'],
    ['rohan@gmail.com', 'Rohan Verma'], ['arjun@gmail.com', 'Arjun Nair'],
    ['vikram@gmail.com', 'Vikram Singh'], ['karan@gmail.com', 'Karan Patel'],
    ['sameer@gmail.com', 'Sameer Khan'], ['ananya@gmail.com', 'Ananya Roy']
  ];
  const users = await User.collection.find({ $or: samples.map(([email, name]) => ({ email, name })), archivedSample: { $ne: true } }).toArray();
  const ids = [];
  for (const user of users) {
    if (await bcrypt.compare('password123', user.password)) ids.push(user._id);
  }
  if (!ids.length) return;
  const venues = await Venue.collection.find({ ownerId: { $in: ids }, name: { $in: [
    'HotFut Turf Arena', 'Sportzone Football Hub', 'CaughtOffside HSR Arena',
    'Turf Town Jayanagar', 'FC Whitefield Turf & Arena', 'The Dugout Electronic City'
  ] } }).toArray();
  const venueIds = venues.map(v => v._id);
  const matches = await Match.collection.find({ hostId: { $in: ids }, venueId: { $in: venueIds } }).toArray();
  const matchIds = matches.map(m => m._id);
  const archived = { $set: { archivedSample: true } };
  await Venue.collection.updateMany({ _id: { $in: venueIds } }, archived);
  await Match.collection.updateMany({ _id: { $in: matchIds } }, archived);
  await MatchComment.collection.updateMany({ matchId: { $in: matchIds } }, archived);
  await Booking.collection.updateMany({ paymentStatus: 'simulated', userId: { $in: ids } }, archived);
  await Connection.collection.updateMany({ $or: [{ requesterId: { $in: ids } }, { recipientId: { $in: ids } }] }, archived);
  // Mark accounts last so an interrupted migration can safely retry related records.
  await User.collection.updateMany({ _id: { $in: ids } }, archived);
  console.log('Archived starter sample records. No records were deleted.');
};
