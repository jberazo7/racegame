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
const oddsDisplay = document.getElementById('odds-display');
const oddsDisplayBetting = document.getElementById('odds-display-betting');

let playerId = null;
let playerColor = null;
let playerName = '';
let playerMode = null; // 'racer' or 'bettor'
let selectedBet = null;
let taps = 0;
let availableRacers = [];
let currentOdds = [];

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
    
    // Confetti for winner
    if (isWinner) {
      setTimeout(() => createConfetti(document.body), 100);
    }
  } else {
    // Bettor result
    const wonBet = selectedBet && selectedBet.id === winner.id;
    betResultTitle.textContent = wonBet ? '🎉 You Won 100,000 Points!' : '😔 You Lost';
    betResultTitle.style.color = wonBet ? '#FFD700' : '#fff';
    betResultMessage.textContent = `${winner.name} won the race!`;
    betResultMessage.style.color = wonBet ? '#4CAF50' : '#ff6b6b';
    showScreen(betResultScreen);
    
    // Confetti for winning bet
    if (wonBet) {
      setTimeout(() => createConfetti(document.body), 100);
    }
  }
});

socket.on('odds-update', (odds) => {
  currentOdds = odds;
  updateOddsDisplay();
  updateBettingCardsOdds();
});

function updateOddsDisplay() {
  if (!oddsDisplay && !oddsDisplayBetting) return;
  
  // Create bar visualization
  const barHtml = `
    <div class="odds-title">🏁 Live Race Odds</div>
    <div class="odds-bar-container">
      ${currentOdds.map(o => 
        `<div class="odds-segment" style="width: ${o.position}%; background-color: ${o.color}">
          ${o.position > 10 ? o.position + '%' : ''}
        </div>`
      ).join('')}
    </div>
    <div class="odds-list">
      ${currentOdds.map(o => 
        `<span class="odds-item">
          <span class="odds-name" style="color: ${o.color}">●</span>
          <span class="odds-name">${o.name}</span>
          <span class="odds-value">${o.position}%</span>
        </span>`
      ).join('')}
    </div>
  `;
  
  if (oddsDisplay) oddsDisplay.innerHTML = barHtml || '<div class="odds-title">Waiting for race data...</div>';
  if (oddsDisplayBetting) oddsDisplayBetting.innerHTML = barHtml || '<div class="odds-title">Waiting for race data...</div>';
}

function updateBettingCardsOdds() {
  if (!currentOdds || currentOdds.length === 0) return;
  
  // Update odds on betting cards during race
  currentOdds.forEach(odds => {
    const cards = document.querySelectorAll('.betting-card');
    cards.forEach(card => {
      const nameEl = card.querySelector('.horse-name');
      if (nameEl && nameEl.textContent === odds.name) {
        let oddsEl = card.querySelector('.horse-odds');
        if (!oddsEl) {
          oddsEl = document.createElement('div');
          oddsEl.className = 'horse-odds';
          nameEl.parentNode.insertBefore(oddsEl, nameEl.nextSibling);
        }
        oddsEl.textContent = `${odds.position}% chance`;
      }
    });
  });
}

socket.on('game-reset', () => {
  taps = 0;
  selectedBet = null;
  if (playerMode === 'racer') {
    showScreen(waitingScreen);
  } else {
    socket.emit('get-racers');
  }
});

// Betting card selection with horse images
const horseImages = [
  'https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1551884170-09fb70a3a2ed?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1598632640487-6ea4a4e8b963?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1596464716127-f2a82984de30?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1568572933382-74d440642117?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1449034446853-66c86144b0ad?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?w=400&h=300&fit=crop&sat=-100',
  'https://images.unsplash.com/photo-1551884170-09fb70a3a2ed?w=400&h=300&fit=crop&sat=-100',
  'https://images.unsplash.com/photo-1598632640487-6ea4a4e8b963?w=400&h=300&fit=crop&sat=-100',
  'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&h=300&fit=crop&sat=-100',
  'https://images.unsplash.com/photo-1596464716127-f2a82984de30?w=400&h=300&fit=crop&sat=-100',
  'https://images.unsplash.com/photo-1568572933382-74d440642117?w=400&h=300&fit=crop&sat=-100',
  'https://images.unsplash.com/photo-1449034446853-66c86144b0ad?w=400&h=300&fit=crop&sat=-100',
  'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=400&h=300&fit=crop&sat=-100'
];

function displayBettingCards(racers) {
  bettingCards.innerHTML = '';
  
  if (racers.length === 0) {
    bettingCards.innerHTML = '<p style="color: #666; grid-column: 1/-1;">No racers yet. Wait for players to join as racers!</p>';
    return;
  }
  
  racers.forEach((racer, index) => {
    const card = document.createElement('div');
    card.className = 'betting-card';
    const imageUrl = horseImages[index % horseImages.length];
    card.innerHTML = `
      <div class="horse-image" style="background-image: url('${imageUrl}')"></div>
      <div class="horse-name">${racer.name}</div>
      <div class="horse-color-indicator" style="background-color: ${racer.color}"></div>
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

// Tap handling - use touchstart for better mobile response
let isTapping = false;

function handleTap(e) {
  e.preventDefault();
  if (isTapping) return;
  
  isTapping = true;
  socket.emit('tap');
  taps++;
  tapCount.textContent = `Taps: ${taps}`;
  
  // Visual feedback
  tapButton.style.transform = 'scale(0.92)';
  setTimeout(() => {
    tapButton.style.transform = 'scale(1)';
    isTapping = false;
  }, 50);
}

tapButton.addEventListener('touchstart', handleTap, { passive: false });
tapButton.addEventListener('click', (e) => {
  if (!isTapping) {
    handleTap(e);
  }
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
