const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

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

// Pass io to app context so routes can emit events
app.set('io', io);

// Socket.io Real-Time Event Handling
io.on('connection', (socket) => {
  console.log('⚡ Socket client connected:', socket.id);

  // User selecting/locking a slot temporarily
  socket.on('select_slot', ({ venueId, date, timeSlot, user }) => {
    socket.broadcast.emit('slot_selecting', { venueId, date, timeSlot, user });
  });

  socket.on('deselect_slot', ({ venueId, date, timeSlot }) => {
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

// MongoDB Connection with Fast Fallback
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/football_db';
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    try {
      await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 2000 });
      console.log('✅ Connected to local MongoDB at', MONGO_URI);
    } catch (err) {
      console.log('⚠️ Local MongoDB not running on 27017. Starting zero-config MongoMemoryServer fallback...');
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      const memoryUri = mongod.getUri();
      await mongoose.connect(memoryUri);
      console.log('✅ Connected to MongoDB Memory Server at', memoryUri);
    }

    // Seed sample data
    await seedData();

    server.listen(PORT, () => {
      console.log(`🚀 Football Platform Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Fatal server startup error:', error);
  }
}

startServer();
