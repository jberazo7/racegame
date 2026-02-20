const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const QRCode = require('qrcode');
const path = require('path');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Get local network IP address
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const HOST = process.env.HOST || getLocalIP();

// Game state
const players = new Map();
let gameState = 'waiting'; // waiting, racing, finished
let raceStartTime = null;

app.use(express.static(path.join(__dirname, '../public')));

// Generate QR code for mobile URL
app.get('/qr', async (req, res) => {
  const host = req.get('host');
  const protocol = req.get('x-forwarded-proto') || req.protocol;
  const mobileUrl = `${protocol}://${host}/mobile`;
  try {
    const qrCode = await QRCode.toDataURL(mobileUrl, { width: 300, margin: 2 });
    res.json({ qrCode, mobileUrl });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Player joins
  socket.on('join', (playerName) => {
    const player = {
      id: socket.id,
      name: playerName,
      position: 0,
      color: generateColor(players.size)
    };
    players.set(socket.id, player);
    
    socket.emit('joined', { playerId: socket.id, color: player.color });
    io.emit('players-update', Array.from(players.values()));
    console.log(`Player joined: ${playerName}`);
  });

  // Player taps
  socket.on('tap', () => {
    if (gameState !== 'racing') return;
    
    const player = players.get(socket.id);
    if (player) {
      player.position += 1;
      io.emit('position-update', { playerId: socket.id, position: player.position });
      
      // Check for winner (finish line at position 100)
      if (player.position >= 100 && gameState === 'racing') {
        gameState = 'finished';
        io.emit('race-finished', { winner: player });
      }
    }
  });

  // Start race
  socket.on('start-race', () => {
    if (gameState === 'waiting' && players.size > 0) {
      gameState = 'racing';
      raceStartTime = Date.now();
      
      // Reset all positions
      players.forEach(player => player.position = 0);
      
      io.emit('race-started');
      console.log('Race started!');
    }
  });

  // Reset game
  socket.on('reset-game', () => {
    gameState = 'waiting';
    players.forEach(player => player.position = 0);
    io.emit('game-reset');
    io.emit('players-update', Array.from(players.values()));
    console.log('Game reset');
  });

  // Disconnect
  socket.on('disconnect', () => {
    players.delete(socket.id);
    io.emit('players-update', Array.from(players.values()));
    console.log('Client disconnected:', socket.id);
  });
});

// Generate distinct colors for players
function generateColor(index) {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', 
    '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
    '#F8B739', '#52B788', '#E63946', '#457B9D'
  ];
  return colors[index % colors.length];
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Main display: http://${HOST}:${PORT}`);
  console.log(`Mobile controller: http://${HOST}:${PORT}/mobile`);
  console.log(`\nMake sure your phone is on the same WiFi network!`);
});
