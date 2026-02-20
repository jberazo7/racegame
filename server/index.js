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
const bettors = new Map();
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
  socket.on('join', ({ name, mode }) => {
    if (mode === 'racer') {
      const player = {
        id: socket.id,
        name: name,
        position: 0,
        color: generateColor(players.size),
        mode: 'racer'
      };
      players.set(socket.id, player);
      
      socket.emit('joined', { playerId: socket.id, color: player.color, mode: 'racer' });
      io.emit('players-update', Array.from(players.values()));
      console.log(`Racer joined: ${name}`);
    } else {
      const bettor = {
        id: socket.id,
        name: name,
        mode: 'bettor',
        bet: null
      };
      bettors.set(socket.id, bettor);
      
      socket.emit('joined', { playerId: socket.id, mode: 'bettor' });
      io.emit('bettors-update', Array.from(bettors.values()));
      console.log(`Bettor joined: ${name}`);
    }
  });

  // Get racers list for betting
  socket.on('get-racers', () => {
    socket.emit('racers-list', Array.from(players.values()));
  });

  // Place bet
  socket.on('place-bet', (racerId) => {
    const bettor = bettors.get(socket.id);
    if (bettor) {
      bettor.bet = racerId;
      console.log(`${bettor.name} bet on racer ${racerId}`);
    }
  });

  // Player taps
  socket.on('tap', () => {
    if (gameState !== 'racing') return;
    
    const player = players.get(socket.id);
    if (player) {
      player.position += 1;
      io.emit('position-update', { playerId: socket.id, position: player.position });
      
      // Calculate and broadcast odds
      const odds = calculateOdds();
      io.emit('odds-update', odds);
      
      // Check for winner (finish line at position 100)
      if (player.position >= 100 && gameState === 'racing') {
        gameState = 'finished';
        io.emit('race-finished', { winner: player });
      }
    }
  });

  // Calculate real-time odds based on positions
  function calculateOdds() {
    const playerArray = Array.from(players.values());
    const totalProgress = playerArray.reduce((sum, p) => sum + p.position, 0);
    
    if (totalProgress === 0) {
      return playerArray.map(p => ({ name: p.name, position: 0, color: p.color }));
    }
    
    return playerArray.map(p => ({
      name: p.name,
      position: Math.round((p.position / totalProgress) * 100),
      color: p.color
    })).sort((a, b) => b.position - a.position);
  }

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
    const wasPlayer = players.delete(socket.id);
    const wasBettor = bettors.delete(socket.id);
    
    if (wasPlayer) {
      io.emit('players-update', Array.from(players.values()));
    }
    if (wasBettor) {
      io.emit('bettors-update', Array.from(bettors.values()));
    }
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
