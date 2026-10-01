// Backend entry point: configure HTTP + sockets, prepare MongoDB, then accept requests.
// Read BACKEND_STUDY_GUIDE.md at the repository root for the recommended file order.
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

// Load local .env values into process.env before modules read database/token settings.
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && !process.env.MONGO_URI) {
  throw new Error('MONGO_URI is required for deployment. Set your MongoDB Atlas connection string.');
}

// Register shared schema/query behavior before route imports compile their models.
require('./middleware/archivePlugin')(mongoose);
const archiveSamples = require('./archiveSamples');

// Express handles HTTP routes; the shared HTTP server also carries Socket.IO traffic.
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Request preparation: CORS controls browser cross-origin access; it is not login.
// express.json() parses JSON request bodies so handlers can read req.body.
app.use(cors());
app.use(express.json());
// GET /api/health - Server & Database Readiness Check
// 1. Trigger: Monitoring service or app startup check calling GET /api/health
// 2. Input: req.params: none | req.query: none | req.body: none | req.user: none
// 3. Permission: None (Public endpoint)
// 4. Rules: Validates mongoose.connection.readyState === 1. No input validation required.
// 5. Storage: No model queried directly; inspects Mongoose connection status.
// 6. Output: 200 OK ({ status: 'ok', bookingMode: 'pay_at_venue' }) or 503 Service Unavailable ({ status: 'unavailable', bookingMode: 'pay_at_venue' }). No socket events.
app.get('/api/health', (req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({ status: connected ? 'ok' : 'unavailable', bookingMode: 'pay_at_venue' });
});

// Pass io to app context so routes can emit events
app.set('io', io);

// Socket.io Real-Time Event Handling
io.on('connection', (socket) => {
  console.log('⚡ Socket client connected:', socket.id);

  // Relay selection hints to other sockets. No database hold, ownership or expiry
  // is created here; the booking route + unique index decide who reserves a slot.
  socket.on('select_slot', (payload) => {
    if (!payload || typeof payload !== 'object') return;
    const { venueId, date, timeSlot } = payload;
    if (![venueId, date, timeSlot].every(value => typeof value === 'string' && value.length < 100)) return;
    socket.broadcast.emit('slot_selecting', { venueId, date, timeSlot });
  });

  socket.on('deselect_slot', (payload) => {
    if (!payload || typeof payload !== 'object') return;
    const { venueId, date, timeSlot } = payload;
    if (![venueId, date, timeSlot].every(value => typeof value === 'string' && value.length < 100)) return;
    socket.broadcast.emit('slot_deselected', { venueId, date, timeSlot });
  });

  socket.on('disconnect', () => {
    console.log('Socket client disconnected:', socket.id);
  });
});

// Route prefixes: router.post('/') in routes/bookings.js becomes POST /api/bookings.
// Express executes middleware/handlers in registration order; protected routes
// explicitly add authenticateToken before their business logic.
app.use('/api/auth', require('./routes/auth'));
app.use('/api/players', require('./routes/players'));
app.use('/api/venues', require('./routes/venues'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/matches', require('./routes/matches'));
app.use('/api/connections', require('./routes/connections'));

// Serve built React assets from client/dist (a build is needed after client edits).
const clientBuildPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientBuildPath));

// Non-API URLs can load the SPA entry page. Never turn an unknown API URL into HTML.
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientBuildPath, 'index.html'), (err) => {
    if (err) next();
  });
});

// Persistent database in production; optional temporary database for local demos.
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/football_db';
const PORT = process.env.PORT || 5000;

// await suspends this function while I/O completes; it does not create a new JS thread.
// Finish startup dependencies before listen() so requests cannot arrive too early.
async function startServer() {
  try {
    try {
      await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: isProduction ? 15000 : 2000 });
      console.log('Connected to MongoDB.');
    } catch (err) {
      if (isProduction || process.env.ALLOW_MEMORY_DB !== 'true') {
        throw new Error('MongoDB connection failed. Check MONGO_URI, database credentials and Atlas Network Access.');
      }
      console.log('⚠️ Local MongoDB not running on 27017. Starting temporary MongoDB replica-set fallback...');
      const { MongoMemoryReplSet } = require('mongodb-memory-server');
      const mongod = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
      const memoryUri = mongod.getUri();
      await mongoose.connect(memoryUri);
      console.log('✅ Connected to MongoDB Memory Server at', memoryUri);
    }

    // Hide recognized historical fixtures; startup does NOT invoke seed.js.
    await archiveSamples();
    // Ensure the unique slot index exists before accepting concurrent bookings.
    await require('./models/Booking').init();
    await require('./models/Match').init();

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Football Platform Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Server startup failed. Check database access and required configuration.');
    await mongoose.disconnect();
    process.exitCode = 1;
  }
}

startServer();
