const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const Booking = require('../models/Booking');
const Match = require('../models/Match');
const Venue = require('../models/Venue');
const { DEFAULT_SLOTS, isValidDate, isSlotExpired } = require('../utils/slots');
const { FORMATS, selectBookingFormat, defaultSpots } = require('../utils/venueFormats');

function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}

function validateSchedule(date, timeSlot) {
  if (!isValidDate(date) || !DEFAULT_SLOTS.includes(timeSlot) || isSlotExpired(date, timeSlot)) {
    fail(400, 'Choose a valid, upcoming slot (India time).');
  }
}

// Transaction + unique slot index protects both host-vs-host and host-vs-booking
// races. Atlas or a local replica set is required; no partial reservation survives.
async function hostMatch(userId, input) {
  const { bookingId, venueId, date, timeSlot, hostingRequestId } = input;
  const requestedFormat = input.format;
  const pricePerSpot = Number(input.pricePerSpot ?? 0);
  const notes = input.notes ?? '';
  if ((requestedFormat !== undefined && !FORMATS.includes(requestedFormat)) ||
      (input.totalSpots !== undefined && (!Number.isInteger(Number(input.totalSpots)) || Number(input.totalSpots) < 2 || Number(input.totalSpots) > 22)) ||
      !Number.isFinite(pricePerSpot) || pricePerSpot < 0 || pricePerSpot > 100000 ||
      typeof notes !== 'string' || notes.length > 2000) {
    fail(400, 'Use a valid format, 2–22 spots, a non-negative price up to INR 100,000, and notes up to 2,000 characters.');
  }
  if (hostingRequestId !== undefined && (typeof hostingRequestId !== 'string' || !/^[\w-]{16,80}$/.test(hostingRequestId))) {
    fail(400, 'Invalid hosting request ID.');
  }
  if (!mongoose.isObjectIdOrHexString(bookingId || venueId)) fail(400, 'Choose a valid venue or reservation.');
  if (!bookingId) validateSchedule(date, timeSlot);

  return mongoose.connection.transaction(async session => {
    if (hostingRequestId) {
      const existing = await Match.findOne({ hostId: userId, hostingRequestId }).session(session);
      if (existing) return { match: existing, replay: true };
    }
    let booking;
    if (bookingId) {
      booking = await Booking.findById(bookingId).session(session);
      if (!booking) fail(404, 'Reservation not found.');
      if (String(booking.userId) !== userId) fail(403, 'You can only host using your own reservation.');
      if (booking.matchId || await Match.exists({ bookingId }).session(session)) fail(409, 'This reservation already has a hosted match.');
      validateSchedule(booking.date, booking.timeSlot);
    } else {
      const venue = await Venue.findById(venueId).session(session);
      if (!venue) fail(404, 'Venue not found.');
      if (await Booking.exists({ venueId, date, timeSlot }).session(session)) fail(409, 'This slot is already booked. Choose another slot or use your existing reservation.');
      [booking] = await Booking.create([{
        venueId, userId, date, timeSlot, price: venue.pricePerHour,
        paymentStatus: 'pay_at_venue', receiptId: `REC-${randomUUID()}`
      }], { session });
    }
    if (['cancelled', 'pending'].includes(booking.paymentStatus)) fail(409, 'This reservation is not confirmed.');
    const venue = await Venue.findById(booking.venueId).session(session);
    if (!venue) fail(404, 'Venue not found.');
    const format = selectBookingFormat(venue, requestedFormat ?? booking.format);
    if (booking.format && booking.format !== format) fail(400, 'The match format must match your reserved format.');
    const totalSpots = Number(input.totalSpots ?? defaultSpots(format));
    const [match] = await Match.create([{
      hostId: userId, bookingId: booking._id, venueId: booking.venueId,
      date: booking.date, timeSlot: booking.timeSlot, format, totalSpots, pricePerSpot,
      notes: notes.trim(), acceptedPlayers: [userId], pendingRequests: [], hostingRequestId
    }], { session });
    // Updating the existing reservation also conflicts with concurrent cancellation.
    booking.matchId = match._id;
    booking.format = format;
    await booking.save({ session });
    return { match, booking, replay: false, newBooking: !bookingId };
  });
}

async function cancelBooking(bookingId, userId, asOwner) {
  if (!mongoose.isObjectIdOrHexString(bookingId)) fail(400, 'Invalid reservation ID.');
  return mongoose.connection.transaction(async session => {
    const booking = await Booking.findById(bookingId).session(session);
    if (!booking) fail(404, 'Booking not found.');
    const venue = asOwner ? await Venue.findById(booking.venueId).session(session) : null;
    const authorizedId = asOwner ? venue?.ownerId : booking.userId;
    if (String(authorizedId) !== userId) fail(403, 'Unauthorized to cancel this booking.');
    // Cancelling the turf withdraws its game and pending invitations atomically.
    // Keep the match in history; delete the booking to release its unique slot key.
    await Match.updateMany({ bookingId: booking._id }, { $set: { status: 'cancelled', pendingRequests: [] } }, { session });
    await Booking.deleteOne({ _id: booking._id }, { session });
    return booking;
  });
}

function sendBookingError(res, error) {
  if (error.code === 11000) return res.status(409).json({ message: 'This slot or reservation was just taken. Refresh availability and try again.' });
  if (error.code === 20 || /Transaction numbers are only allowed/.test(error.message)) {
    return res.status(503).json({ message: 'Booking requires a MongoDB replica set. Configure MongoDB Atlas or a local replica set.' });
  }
  const status = error.status || (error.name === 'ValidationError' || error.name === 'CastError' ? 400 : 500);
  return res.status(status).json({ message: status === 500 ? 'Unable to update the reservation. Please try again.' : error.message });
}

module.exports = { hostMatch, cancelBooking, sendBookingError };
