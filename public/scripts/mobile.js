const socket = io();

const joinScreen = document.getElementById('join-screen');
const modeSelectionScreen = document.getElementById('mode-selection-screen');
const bettingScreen = document.getElementById('betting-screen');
const waitingScreen = document.getElementById('waiting-screen');
const bettingWaitingScreen = document.getElementById('betting-waiting-screen');
const bettingReadyScreen = document.getElementById('betting-ready-screen');
const racingScreen = document.getElementById('racing-screen');
const bettingRaceScreen = document.getElementById('betting-race-screen');
const finishedScreen = document.getElementById('finished-screen');
const betResultScreen = document.getElementById('bet-result-screen');

const playerNameInput = document.getElementById('player-name');
const joinBtn = document.getElementById('join-btn');
const raceModeBtn = document.getElementById('race-mode-btn');
const betModeBtn = document.getElementById('bet-mode-btn');
const bettingCardsTop3 = document.getElementById('betting-cards-top3');
const bettingCardsLast = document.getElementById('betting-cards-last');
const confirmBetBtn = document.getElementById('confirm-bet-btn');
const playerColorIndicator = document.getElementById('player-color-indicator');
const playerNameDisplay = document.getElementById('player-name-display');
const betSummaryDisplay = document.getElementById('bet-summary-display');
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
let selectedTop3 = []; // Array of {id, name, color} in order
let selectedLast = null; // {id, name, color}
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
  
  console.log('Joined as:', mode);
  
  if (mode === 'racer') {
    playerColorIndicator.style.backgroundColor = color;
    playerNameDisplay.textContent = playerName;
    showScreen(waitingScreen);
  } else {
    // Bettor - show waiting screen until racers locked
    console.log('Showing betting waiting screen');
    showScreen(bettingWaitingScreen);
  }
});

socket.on('racers-locked', (racers) => {
  console.log('Racers locked, received:', racers.length, 'racers');
  if (playerMode === 'bettor') {
    availableRacers = racers;
    displayBettingCards(racers);
    showScreen(bettingScreen);
  }
});

socket.on('countdown-start', () => {
  // Show countdown on mobile
  if (playerMode === 'racer') {
    showScreen(racingScreen);
    tapCount.textContent = 'Get ready...';
    tapButton.style.pointerEvents = 'none';
    
    let count = 3;
    const countdownInterval = setInterval(() => {
      tapCount.textContent = count > 0 ? count : 'GO!';
      count--;
      
      if (count < 0) {
        clearInterval(countdownInterval);
        tapButton.style.pointerEvents = 'auto';
        taps = 0;
        tapCount.textContent = 'Taps: 0';
      }
    }, 1000);
  } else {
    showScreen(bettingRaceScreen);
  }
});

socket.on('race-started', () => {
  // Race actually started after countdown
  if (playerMode === 'racer') {
    tapButton.style.pointerEvents = 'auto';
  }
});

socket.on('race-finished', ({ winner, results, betResults }) => {
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
    // Bettor result with comparison table
    const myResult = betResults.find(r => r.bettorId === playerId);
    const myBets = Array.from(bettors.values()).find(b => b.id === playerId)?.bets;
    
    if (myResult && myResult.totalPoints > 0) {
      betResultTitle.textContent = `🎉 You Won ${myResult.totalPoints.toLocaleString()} Points!`;
      betResultTitle.style.color = '#FFD700';
      
      let breakdown = '<div class="bet-breakdown">';
      if (myResult.correctTop3 > 0) {
        breakdown += `<div>✅ ${myResult.correctTop3} correct in top 3</div>`;
      }
      if (myResult.correctLast) {
        breakdown += `<div>✅ Last place correct!</div>`;
      }
      breakdown += '</div>';
      
      // Comparison table
      const comparisonTable = createComparisonTable(myBets, results);
      
      betResultMessage.innerHTML = `${breakdown}${comparisonTable}`;
      betResultMessage.style.color = '#4CAF50';
      
      setTimeout(() => createConfetti(document.body), 100);
    } else {
      betResultTitle.textContent = '😔 No Correct Predictions';
      betResultTitle.style.color = '#fff';
      
      const comparisonTable = createComparisonTable(myBets, results);
      betResultMessage.innerHTML = comparisonTable;
      betResultMessage.style.color = '#ff6b6b';
    }
    
    showScreen(betResultScreen);
  }
});

function createComparisonTable(myBets, results) {
  if (!myBets) return '';
  
  const myTop3 = myBets.top3 || [];
  const myLast = myBets.last;
  
  // Get names from IDs
  const getNameById = (id) => {
    const racer = availableRacers.find(r => r.id === id);
    return racer ? racer.name : 'Unknown';
  };
  
  let table = '<div class="comparison-table">';
  table += '<table><tr><th>Position</th><th>Your Pick</th><th>Actual</th></tr>';
  
  // Top 3
  for (let i = 0; i < 3; i++) {
    const yourPick = myTop3[i] ? getNameById(myTop3[i]) : '-';
    const actual = results[i] ? results[i].name : '-';
    const isCorrect = myTop3[i] === results[i]?.id;
    const rowClass = isCorrect ? 'correct-row' : '';
    table += `<tr class="${rowClass}"><td>${i + 1}${i === 0 ? 'st' : i === 1 ? 'nd' : 'rd'}</td><td>${yourPick}</td><td>${actual}</td></tr>`;
  }
  
  // Last place
  const yourLastPick = myLast ? getNameById(myLast) : '-';
  const actualLast = results[results.length - 1]?.name || '-';
  const isLastCorrect = myLast === results[results.length - 1]?.id;
  const lastRowClass = isLastCorrect ? 'correct-row' : '';
  table += `<tr class="${lastRowClass}"><td>Last</td><td>${yourLastPick}</td><td>${actualLast}</td></tr>`;
  
  table += '</table></div>';
  return table;
}

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
  selectedTop3 = [];
  selectedLast = null;
  if (playerMode === 'racer') {
    showScreen(waitingScreen);
  } else {
    showScreen(bettingWaitingScreen);
  }
});

