const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const net = require('node:net');
const path = require('node:path');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { io } = require('../../client/node_modules/socket.io-client');
const { isValidDate, isSlotExpired } = require('../utils/slots');

let database, server, baseUrl;
const sockets = [];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

before(async () => {
  // This database is created only for the test; the user's .env database is never used.
  database = await MongoMemoryServer.create();
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
  for (let attempt = 0; attempt < 120; attempt++) {
    if (server.exitCode !== null) throw new Error('Test server exited before becoming healthy.');
    try { if ((await fetch(`${baseUrl}/api/health`)).ok) return; } catch {}
    await pause(250);
  }
  throw new Error('Test server did not become healthy.');
}, { timeout: 180000 });

after(async () => {
  sockets.forEach(socket => socket.disconnect());
  if (server && server.exitCode === null) {
    const exited = once(server, 'exit');
    server.kill();
    await exited;
  }
  if (database) await database.stop();
});

async function api(route, { token, ...options } = {}) {
  const response = await fetch(`${baseUrl}/api${route}`, {
    ...options, headers: { 'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  });
  return { status: response.status, body: await response.json() };
}

test('dates reject invalid days and use India time at slot start', () => {
  assert.equal(isValidDate('2026-02-30'), false);
  assert.equal(isValidDate('2028-02-29'), true);
  assert.equal(isSlotExpired('2026-09-10', '06:00 AM - 07:00 AM', new Date('2026-09-10T00:29:59Z')), false);
  assert.equal(isSlotExpired('2026-09-10', '06:00 AM - 07:00 AM', new Date('2026-09-10T00:30:00Z')), true);
});

test('demo booking, permissions, concurrency and real-time events', { timeout: 30000 }, async () => {
  const login = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'rohan@gmail.com', password: 'password123' }) });
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
  assert.equal(venues.body.venues.length, 6);
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
  const attempts = await Promise.all([1, 2].map(() => api('/bookings', { token, method: 'POST', body: JSON.stringify(booking) })));
  assert.deepEqual(attempts.map(result => result.status).sort(), [201, 409]);
  const created = attempts.find(result => result.status === 201).body.booking;
  assert.equal(created.price, venue.pricePerHour);
  assert.equal(created.paymentStatus, 'simulated');
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
