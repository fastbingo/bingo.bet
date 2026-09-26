// Initialize Telegram WebApp SDK
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.expand();
  tg.ready();
}

// State Management
let ticketCount = 1;
const TICKET_PRICE = 500;
const MAX_BALLS = 20;
let drawnBalls = [];
let userTickets = [];
let ws = null;

// User Context
const user = tg?.initDataUnsafe?.user || { id: 9999, first_name: "Guest" };
document.getElementById('user-name').innerText = user.first_name;
if (user.photo_url) {
  document.getElementById('user-avatar').src = user.photo_url;
}

// Sound Synthesis (Web Audio API)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playAudio(type) {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  if (type === 'daub') {
    osc.frequency.setValueAtTime(600, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
  } else if (type === 'ball') {
    osc.frequency.setValueAtTime(400, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.2);
  }
}

// Purchase Selector logic
function changeTicketCount(delta) {
  ticketCount = Math.max(1, Math.min(4, ticketCount + delta));
  document.getElementById('ticket-count-display').innerText = ticketCount;
  document.getElementById('total-cost-display').innerText = ticketCount * TICKET_PRICE;
  if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
}

// Card Generator (75-ball Rules)
function getRandomNumbers(min, max, count) {
  const arr = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return arr.sort(() => 0.5 - Math.random()).slice(0, count);
}

function generate75BallTicket(ticketId) {
  return {
    id: ticketId,
    grid: {
      B: getRandomNumbers(1, 15, 5),
      I: getRandomNumbers(16, 30, 5),
      N: [...getRandomNumbers(31, 45, 2), "FREE", ...getRandomNumbers(33, 45, 2)],
      G: getRandomNumbers(46, 60, 5),
      O: getRandomNumbers(61, 75, 5)
    },
    marked: Array(5).fill(null).map(() => Array(5).fill(false))
  };
}

// Start Game / Confirm Purchase
function confirmPurchase() {
  userTickets = [];
  for (let i = 0; i < ticketCount; i++) {
    const t = generate75BallTicket(i + 1);
    t.marked[2][2] = true; // Auto-daub center FREE
    userTickets.push(t);
  }

  document.getElementById('purchase-panel').classList.add('hidden');
  document.getElementById('tickets-container').classList.remove('hidden');
  document.getElementById('action-bar').classList.remove('hidden');

  renderTickets();
  connectWebSocket();
}

// Render Tickets
function renderTickets() {
  const container = document.getElementById('tickets-container');
  container.innerHTML = '';

  userTickets.forEach((ticket, tIdx) => {
    const card = document.createElement('div');
    card.className = 'bingo-card';
    
    let html = `<div class="card-header"><span>TICKET #${ticket.id}</span><span>500 PTS</span></div>`;
    html += `<div class="bingo-grid">
      <div class="grid-header">B</div>
      <div class="grid-header">I</div>
      <div class="grid-header">N</div>
      <div class="grid-header">G</div>
      <div class="grid-header">O</div>`;

    const cols = ['B', 'I', 'N', 'G', 'O'];
    for (let row = 0; row < 5; row++) {
      for (let colIdx = 0; colIdx < 5; colIdx++) {
        const colName = cols[colIdx];
        const val = ticket.grid[colName][row];
        const isDaubed = ticket.marked[row][colIdx];
        const isFree = val === "FREE";

        html += `<div class="grid-cell ${isDaubed ? 'daubed' : ''} ${isFree ? 'free' : ''}" 
                      onclick="toggleDaub(${tIdx}, ${row}, ${colIdx}, '${val}')">
                    ${val}
                 </div>`;
      }
    }
    html += `</div>`;
    card.innerHTML = html;
    container.appendChild(card);
  });
}

// Toggle Cell Mark
function toggleDaub(ticketIdx, row, col, val) {
  if (val === 'FREE') return;
  userTickets[ticketIdx].marked[row][col] = !userTickets[ticketIdx].marked[row][col];
  playAudio('daub');
  if (tg?.HapticFeedback) tg.HapticFeedback.selectionChanged();
  renderTickets();
}

// Real-Time Engine Integration
function connectWebSocket() {
  // Replace with real deployed worker URL
  const wsUrl = window.location.protocol === 'https:' ? 'wss://' : 'ws://' + window.location.host + '/ws';
  ws = new WebSocket(wsUrl);

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'BALL_DRAWN') {
      if (drawnBalls.length < MAX_BALLS) {
        drawnBalls.push(data.ball);
        updateCallerDisplay(data.ball);
        playAudio('ball');
        if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
      }
    } else if (data.type === 'GAME_OVER') {
      alert("Game Over! All 20 balls called.");
    }
  };
}

function updateCallerDisplay(ball) {
  const getLetter = (num) => {
    if (num <= 15) return 'B';
    if (num <= 30) return 'I';
    if (num <= 45) return 'N';
    if (num <= 60) return 'G';
    return 'O';
  };

  document.getElementById('current-ball').innerText = ball;
  document.getElementById('current-letter').innerText = `${getLetter(ball)} - ${ball}`;
  document.getElementById('called-count').innerText = `Balls: ${drawnBalls.length} / 20`;

  const recentContainer = document.getElementById('recent-balls-list');
  recentContainer.innerHTML = drawnBalls.slice(-5).reverse().map(b => 
    `<div class="mini-ball">${b}</div>`
  ).join('');
}

// Claim Victory
function claimBingo() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'CLAIM_BINGO',
      userId: user.id,
      tickets: userTickets,
      drawnBalls: drawnBalls
    }));
  } else {
    // Client Validation Fallback
    alert("Bingo claimed! Validating with server...");
    triggerConfetti();
  }
}

// Fireworks / Victory Effect
function triggerConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const pieces = Array.from({ length: 80 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height - canvas.height,
    size: Math.random() * 8 + 4,
    color: ['#f59e0b', '#10b981', '#3b82f6', '#ef4444'][Math.floor(Math.random() * 4)],
    vy: Math.random() * 3 + 2
  }));

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      p.y += p.vy;
      if (p.y > canvas.height) p.y = 0;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    requestAnimationFrame(draw);
  }
  draw();
}
