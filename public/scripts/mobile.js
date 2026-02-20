const socket = io();

const joinScreen = document.getElementById('join-screen');
const modeSelectionScreen = document.getElementById('mode-selection-screen');
const bettingScreen = document.getElementById('betting-screen');
const waitingScreen = document.getElementById('waiting-screen');
const bettingWaitingScreen = document.getElementById('betting-waiting-screen');
const racingScreen = document.getElementById('racing-screen');
const bettingRaceScreen = document.getElementById('betting-race-screen');
const finishedScreen = document.getElementById('finished-screen');
const betResultScreen = document.getElementById('bet-result-screen');

const playerNameInput = document.getElementById('player-name');
const joinBtn = document.getElementById('join-btn');
const raceModeBtn = document.getElementById('race-mode-btn');
const betModeBtn = document.getElementById('bet-mode-btn');
const bettingCards = document.getElementById('betting-cards');
const confirmBetBtn = document.getElementById('confirm-bet-btn');
const playerColorIndicator = document.getElementById('player-color-indicator');
const playerNameDisplay = document.getElementById('player-name-display');
const betHorseDisplay = document.getElementById('bet-horse-display');
const raceBetDisplay = document.getElementById('race-bet-display');
const tapButton = document.getElementById('tap-button');
const tapCount = document.getElementById('tap-count');
const resultMessage = document.getElementById('result-message');
const betResultTitle = document.getElementById('bet-result-title');
const betResultMessage = document.getElementById('bet-result-message');

let playerId = null;
let playerColor = null;
let playerName = '';
let playerMode = null; // 'racer' or 'bettor'
let selectedBet = null;
let taps = 0;
let availableRacers = [];

// Join game - step 1: enter name
joinBtn.addEventListener('click', () => {
  const name = playerNameInput.value.trim();
  if (name) {
    playerName = name;
    showScreen(modeSelectionScreen);
  }
});

playerNameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    joinBtn.click();
  }
});

// Mode selection
raceModeBtn.addEventListener('click', () => {
  playerMode = 'racer';
  socket.emit('join', { name: playerName, mode: 'racer' });
});

betModeBtn.addEventListener('click', () => {
  playerMode = 'bettor';
  socket.emit('join', { name: playerName, mode: 'bettor' });
});

// Socket event handlers
socket.on('joined', ({ playerId: id, color, mode }) => {
  playerId = id;
  playerColor = color;
  
  if (mode === 'racer') {
    playerColorIndicator.style.backgroundColor = color;
    playerNameDisplay.textContent = playerName;
    showScreen(waitingScreen);
  } else {
    // Bettor - request available racers
    socket.emit('get-racers');
  }
});

socket.on('racers-list', (racers) => {
  availableRacers = racers;
  displayBettingCards(racers);
  showScreen(bettingScreen);
});

socket.on('race-started', () => {
  if (playerMode === 'racer') {
    taps = 0;
    tapCount.textContent = 'Taps: 0';
    showScreen(racingScreen);
  } else {
    showScreen(bettingRaceScreen);
  }
});

socket.on('race-finished', ({ winner }) => {
  if (playerMode === 'racer') {
    const isWinner = winner.id === playerId;
    resultMessage.textContent = isWinner ? '🏆 You Won!' : `${winner.name} won!`;
    resultMessage.style.color = isWinner ? '#FFD700' : '#fff';
    showScreen(finishedScreen);
  } else {
    // Bettor result
    const wonBet = selectedBet && selectedBet.id === winner.id;
    betResultTitle.textContent = wonBet ? '🎉 You Won!' : '😔 You Lost';
    betResultTitle.style.color = wonBet ? '#FFD700' : '#fff';
    betResultMessage.textContent = `${winner.name} won the race!`;
    betResultMessage.style.color = wonBet ? '#4CAF50' : '#ff6b6b';
    showScreen(betResultScreen);
  }
});

socket.on('game-reset', () => {
  taps = 0;
  selectedBet = null;
  if (playerMode === 'racer') {
    showScreen(waitingScreen);
  } else {
    socket.emit('get-racers');
  }
});

// Betting card selection
function displayBettingCards(racers) {
  bettingCards.innerHTML = '';
  
  if (racers.length === 0) {
    bettingCards.innerHTML = '<p style="color: #666; grid-column: 1/-1;">No racers yet. Wait for players to join as racers!</p>';
    return;
  }
  
  racers.forEach(racer => {
    const card = document.createElement('div');
    card.className = 'betting-card';
    card.innerHTML = `
      <div class="horse-emoji">🏇</div>
      <div class="horse-name">${racer.name}</div>
      <div class="horse-rider" style="color: ${racer.color}">●</div>
    `;
    card.addEventListener('click', () => selectBet(racer, card));
    bettingCards.appendChild(card);
  });
}

function selectBet(racer, cardElement) {
  // Remove previous selection
  document.querySelectorAll('.betting-card').forEach(c => c.classList.remove('selected'));
  
  // Select new
  cardElement.classList.add('selected');
  selectedBet = racer;
  confirmBetBtn.disabled = false;
}

confirmBetBtn.addEventListener('click', () => {
  if (selectedBet) {
    socket.emit('place-bet', selectedBet.id);
    
    // Display bet
    betHorseDisplay.innerHTML = `
      <div class="horse-emoji">🏇</div>
      <div class="horse-name">${selectedBet.name}</div>
    `;
    raceBetDisplay.innerHTML = betHorseDisplay.innerHTML;
    
    showScreen(bettingWaitingScreen);
  }
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
  [joinScreen, modeSelectionScreen, bettingScreen, waitingScreen, 
   bettingWaitingScreen, racingScreen, bettingRaceScreen, 
   finishedScreen, betResultScreen].forEach(s => {
    s.classList.add('hidden');
  });
  screen.classList.remove('hidden');
}
