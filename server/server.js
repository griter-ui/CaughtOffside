const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && !process.env.MONGO_URI) {
  throw new Error('MONGO_URI is required for deployment. Set your MongoDB Atlas connection string.');
}

const seedData = require('./seed');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.get('/api/health', (req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({ status: connected ? 'ok' : 'unavailable', demo: true });
});

// Pass io to app context so routes can emit events
app.set('io', io);

// Socket.io Real-Time Event Handling
io.on('connection', (socket) => {
  console.log('⚡ Socket client connected:', socket.id);

  // User selecting/locking a slot temporarily
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

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/players', require('./routes/players'));
app.use('/api/venues', require('./routes/venues'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/matches', require('./routes/matches'));
app.use('/api/connections', require('./routes/connections'));

// Serve client in production
const clientBuildPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientBuildPath));

app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientBuildPath, 'index.html'), (err) => {
    if (err) next();
  });
});

// Persistent database in production; optional temporary database for local demos.
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/football_db';
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    try {
      await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: isProduction ? 15000 : 2000 });
      console.log('Connected to MongoDB.');
    } catch (err) {
      if (isProduction || process.env.ALLOW_MEMORY_DB !== 'true') {
        throw new Error('MongoDB connection failed. Check MONGO_URI, database credentials and Atlas Network Access.');
      }
      console.log('⚠️ Local MongoDB not running on 27017. Starting zero-config MongoMemoryServer fallback...');
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      const memoryUri = mongod.getUri();
      await mongoose.connect(memoryUri);
      console.log('✅ Connected to MongoDB Memory Server at', memoryUri);
    }

    // Seed sample data
    if (process.env.SEED_DEMO_DATA === 'true') await seedData();
    // Ensure the unique slot index exists before accepting concurrent bookings.
    await require('./models/Booking').init();

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
