// Integration tests: real HTTP + Socket.IO against a child server and disposable DB.
// Study setup -> api helper -> assertions -> cleanup. No production .env DB is used.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const net = require('node:net');
const path = require('node:path');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { io } = require('../../client/node_modules/socket.io-client');
const { isValidDate, isSlotExpired } = require('../utils/slots');

let database, server, baseUrl;
const sockets = [];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

before(async () => {
  // This database is created only for the test; the user's .env database is never used.
  database = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  const mongoose = require('mongoose');
  await mongoose.connect(database.getUri('demo_test'));
  await require('../seed')();
  await mongoose.disconnect();
  // Let the OS select a free port, then pass it to the child application server.
  const reservation = net.createServer().listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  baseUrl = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['server/server.js'], {
    cwd: path.resolve(__dirname, '../..'),
    env: { ...process.env, NODE_ENV: 'production', PORT: String(port),
      MONGO_URI: database.getUri('demo_test'), JWT_SECRET: 'test-only-secret-with-more-than-32-characters',
      SEED_DEMO_DATA: 'true', ALLOW_MEMORY_DB: 'false' },
    stdio: 'ignore', windowsHide: true
  });
  // Poll readiness rather than assuming database startup finishes after a fixed delay.
  for (let attempt = 0; attempt < 120; attempt++) {
    if (server.exitCode !== null) throw new Error('Test server exited before becoming healthy.');
    try { if ((await fetch(`${baseUrl}/api/health`)).ok) return; } catch {}
    await pause(250);
  }
  throw new Error('Test server did not become healthy.');
}, { timeout: 180000 });

// Always release sockets/process/database when the suite ends, including after failure.
after(async () => {
  sockets.forEach(socket => socket.disconnect());
  if (server && server.exitCode === null) {
    const exited = once(server, 'exit');
    server.kill();
    await exited;
  }
  if (database) await database.stop();
});

// One HTTP helper adds JSON/auth headers and returns both status and parsed body.
async function api(route, { token, ...options } = {}) {
  const response = await fetch(`${baseUrl}/api${route}`, {
    ...options, headers: { 'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  });
  return { status: response.status, body: await response.json() };
}

// Fixed timestamps make calendar and exact slot-start boundary checks repeatable.
test('dates reject invalid days and use India time at slot start', () => {
  assert.equal(isValidDate('2026-02-30'), false);
  assert.equal(isValidDate('2028-02-29'), true);
  assert.equal(isSlotExpired('2026-09-10', '06:00 AM - 07:00 AM', new Date('2026-09-10T00:29:59Z')), false);
  assert.equal(isSlotExpired('2026-09-10', '06:00 AM - 07:00 AM', new Date('2026-09-10T00:30:00Z')), true);
});

test('sample archive, signup, reservations, permissions and real-time events', { timeout: 30000 }, async () => {
  assert.deepEqual((await api('/venues')).body.venues, []);
  assert.deepEqual((await api('/players')).body.players, []);
  const oldLogin = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'rohan@gmail.com', password: 'password123' }) });
  assert.equal(oldLogin.status, 400);
  const signup = await api('/auth/signup', { method: 'POST', body: JSON.stringify({ name: 'Test Player', email: 'player@example.test', password: 'test-password-123' }) });
  assert.equal(signup.status, 201);
  assert.equal(signup.body.user.stats.matchesPlayed, 0);
  const owner = await api('/auth/signup', { method: 'POST', body: JSON.stringify({ name: 'Test Owner', email: 'owner@example.test', password: 'test-password-123', role: 'owner' }) });
  assert.equal(owner.status, 201);
  const listing = await api('/venues', { token: owner.body.token, method: 'POST', body: JSON.stringify({ name: 'Test Ground', location: 'Bangalore', pricePerHour: 900 }) });
  assert.equal(listing.status, 201);
  const login = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'player@example.test', password: 'test-password-123' }) });
  assert.equal(login.status, 200);
  const token = login.body.token;
  const players = await api('/players');
  assert.ok(players.body.players.length > 0);
  assert.ok(players.body.players.every(player => !('email' in player) && !('password' in player)));
  const profile = await api('/auth/profile', { token, method: 'PUT', body: JSON.stringify({ role: 'owner', name: 'Demo Player' }) });
  assert.equal(profile.body.user.role, 'player');
  assert.equal(profile.body.user.name, 'Demo Player');
  const denied = await api('/venues', { token, method: 'POST', body: JSON.stringify({ name: 'No', location: 'Bangalore', pricePerHour: 500 }) });
  assert.equal(denied.status, 403);
  const venues = await api('/venues');
  assert.equal(venues.body.venues.length, 1);
  const venue = venues.body.venues[0];
  const date = new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10);
  const booking = { venueId: venue._id, date, timeSlot: '07:00 PM - 08:00 PM', price: 1 };
  const invalid = await api('/bookings', { token, method: 'POST', body: JSON.stringify({ ...booking, date: '2026-02-30' }) });
  assert.equal(invalid.status, 400);
  const socket = io(baseUrl, { autoConnect: false, transports: ['websocket'] });
  sockets.push(socket);
  const connected = once(socket, 'connect');
  socket.connect();
  await connected;
  const bookedEvent = once(socket, 'slot_booked');
  // Overlap two writes to the same slot: one must succeed, the other must conflict.
  // This exercises the database index, not merely two sequential button clicks.
  const attempts = await Promise.all([1, 2].map(() => api('/bookings', { token, method: 'POST', body: JSON.stringify(booking) })));
  assert.deepEqual(attempts.map(result => result.status).sort(), [201, 409]);
  const created = attempts.find(result => result.status === 201).body.booking;
  assert.equal(created.price, venue.pricePerHour);
  assert.equal(created.paymentStatus, 'pay_at_venue');
  assert.equal((await bookedEvent)[0].venueId, venue._id);
  const slots = await api(`/venues/${venue._id}/slots?date=${date}`);
  assert.equal(slots.body.slots.find(slot => slot.timeSlot === booking.timeSlot).status, 'booked');
  const unauthorizedCancel = await api(`/bookings/owner/${created._id}`, { token, method: 'DELETE' });
  assert.equal(unauthorizedCancel.status, 403);
  const cancelled = await api(`/bookings/${created._id}`, { token, method: 'DELETE' });
  assert.equal(cancelled.status, 200);
  const freed = await api(`/venues/${venue._id}/slots?date=${date}`);
  assert.equal(freed.body.slots.find(slot => slot.timeSlot === booking.timeSlot).status, 'available');
  const page = await fetch(baseUrl);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /CaughtOffside/);
});

