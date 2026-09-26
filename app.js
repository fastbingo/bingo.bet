/**
 * 75-BALL BINGOMANIA TELEGRAM MINI APP ENGINE
 * Features: Auto-daub toggle, Web Audio synthesizer, full line-check algorithms,
 * real-time WebSocket protocol, and Telegram WebApp integration.
 */

// CONFIGURATION
const CONFIG = {
  // Replace with your Cloudflare Worker URL
  WORKER_URL: "https://bingobet.ketiolcj.workers.dev"
};

// TELEGRAM MINI APP SDK INIT
const tg = window.Telegram?.WebApp;

if (tg) {
  tg.expand();
  tg.ready();
  if (tg.enableClosingConfirmation) tg.enableClosingConfirmation();
}

// APP GAME STATE
const TICKET_PRICE = 500;
const MAX_BALLS = 20;
const MAX_TICKETS = 4;

let ticketCount = 1;
let autoDaubEnabled = true;
let drawnBalls = [];
let userTickets = [];
let ws = null;

// TELEGRAM USER DETAILS
const user = tg?.initDataUnsafe?.user || {
  id: Math.floor(Math.random() * 1000000),
  first_name: "Player",
  photo_url: null
};

// INITIALIZATION
document.addEventListener("DOMContentLoaded", () => {
  const nameEl = document.getElementById("user-name");
  const avatarEl = document.getElementById("user-avatar");

  if (nameEl) nameEl.innerText = user.first_name;
  if (avatarEl && user.photo_url) avatarEl.src = user.photo_url;

  updatePurchaseSummary();
});

// AUDIO SYNTHESIZER (Web Audio API)
const AudioContextClass = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new AudioContextClass();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function playSound(type) {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;

    if (type === "daub") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === "ball") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.12);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === "win") {
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
        const nOsc = ctx.createOscillator();
        const nGain = ctx.createGain();
        nOsc.connect(nGain);
        nGain.connect(ctx.destination);
        nOsc.frequency.setValueAtTime(freq, now + idx * 0.1);
        nGain.gain.setValueAtTime(0.2, now + idx * 0.1);
        nGain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.1 + 0.3);
        nOsc.start(now + idx * 0.1);
        nOsc.stop(now + idx * 0.1 + 0.3);
      });
    }
  } catch (e) {
    console.warn("Audio Context blocked:", e);
  }
}

// TICKET GENERATION & DAUBING LOGIC
function changeTicketCount(delta) {
  ticketCount = Math.max(1, Math.min(MAX_TICKETS, ticketCount + delta));
  updatePurchaseSummary();
  if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred("light");
}

function updatePurchaseSummary() {
  document.getElementById("ticket-count-display").innerText = ticketCount;
  document.getElementById("total-cost-display").innerText = `${(ticketCount * TICKET_PRICE).toLocaleString()} PTS`;
}

function toggleAutoDaub(enabled) {
  autoDaubEnabled = enabled;
}

function getRandomUniqueNumbers(min, max, count) {
  const pool = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const result = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    result.push(pool.splice(idx, 1)[0]);
  }
  return result;
}

function generate75BallTicket(ticketId) {
  const b = getRandomUniqueNumbers(1, 15, 5);
  const i = getRandomUniqueNumbers(16, 30, 5);
  const n = getRandomUniqueNumbers(31, 45, 4);
  const g = getRandomUniqueNumbers(46, 60, 5);
  const o = getRandomUniqueNumbers(61, 75, 5);

  const nColumn = [n[0], n[1], "FREE", n[2], n[3]];
  const marked = Array(5).fill(null).map(() => Array(5).fill(false));
  marked[2][2] = true; // FREE Center space automatically marked

  return {
    id: ticketId,
    grid: { B: b, I: i, N: nColumn, G: g, O: o },
    marked: marked
  };
}

function confirmPurchase() {
  userTickets = [];
  for (let i = 0; i < ticketCount; i++) {
    userTickets.push(generate75BallTicket(i + 1));
  }

  document.getElementById("purchase-panel").classList.add("hidden");
  document.getElementById("tickets-container").classList.remove("hidden");
  document.getElementById("action-bar").classList.remove("hidden");

  renderTickets();
  connectWebSocket();

  if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");
}

function renderTickets() {
  const container = document.getElementById("tickets-container");
  if (!container) return;
  container.innerHTML = "";

  const cols = ["B", "I", "N", "G", "O"];

  userTickets.forEach((ticket, tIdx) => {
    const cardEl = document.createElement("div");
    cardEl.className = "bingo-card";

    let html = `
      <div class="card-header">
        <span>CARD #${ticket.id}</span>
        <span>STANDARD 5x5</span>
      </div>
      <div class="bingo-grid">
        <div class="grid-header">B</div>
        <div class="grid-header">I</div>
        <div class="grid-header">N</div>
        <div class="grid-header">G</div>
        <div class="grid-header">O</div>
    `;

    for (let row = 0; row < 5; row++) {
      for (let colIdx = 0; colIdx < 5; colIdx++) {
        const colName = cols[colIdx];
        const val = ticket.grid[colName][row];
        const isDaubed = ticket.marked[row][colIdx];
        const isFree = val === "FREE";
        const isCalledNotDaubed = !isDaubed && drawnBalls.includes(val);

        html += `
          <div class="grid-cell ${isDaubed ? "daubed" : ""} ${isFree ? "free" : ""} ${isCalledNotDaubed ? "pulse-highlight" : ""}"
               onclick="userToggleDaub(${tIdx}, ${row}, ${colIdx}, '${val}')">
            ${val}
          </div>
        `;
      }
    }

    html += `</div>`;
    cardEl.innerHTML = html;
    container.appendChild(cardEl);
  });
}

