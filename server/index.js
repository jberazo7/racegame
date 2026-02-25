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
let gameState = 'waiting'; // waiting, racersLocked, racing, finished
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
        bets: null,
        confirmed: false
      };
      bettors.set(socket.id, bettor);
      
      socket.emit('joined', { playerId: socket.id, mode: 'bettor' });
      io.emit('bettors-update', Array.from(bettors.values()));
      
      // If racers already locked, send them immediately
      if (gameState === 'racersLocked' || gameState === 'racing') {
        socket.emit('racers-locked', Array.from(players.values()));
      }
      
      console.log(`Bettor joined: ${name}`);
    }
  });

  // Get racers list for betting
  socket.on('get-racers', () => {
    socket.emit('racers-list', Array.from(players.values()));
  });

  // Place bet
  socket.on('place-bet', (bets) => {
    const bettor = bettors.get(socket.id);
    if (bettor) {
      bettor.bets = bets; // { top3: [id1, id2, id3], last: id }
      bettor.confirmed = true;
      console.log(`${bettor.name} placed bets:`, bets);
      
      // Check if all bettors confirmed
      const allConfirmed = Array.from(bettors.values()).every(b => b.confirmed);
      if (allConfirmed && bettors.size > 0) {
        io.emit('all-bets-confirmed');
      }
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
      
      // Check for winner (finish line at position 300)
      if (player.position >= 300 && gameState === 'racing') {
        gameState = 'finished';
        
        // Calculate final results
        const results = Array.from(players.values())
          .sort((a, b) => b.position - a.position)
          .map(p => ({ id: p.id, name: p.name, position: p.position }));
        
        const winner = results[0];
        
        // Calculate betting results
        const betResults = calculateBettingResults(results);
        
        io.emit('race-finished', { winner, results, betResults });
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

  // Calculate betting results and distribute points
  function calculateBettingResults(results) {
    const TOTAL_POT = 100000;
    const betResults = [];
    
    // Points per correct prediction
    const POINTS_PER_TOP3 = 25000; // 25k per correct top 3 position
    const POINTS_LAST = 25000; // 25k for correct last place
    
    // Track how many got each prediction right
    const correctCounts = {
      first: 0,
      second: 0,
      third: 0,
      last: 0
    };
    
    // First pass: count correct predictions
    bettors.forEach(bettor => {
      if (!bettor.bets) return;
      
      const { top3, last } = bettor.bets;
      
      if (top3 && top3.length > 0) {
        if (top3[0] === results[0].id) correctCounts.first++;
        if (top3.length > 1 && top3[1] === results[1]?.id) correctCounts.second++;
        if (top3.length > 2 && top3[2] === results[2]?.id) correctCounts.third++;
      }
      
      if (last === results[results.length - 1]?.id) correctCounts.last++;
    });
    
    // Second pass: calculate points for each bettor
    bettors.forEach(bettor => {
      if (!bettor.bets) return;
      
      const { top3, last } = bettor.bets;
      let totalPoints = 0;
      let correctTop3 = 0;
      let correctLast = false;
      
      if (top3 && top3.length > 0) {
        if (top3[0] === results[0].id) {
          totalPoints += correctCounts.first > 0 ? POINTS_PER_TOP3 / correctCounts.first : 0;
          correctTop3++;
        }
        if (top3.length > 1 && top3[1] === results[1]?.id) {
          totalPoints += correctCounts.second > 0 ? POINTS_PER_TOP3 / correctCounts.second : 0;
          correctTop3++;
        }
        if (top3.length > 2 && top3[2] === results[2]?.id) {
          totalPoints += correctCounts.third > 0 ? POINTS_PER_TOP3 / correctCounts.third : 0;
          correctTop3++;
        }
      }
      
      if (last === results[results.length - 1]?.id) {
        totalPoints += correctCounts.last > 0 ? POINTS_LAST / correctCounts.last : 0;
        correctLast = true;
      }
      
      betResults.push({
        bettorId: bettor.id,
        bettorName: bettor.name,
        totalPoints: Math.round(totalPoints),
        correctTop3,
        correctLast
      });
    });
    
    return betResults;
  }

  // Start race
  socket.on('start-race', () => {
    if ((gameState === 'waiting' || gameState === 'racersLocked') && players.size > 0) {
      gameState = 'racing';
      raceStartTime = Date.now();
      
      // Reset all positions
      players.forEach(player => player.position = 0);
      
      // Start countdown
      io.emit('countdown-start');
      
      // Start race after countdown (3 seconds)
      setTimeout(() => {
        io.emit('race-started');
        console.log('Race started!');
      }, 3000);
    }
  });

  // Lock racers (when host goes to game view)
  socket.on('lock-racers', () => {
    if (gameState === 'waiting') {
      gameState = 'racersLocked';
      io.emit('racers-locked', Array.from(players.values()));
      console.log('Racers locked!');
    }
  });

  // Reset game
  socket.on('reset-game', () => {
    gameState = 'waiting';
    players.forEach(player => {
      player.position = 0;
    });
    bettors.forEach(bettor => {
      bettor.bets = null;
      bettor.confirmed = false;
    });
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
    '#F8B739', '#52B788', '#E63946', '#457B9D',
    '#FF8C42', '#6A4C93', '#1982C4', '#8AC926',
    '#FF595E', '#FFCA3A', '#8AC926', '#1982C4',
    '#6A4C93', '#C9ADA7', '#9A8C98', '#4A4E69'
  ];
  return colors[index % colors.length];
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Main display: http://${HOST}:${PORT}`);
  console.log(`Mobile controller: http://${HOST}:${PORT}/mobile`);
  console.log(`\nMake sure your phone is on the same WiFi network!`);
});