// Betting card selection with horse images
const horseImages = [
  '/images/horses/horse1.jpg',
  '/images/horses/horse-2.jpg',
  '/images/horses/horse-3.jpg',
  '/images/horses/horse-4.jpg',
  '/images/horses/horse-5.jpg',
  '/images/horses/horse-6.jpg',
  '/images/horses/horse-7.jpg',
  '/images/horses/horse-8.jpg',
  '/images/horses/horse-9.jpg',
  '/images/horses/horse-10.jpg',
  '/images/horses/horse-11.jpg',
  '/images/horses/horse-12.jpg',
  '/images/horses/horse-13.jpg',
  '/images/horses/horse-14.jpg'
];

function displayBettingCards(racers) {
  bettingCardsTop3.innerHTML = '';
  bettingCardsLast.innerHTML = '';
  
  if (racers.length === 0) {
    bettingCardsTop3.innerHTML = '<p style="color: #666; grid-column: 1/-1;">No racers yet. Wait for players to join as racers!</p>';
    return;
  }
  
  racers.forEach((racer, index) => {
    // Top 3 cards
    const cardTop3 = createBettingCard(racer, index, 'top3');
    bettingCardsTop3.appendChild(cardTop3);
    
    // Last place cards
    const cardLast = createBettingCard(racer, index, 'last');
    bettingCardsLast.appendChild(cardLast);
  });
}

function createBettingCard(racer, index, type) {
  const card = document.createElement('div');
  card.className = 'betting-card';
  card.dataset.racerId = racer.id;
  card.dataset.type = type;
  const imageUrl = horseImages[index % horseImages.length];
  
  card.innerHTML = `
    <div class="selection-badge"></div>
    <div class="horse-image" style="background-image: url('${imageUrl}')">
      <div class="horse-emoji-fallback">🏇</div>
    </div>
    <div class="horse-name">${racer.name}</div>
    <div class="horse-color-indicator" style="background-color: ${racer.color}"></div>
  `;
  
  card.addEventListener('click', () => handleCardSelection(racer, card, type));
  return card;
}

function handleCardSelection(racer, cardElement, type) {
  if (type === 'top3') {
    // Check if already selected
    const existingIndex = selectedTop3.findIndex(s => s.id === racer.id);
    
    if (existingIndex !== -1) {
      // Deselect
      selectedTop3.splice(existingIndex, 1);
    } else {
      // Check if can add more
      if (selectedTop3.length >= 3) {
        return; // Max 3 selections
      }
      // Check if already selected in last place
      if (selectedLast && selectedLast.id === racer.id) {
        return; // Can't select same horse twice
      }
      selectedTop3.push(racer);
    }
  } else {
    // Last place selection
    if (selectedLast && selectedLast.id === racer.id) {
      // Deselect
      selectedLast = null;
    } else {
      // Check if already in top 3
      if (selectedTop3.some(s => s.id === racer.id)) {
        return; // Can't select same horse twice
      }
      selectedLast = racer;
    }
  }
  
  updateCardVisuals();
  updateConfirmButton();
}

function updateCardVisuals() {
  // Update top 3 cards
  document.querySelectorAll('[data-type="top3"]').forEach(card => {
    const racerId = card.dataset.racerId;
    const index = selectedTop3.findIndex(s => s.id === racerId);
    const badge = card.querySelector('.selection-badge');
    
    if (index !== -1) {
      card.classList.add('selected');
      badge.textContent = index + 1;
      badge.style.display = 'flex';
    } else {
      card.classList.remove('selected');
      badge.style.display = 'none';
    }
  });
  
  // Update last place cards
  document.querySelectorAll('[data-type="last"]').forEach(card => {
    const racerId = card.dataset.racerId;
    const badge = card.querySelector('.selection-badge');
    
    if (selectedLast && selectedLast.id === racerId) {
      card.classList.add('selected-last');
      badge.textContent = '❌';
      badge.style.display = 'flex';
    } else {
      card.classList.remove('selected-last');
      badge.style.display = 'none';
    }
  });
}

function updateConfirmButton() {
  // Enable if at least one selection made
  confirmBetBtn.disabled = selectedTop3.length === 0 && !selectedLast;
}

confirmBetBtn.addEventListener('click', () => {
  const bets = {
    top3: selectedTop3.map(s => s.id),
    last: selectedLast ? selectedLast.id : null
  };
  
  socket.emit('place-bet', bets);
  
  // Display bet summary
  displayBetSummary();
  showScreen(bettingReadyScreen);
});

function displayBetSummary() {
  let html = '';
  
  if (selectedTop3.length > 0) {
    html += '<div class="bet-summary-section"><strong>Top 3:</strong><br>';
    selectedTop3.forEach((racer, i) => {
      html += `${i + 1}. ${racer.name}<br>`;
    });
    html += '</div>';
  }
  
  if (selectedLast) {
    html += `<div class="bet-summary-section"><strong>Last Place:</strong><br>${selectedLast.name}</div>`;
  }
  
  betSummaryDisplay.innerHTML = html;
  raceBetDisplay.innerHTML = html;
}

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
   bettingWaitingScreen, bettingReadyScreen, racingScreen, bettingRaceScreen, 
   finishedScreen, betResultScreen].forEach(s => {
    s.classList.add('hidden');
  });
  screen.classList.remove('hidden');
}
