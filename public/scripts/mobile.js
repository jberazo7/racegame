const socket = io();

const joinScreen = document.getElementById('join-screen');
const waitingScreen = document.getElementById('waiting-screen');
const racingScreen = document.getElementById('racing-screen');
const finishedScreen = document.getElementById('finished-screen');

const playerNameInput = document.getElementById('player-name');
const joinBtn = document.getElementById('join-btn');
const playerColorIndicator = document.getElementById('player-color-indicator');
const playerNameDisplay = document.getElementById('player-name-display');
const tapButton = document.getElementById('tap-button');
const tapCount = document.getElementById('tap-count');
const resultMessage = document.getElementById('result-message');

let playerId = null;
let playerColor = null;
let taps = 0;

// Join game
joinBtn.addEventListener('click', () => {
  const name = playerNameInput.value.trim();
  if (name) {
    socket.emit('join', name);
  }
});

playerNameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    joinBtn.click();
  }
});

// Socket event handlers
socket.on('joined', ({ playerId: id, color }) => {
  playerId = id;
  playerColor = color;
  playerColorIndicator.style.backgroundColor = color;
  playerNameDisplay.textContent = playerNameInput.value;
  
  showScreen(waitingScreen);
});

socket.on('race-started', () => {
  taps = 0;
  tapCount.textContent = 'Taps: 0';
  showScreen(racingScreen);
});

socket.on('race-finished', ({ winner }) => {
  const isWinner = winner.id === playerId;
  resultMessage.textContent = isWinner ? '🏆 You Won!' : `${winner.name} won!`;
  resultMessage.style.color = isWinner ? '#FFD700' : '#fff';
  showScreen(finishedScreen);
});

socket.on('game-reset', () => {
  taps = 0;
  showScreen(waitingScreen);
});

// Tap handling
tapButton.addEventListener('click', () => {
  socket.emit('tap');
  taps++;
  tapCount.textContent = `Taps: ${taps}`;
  
  // Visual feedback
  tapButton.style.transform = 'scale(0.9)';
  setTimeout(() => {
    tapButton.style.transform = 'scale(1)';
  }, 100);
});

// Prevent double-tap zoom on iOS
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouchEnd <= 300) {
    e.preventDefault();
  }
  lastTouchEnd = now;
}, false);

// Helper function
function showScreen(screen) {
  [joinScreen, waitingScreen, racingScreen, finishedScreen].forEach(s => {
    s.classList.add('hidden');
  });
  screen.classList.remove('hidden');
}
