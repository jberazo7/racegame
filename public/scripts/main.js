const socket = io();

const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const qrCodeEl = document.getElementById('qr-code');
const mobileUrlEl = document.getElementById('mobile-url');
const gameStatusEl = document.getElementById('game-status');
const raceStatusEl = document.getElementById('race-status');
const playersContainer = document.getElementById('players-container');
const horsesContainer = document.getElementById('horses-container');
const goToGameBtn = document.getElementById('go-to-game-btn');
const startBtn = document.getElementById('start-btn');
const resetBtn = document.getElementById('reset-btn');
const backToLobbyBtn = document.getElementById('back-to-lobby-btn');
const winnerModal = document.getElementById('winner-modal');
const winnerNameEl = document.getElementById('winner-name');
const closeModalBtn = document.getElementById('close-modal-btn');

let players = [];
let bettors = [];
let currentScreen = 'lobby';

// Load QR code
fetch('/qr')
  .then(res => res.json())
  .then(data => {
    qrCodeEl.innerHTML = `<img src="${data.qrCode}" alt="QR Code">`;
    mobileUrlEl.textContent = data.mobileUrl;
  });

// Socket event handlers
socket.on('players-update', (updatedPlayers) => {
  players = updatedPlayers;
  updateLobbyPlayers();
  updatePlayersDisplay();
  updateGameStatus();
});

socket.on('bettors-update', (updatedBettors) => {
  bettors = updatedBettors;
  updateLobbyPlayers();
  updateGameStatus();
});

socket.on('position-update', ({ playerId, position }) => {
  const player = players.find(p => p.id === playerId);
  if (player) {
    player.position = position;
    updateHorsePosition(playerId, position);
  }
});

socket.on('race-started', () => {
  raceStatusEl.textContent = 'Race in progress! 🏁';
  startBtn.disabled = true;
});

socket.on('race-finished', ({ winner, results, betResults }) => {
  raceStatusEl.textContent = `Race finished! Winner: ${winner.name} 🏆`;
  
  // Show final order
  let resultsHtml = `<h2>🏆 ${winner.name}</h2><br><strong>Final Order:</strong><br>`;
  results.forEach((r, i) => {
    resultsHtml += `${i + 1}. ${r.name}<br>`;
  });
  
  // Show betting results if any
  if (betResults && betResults.length > 0) {
    const winners = betResults.filter(b => b.totalPoints > 0);
    if (winners.length > 0) {
      resultsHtml += '<br><strong>Betting Winners:</strong><br>';
      winners.forEach(w => {
        resultsHtml += `${w.bettorName}: ${w.totalPoints.toLocaleString()} pts<br>`;
      });
    }
  }
  
  winnerNameEl.innerHTML = resultsHtml;
  winnerModal.classList.remove('hidden');
  startBtn.disabled = false;
  
  // Confetti with delay to ensure it shows
  setTimeout(() => createConfetti(document.body), 100);
});

socket.on('game-reset', () => {
  raceStatusEl.textContent = 'Ready to race!';
  startBtn.disabled = false;
  winnerModal.classList.add('hidden');
  players.forEach(player => player.position = 0);
  updatePlayersDisplay();
});

// UI functions
function updateLobbyPlayers() {
  playersContainer.innerHTML = '';
  
  const totalParticipants = players.length + bettors.length;
  
  if (totalParticipants === 0) {
    playersContainer.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">No players yet</p>';
    return;
  }
  
  // Show racers
  players.forEach(player => {
    const card = document.createElement('div');
    card.className = 'player-card';
    card.innerHTML = `
      <div class="player-color-dot" style="background-color: ${player.color}"></div>
      <div class="player-card-name">${player.name} 🏇</div>
    `;
    playersContainer.appendChild(card);
  });
  
  // Show bettors
  bettors.forEach(bettor => {
    const card = document.createElement('div');
    card.className = 'player-card';
    card.innerHTML = `
      <div class="player-color-dot" style="background: linear-gradient(135deg, #FFD700, #FFA500)">💰</div>
      <div class="player-card-name">${bettor.name}</div>
    `;
    playersContainer.appendChild(card);
  });
}

function updatePlayersDisplay() {
  if (currentScreen !== 'game') return;
  
  horsesContainer.innerHTML = '';
  
  if (players.length === 0) {
    horsesContainer.innerHTML = '<p style="color: #666; text-align: center; padding: 40px;">No players yet. Go back to lobby!</p>';
    return;
  }
  
  // Add size class based on player count
  horsesContainer.className = '';
  if (players.length <= 4) {
    horsesContainer.className = 'horses-container-small';
  } else if (players.length <= 10) {
    horsesContainer.className = 'horses-container-medium';
  } else {
    horsesContainer.className = 'horses-container-large';
  }
  
  players.forEach(player => {
    const lane = document.createElement('div');
    lane.className = 'horse-lane';
    lane.style.backgroundColor = lightenColor(player.color, 0.85);
    
    // Calculate max name width based on longest name
    const maxNameLength = Math.max(...players.map(p => p.name.length));
    const nameWidth = Math.max(120, Math.min(250, maxNameLength * 15));
    
    lane.innerHTML = `
      <div class="horse-info" style="color: ${player.color}; width: ${nameWidth}px;">
        ${player.name}
      </div>
      <div class="horse-track">
        <div class="horse" id="horse-${player.id}" style="left: 0%">🏇</div>
      </div>
    `;
    horsesContainer.appendChild(lane);
  });
}

function lightenColor(color, amount) {
  const num = parseInt(color.replace('#', ''), 16);
  const r = Math.min(255, Math.floor((num >> 16) + (255 - (num >> 16)) * amount));
  const g = Math.min(255, Math.floor(((num >> 8) & 0x00FF) + (255 - ((num >> 8) & 0x00FF)) * amount));
  const b = Math.min(255, Math.floor((num & 0x0000FF) + (255 - (num & 0x0000FF)) * amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function updateHorsePosition(playerId, position) {
  const horseEl = document.getElementById(`horse-${playerId}`);
  if (horseEl) {
    const percentage = Math.min((position / 300) * 100, 100);
    horseEl.style.left = `${percentage}%`;
    
    // Galloping animation - tilt up briefly
    horseEl.style.transform = 'translateY(-50%) scaleX(-1) rotate(-15deg)';
    setTimeout(() => {
      horseEl.style.transform = 'translateY(-50%) scaleX(-1) rotate(0deg)';
    }, 150);
  }
}

function updateGameStatus() {
  const totalParticipants = players.length + bettors.length;
  if (totalParticipants === 0) {
    gameStatusEl.textContent = 'Waiting for players...';
  } else {
    const parts = [];
    if (players.length > 0) parts.push(`${players.length} racer${players.length !== 1 ? 's' : ''}`);
    if (bettors.length > 0) parts.push(`${bettors.length} bettor${bettors.length !== 1 ? 's' : ''}`);
    gameStatusEl.textContent = parts.join(', ') + ' ready';
  }
}

// Button handlers
goToGameBtn.addEventListener('click', () => {
  currentScreen = 'game';
  lobbyScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');
  updatePlayersDisplay();
});

backToLobbyBtn.addEventListener('click', () => {
  currentScreen = 'lobby';
  gameScreen.classList.add('hidden');
  lobbyScreen.classList.remove('hidden');
});

startBtn.addEventListener('click', () => {
  if (players.length > 0) {
    socket.emit('start-race');
  }
});

resetBtn.addEventListener('click', () => {
  socket.emit('reset-game');
});

closeModalBtn.addEventListener('click', () => {
  winnerModal.classList.add('hidden');
});