test('hosting reserves turf, checks ownership, survives retries, and cancellation withdraws the game', { timeout: 30000 }, async () => {
  const signup = async (name, role = 'player') => (await api('/auth/signup', { method: 'POST', body: JSON.stringify({ name, role, email: `${name}@example.test`, password: 'test-password-123' }) })).body;
  const host = await signup('host');
  const guest = await signup('guest');
  const owner = await signup('turfowner', 'owner');
  const venue = (await api('/venues', { token: owner.token, method: 'POST', body: JSON.stringify({ name: 'Host Test Turf', location: 'Bangalore', pricePerHour: 1200 }) })).body.venue;
  const date = new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10);
  const payload = { venueId: venue._id, date, timeSlot: '06:00 PM - 07:00 PM', format: '5v5', totalSpots: 2, pricePerSpot: 0, hostingRequestId: 'host-request-00001' };
  const post = (route, body, token = host.token) => api(route, { token, method: 'POST', body: JSON.stringify(body) });
  assert.equal((await post('/matches', payload, '')).status, 401);
  for (const invalid of [{ date: '2026-02-30' }, { date: '2020-01-01' }, { timeSlot: 'anything' }, { venueId: 'invalid' }, { totalSpots: -1 }, { totalSpots: 2.5 }, { pricePerSpot: -10 }, { format: '1v1' }, { notes: 'x'.repeat(2001) }]) {
    assert.equal((await post('/matches', { ...payload, ...invalid })).status, 400);
  }
  assert.equal((await api('/bookings/my-bookings', { token: host.token })).body.bookings.length, 0);
  assert.equal((await post('/matches', { ...payload, venueId: '000000000000000000000001' })).status, 404);

  const hosted = await post('/matches', { ...payload, price: 1, paymentStatus: 'paid' });
  assert.equal(hosted.status, 201);
  const match = hosted.body.match;
  assert.equal(match.pricePerSpot, 0); // Free participation must not become a default charge.
  assert.equal(match.bookingId.price, 1200);
  assert.equal(match.bookingId.paymentStatus, 'pay_at_venue');
  assert.equal((await post('/matches', payload)).body.match._id, match._id);
  assert.equal((await post('/matches', payload)).status, 200);
  const reservations = (await api('/bookings/my-bookings', { token: host.token })).body.bookings;
  assert.equal(reservations.length, 1);
  assert.equal(reservations[0].matchId, match._id);
  assert.equal((await post('/bookings', payload, guest.token)).status, 409);
  assert.equal((await post('/matches', { ...payload, hostingRequestId: 'host-request-00002' }, guest.token)).status, 409);
  assert.ok((await api('/matches')).body.matches.some(item => item._id === match._id));

  assert.equal((await post(`/matches/${match._id}/join`, {}, guest.token)).status, 200);
  assert.equal((await post(`/matches/${match._id}/join`, {}, guest.token)).status, 409);
  assert.equal((await post(`/matches/${match._id}/respond`, { playerId: guest.user._id, action: 'accept' }, guest.token)).status, 403);
  assert.equal((await post(`/matches/${match._id}/respond`, { playerId: guest.user._id, action: 'invalid' })).status, 400);
  assert.equal((await post(`/matches/${match._id}/respond`, { playerId: guest.user._id, action: 'accept' })).body.match.status, 'full');
  assert.equal((await api(`/bookings/${reservations[0]._id}`, { token: guest.token, method: 'DELETE' })).status, 403);
  assert.equal((await api(`/bookings/owner/${reservations[0]._id}`, { token: owner.token, method: 'DELETE' })).status, 200);
  assert.ok(!(await api('/matches')).body.matches.some(item => item._id === match._id));
  assert.equal((await api('/matches/my-matches', { token: host.token })).body.hostedMatches.find(item => item._id === match._id).status, 'cancelled');
  assert.equal((await post(`/matches/${match._id}/join`, {}, guest.token)).status, 409);
  assert.equal((await post(`/matches/${match._id}/respond`, { playerId: guest.user._id, action: 'accept' })).status, 409);
  assert.equal((await api(`/venues/${venue._id}/slots?date=${date}`)).body.slots.find(s => s.timeSlot === payload.timeSlot).status, 'available');

  // Claim an existing reservation; ignore client attempts to change its schedule.
  const reserved = (await post('/bookings', payload)).body.booking;
  assert.equal((await post('/matches', { bookingId: reserved._id }, guest.token)).status, 403);
  const linked = await post('/matches', { bookingId: reserved._id, date: '1999-01-01', venueId: guest.user._id });
  assert.equal(linked.status, 201);
  assert.equal(linked.body.match.date, date);
  assert.equal(linked.body.match.venueId._id, venue._id);
  assert.equal((await api('/bookings/my-bookings', { token: host.token })).body.bookings.length, 1);
  assert.equal((await post('/matches', { bookingId: reserved._id })).status, 409);
  assert.equal((await api(`/bookings/${reserved._id}`, { token: host.token, method: 'DELETE' })).status, 200);

  // Race the two independent entry points against the same unique slot index.
  const racePayload = { ...payload, hostingRequestId: 'host-request-race1' };
  const race = await Promise.all([post('/matches', racePayload), post('/bookings', racePayload, guest.token)]);
  assert.deepEqual(race.map(result => result.status).sort(), [201, 409]);
  const ownerBookings = (await api('/bookings/owner', { token: owner.token })).body.bookings;
  assert.equal(ownerBookings.length, 1);
  await api(`/bookings/owner/${ownerBookings[0]._id}`, { token: owner.token, method: 'DELETE' });

  // Cancellation versus attaching an existing booking must never leave an open game.
  const raceBooking = (await post('/bookings', payload)).body.booking;
  const claimRace = await Promise.all([
    post('/matches', { bookingId: raceBooking._id }),
    api(`/bookings/${raceBooking._id}`, { token: host.token, method: 'DELETE' })
  ]);
  assert.equal(claimRace[1].status, 200);
  assert.ok([201, 404].includes(claimRace[0].status));
  assert.ok(!(await api('/matches')).body.matches.some(item => item.venueId._id === venue._id));
});

test('a failed match write rolls back its reservation', async t => {
  const mongoose = require('mongoose');
  await mongoose.connect(database.getUri('rollback_test'));
  try {
    const Booking = require('../models/Booking');
    const Match = require('../models/Match');
    const Venue = require('../models/Venue');
    await Promise.all([Booking.init(), Match.init()]);
    const venue = await Venue.create({ name: 'Rollback Turf', location: 'Bangalore', area: 'Test', pricePerHour: 900 });
    t.mock.method(Match, 'create', async () => { throw new Error('Injected match write failure'); });
    await assert.rejects(require('../services/matchBookings').hostMatch(String(new mongoose.Types.ObjectId()), {
      venueId: String(venue._id), date: new Date(Date.now() + 86400000 * 4).toISOString().slice(0, 10), timeSlot: '07:00 PM - 08:00 PM'
    }), /Injected match write failure/);
    assert.equal(await Booking.countDocuments({}), 0);
    assert.equal(await Match.countDocuments({}), 0);
  } finally {
    t.mock.restoreAll();
    await mongoose.disconnect();
  }
});
