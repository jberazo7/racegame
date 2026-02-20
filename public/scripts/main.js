const socket = io();

const qrCodeEl = document.getElementById('qr-code');
const mobileUrlEl = document.getElementById('mobile-url');
const gameStatusEl = document.getElementById('game-status');
const horsesContainer = document.getElementById('horses-container');
const startBtn = document.getElementById('start-btn');
const resetBtn = document.getElementById('reset-btn');
const winnerModal = document.getElementById('winner-modal');
const winnerNameEl = document.getElementById('winner-name');
const closeModalBtn = document.getElementById('close-modal-btn');

let players = [];

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
  updatePlayersDisplay();
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
  gameStatusEl.textContent = 'Race in progress! 🏁';
  startBtn.disabled = true;
});

socket.on('race-finished', ({ winner }) => {
  gameStatusEl.textContent = `Race finished! Winner: ${winner.name} 🏆`;
  winnerNameEl.textContent = winner.name;
  winnerModal.classList.remove('hidden');
  startBtn.disabled = false;
});

socket.on('game-reset', () => {
  gameStatusEl.textContent = 'Waiting for players...';
  startBtn.disabled = false;
  winnerModal.classList.add('hidden');
  players.forEach(player => player.position = 0);
  updatePlayersDisplay();
});

// UI functions
function updatePlayersDisplay() {
  horsesContainer.innerHTML = '';
  
  if (players.length === 0) {
    horsesContainer.innerHTML = '<p style="color: #666; text-align: center; padding: 40px;">No players yet. Scan the QR code to join!</p>';
    return;
  }
  
  players.forEach(player => {
    const lane = document.createElement('div');
    lane.className = 'horse-lane';
    lane.innerHTML = `
      <div class="horse-info" style="color: ${player.color}">
        ${player.name}
      </div>
      <div class="horse-track">
        <div class="horse" id="horse-${player.id}" style="left: 0%">🏇</div>
      </div>
    `;
    horsesContainer.appendChild(lane);
  });
}

function updateHorsePosition(playerId, position) {
  const horseEl = document.getElementById(`horse-${playerId}`);
  if (horseEl) {
    const percentage = Math.min(position, 100);
    horseEl.style.left = `${percentage}%`;
  }
}

function updateGameStatus() {
  if (players.length === 0) {
    gameStatusEl.textContent = 'Waiting for players...';
  } else {
    gameStatusEl.textContent = `${players.length} player${players.length !== 1 ? 's' : ''} ready`;
  }
}

// Button handlers
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