function userToggleDaub(tIdx, row, col, val) {
  if (val === "FREE") return;
  userTickets[tIdx].marked[row][col] = !userTickets[tIdx].marked[row][col];
  playSound("daub");
  if (tg?.HapticFeedback) tg.HapticFeedback.selectionChanged();
  renderTickets();
}

// WEBSOCKET & BALL PROCESSING ENGINE
function connectWebSocket() {
  let wsUrl = CONFIG.WORKER_URL.trim();
  if (wsUrl.startsWith("http://")) wsUrl = wsUrl.replace("http://", "ws://");
  else if (wsUrl.startsWith("https://")) wsUrl = wsUrl.replace("https://", "wss://");
  if (!wsUrl.endsWith("/ws")) wsUrl = wsUrl.replace(/\/$/, "") + "/ws";

  ws = new WebSocket(wsUrl);

  ws.onopen = () => console.log("WebSocket connected!");

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === "BALL_DRAWN") {
        if (drawnBalls.length < MAX_BALLS) {
          drawnBalls.push(data.ball);
          processDrawnBall(data.ball);
        }
      } else if (data.type === "CLAIM_RESULT") {
        if (data.success) {
          playSound("win");
          triggerConfetti();
          alert(`🎉 BINGO WINNER! ${data.message || ''}`);
        } else {
          alert(`❌ INVALID CLAIM: ${data.message || 'Check your lines!'}`);
        }
      }
    } catch (err) {
      console.error("WS Message Error:", err);
    }
  };

  ws.onclose = () => setTimeout(connectWebSocket, 3000);
}

function processDrawnBall(ball) {
  playSound("ball");
  if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred("medium");

  const cols = ["B", "I", "N", "G", "O"];

  // Perform Auto-Daubing if user enabled it
  if (autoDaubEnabled) {
    userTickets.forEach((ticket) => {
      cols.forEach((colName, cIdx) => {
        ticket.grid[colName].forEach((val, rIdx) => {
          if (val === ball) ticket.marked[rIdx][cIdx] = true;
        });
      });
    });
  }

  updateCallerUI(ball);
  renderTickets();
}

function updateCallerUI(ball) {
  const getLetter = (num) => {
    if (num <= 15) return "B";
    if (num <= 30) return "I";
    if (num <= 45) return "N";
    if (num <= 60) return "G";
    return "O";
  };

  const letter = getLetter(ball);
  const ballEl = document.getElementById("current-ball-el");
  const letterEl = document.getElementById("current-letter");
  const numEl = document.getElementById("current-number");
  const countBadge = document.getElementById("called-count-badge");
  const strip = document.getElementById("recent-balls-list");

  if (ballEl) ballEl.className = `giant-ball ${letter}`;
  if (letterEl) letterEl.innerText = letter;
  if (numEl) numEl.innerText = ball;
  if (countBadge) countBadge.innerText = `${drawnBalls.length} / ${MAX_BALLS} BALLS`;

  if (strip) {
    strip.innerHTML = drawnBalls
      .slice(-5)
      .reverse()
      .map((b) => `<div class="mini-ball">${b}</div>`)
      .join("");
  }
}

// WIN CHECKS & CLAIM LOGIC
function claimBingo() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: "CLAIM_BINGO",
      userId: user.id,
      tickets: userTickets,
      drawnBalls: drawnBalls
    }));
  } else {
    if (checkLocalBingo()) {
      playSound("win");
      triggerConfetti();
      alert("🎉 BINGO! Pattern validated offline!");
    } else {
      alert("❌ No complete line found! Check horizontal, vertical, or diagonal rows.");
    }
  }
}

function checkLocalBingo() {
  const cols = ["B", "I", "N", "G", "O"];

  return userTickets.some((ticket) => {
    // 1. Check Horizontal Rows
    for (let r = 0; r < 5; r++) {
      if ([0, 1, 2, 3, 4].every(c => isMarkedAndCalled(ticket, r, c, cols))) return true;
    }
    // 2. Check Vertical Columns
    for (let c = 0; c < 5; c++) {
      if ([0, 1, 2, 3, 4].every(r => isMarkedAndCalled(ticket, r, c, cols))) return true;
    }
    // 3. Check Main Diagonal (\)
    if ([0, 1, 2, 3, 4].every(i => isMarkedAndCalled(ticket, i, i, cols))) return true;
    // 4. Check Anti-Diagonal (/)
    if ([0, 1, 2, 3, 4].every(i => isMarkedAndCalled(ticket, i, 4 - i, cols))) return true;

    return false;
  });
}

function isMarkedAndCalled(ticket, r, c, cols) {
  const val = ticket.grid[cols[c]][r];
  const isMarked = ticket.marked[r][c];
  return val === "FREE" || (isMarked && drawnBalls.includes(val));
}

// CONFETTI ANIMATION
function triggerConfetti() {
  const canvas = document.getElementById("confetti-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = Array.from({ length: 90 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height - canvas.height,
    size: Math.random() * 8 + 4,
    color: ["#F59E0B", "#10B981", "#3B82F6", "#EF4444", "#8B5CF6"][Math.floor(Math.random() * 5)],
    vx: (Math.random() - 0.5) * 2,
    vy: Math.random() * 4 + 3,
    rot: Math.random() * 360
  }));

  const start = Date.now();
  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.rot += 3;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
      if (p.y > canvas.height) p.y = -10;
    });

    if (Date.now() - start < 3500) requestAnimationFrame(render);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  render();
}
