/**
 * 75-BALL BINGO TELEGRAM MINI APP (CLIENT ENGINE)
 * Full interactive game engine with Telegram SDK, dynamic WebSocket connection,
 * Web Audio sound effects, and canvas confetti animation.
 */

// =========================================================================
// ⚙️ CONFIGURATION: PASTE YOUR CLOUDFLARE WORKER / BACKEND URL HERE
// =========================================================================
const CONFIG = {
  // Replace with your actual Cloudflare Worker or Render WebSocket endpoint URL
  WORKER_URL: "https://bingobet.ketiolcj.workers.dev"
};

// ==========================================
// 1. TELEGRAM SDK & STATE INITIALIZATION
// ==========================================
const tg = window.Telegram?.WebApp;

if (tg) {
  tg.expand();
  tg.ready();
  if (tg.enableClosingConfirmation) {
    tg.enableClosingConfirmation();
  }
}

// Global Game Configuration & State
const TICKET_PRICE = 500;
const MAX_BALLS = 20;
const MAX_TICKETS = 4;

let ticketCount = 1;
let drawnBalls = [];
let userTickets = [];
let ws = null;

// Extract Telegram User Data or Fallback to Guest
const user = tg?.initDataUnsafe?.user || {
  id: Math.floor(Math.random() * 1000000),
  first_name: "Player",
  photo_url: null
};

// Initialize UI Elements on DOM Load
document.addEventListener("DOMContentLoaded", () => {
  const nameEl = document.getElementById("user-name");
  const avatarEl = document.getElementById("user-avatar");

  if (nameEl) nameEl.innerText = user.first_name;
  if (avatarEl && user.photo_url) avatarEl.src = user.photo_url;

  updatePurchaseSummary();
});

// ==========================================
// 2. AUDIO SYNTHESIZER (Web Audio API)
// ==========================================
const AudioContextClass = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function playSound(type) {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === "daub") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === "ball") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(640, now + 0.15);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === "win") {
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const noteOsc = ctx.createOscillator();
        const noteGain = ctx.createGain();
        noteOsc.connect(noteGain);
        noteGain.connect(ctx.destination);

        const startTime = now + idx * 0.1;
        noteOsc.frequency.setValueAtTime(freq, startTime);
        noteGain.gain.setValueAtTime(0.2, startTime);
        noteGain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);

        noteOsc.start(startTime);
        noteOsc.stop(startTime + 0.3);
      });
    }
  } catch (e) {
    console.warn("Audio Context blocked or unsupported:", e);
  }
}

// ==========================================
// 3. TICKET PURCHASE & 75-BALL LOGIC
// ==========================================
function changeTicketCount(delta) {
  ticketCount = Math.max(1, Math.min(MAX_TICKETS, ticketCount + delta));
  updatePurchaseSummary();

  if (tg?.HapticFeedback) {
    tg.HapticFeedback.impactOccurred("light");
  }
}

function updatePurchaseSummary() {
  const countDisplay = document.getElementById("ticket-count-display");
  const costDisplay = document.getElementById("total-cost-display");

  if (countDisplay) countDisplay.innerText = ticketCount;
  if (costDisplay) costDisplay.innerText = (ticketCount * TICKET_PRICE).toLocaleString();
}

function getRandomUniqueNumbers(min, max, count) {
  const pool = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const result = [];
  for (let i = 0; i < count; i++) {
    const randomIndex = Math.floor(Math.random() * pool.length);
    result.push(pool.splice(randomIndex, 1)[0]);
  }
  return result;
}

function generate75BallTicket(ticketId) {
  // Standard 75-Ball bingo ranges:
  // B: 1-15, I: 16-30, N: 31-45, G: 46-60, O: 61-75
  const bNums = getRandomUniqueNumbers(1, 15, 5);
  const iNums = getRandomUniqueNumbers(16, 30, 5);
  const nNums = getRandomUniqueNumbers(31, 45, 4); // 4 numbers + center FREE
  const gNums = getRandomUniqueNumbers(46, 60, 5);
  const oNums = getRandomUniqueNumbers(61, 75, 5);

  const nColumn = [nNums[0], nNums[1], "FREE", nNums[2], nNums[3]];
  const marked = Array(5).fill(null).map(() => Array(5).fill(false));
  marked[2][2] = true; // FREE center space automatically marked

  return {
    id: ticketId,
    grid: { B: bNums, I: iNums, N: nColumn, G: gNums, O: oNums },
    marked: marked
  };
}

function confirmPurchase() {
  userTickets = [];
  for (let i = 0; i < ticketCount; i++) {
    userTickets.push(generate75BallTicket(i + 1));
  }

  // Switch from purchase screen to game area
  document.getElementById("purchase-panel")?.classList.add("hidden");
  document.getElementById("tickets-container")?.classList.remove("hidden");
  document.getElementById("action-bar")?.classList.remove("hidden");

  renderTickets();
  connectWebSocket();

  if (tg?.HapticFeedback) {
    tg.HapticFeedback.notificationOccurred("success");
  }
}

// ==========================================
// 4. GRID RENDERING & DAUBING INTERACTION
// ==========================================
function renderTickets() {
  const container = document.getElementById("tickets-container");
  if (!container) return;
  container.innerHTML = "";

  userTickets.forEach((ticket, tIdx) => {
    const cardEl = document.createElement("div");
    cardEl.className = "bingo-card";

    let html = `
      <div class="card-header">
        <span>TICKET #${ticket.id}</span>
        <span>PRICE: ${TICKET_PRICE} PTS</span>
      </div>
      <div class="bingo-grid">
        <div class="grid-header">B</div>
        <div class="grid-header">I</div>
        <div class="grid-header">N</div>
        <div class="grid-header">G</div>
        <div class="grid-header">O</div>
    `;

    const cols = ["B", "I", "N", "G", "O"];

    for (let row = 0; row < 5; row++) {
      for (let colIdx = 0; colIdx < 5; colIdx++) {
        const colName = cols[colIdx];
        const val = ticket.grid[colName][row];
        const isDaubed = ticket.marked[row][colIdx];
        const isFree = val === "FREE";

        html += `
          <div class="grid-cell ${isDaubed ? "daubed" : ""} ${isFree ? "free" : ""}"
               onclick="toggleDaub(${tIdx}, ${row}, ${colIdx}, '${val}')">
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

function toggleDaub(ticketIdx, row, col, val) {
  if (val === "FREE") return;

  userTickets[ticketIdx].marked[row][col] = !userTickets[ticketIdx].marked[row][col];
  playSound("daub");

  if (tg?.HapticFeedback) {
    tg.HapticFeedback.selectionChanged();
  }

  renderTickets();
}

// ==========================================
// 5. WEBSOCKET REAL-TIME ENGINE
// ==========================================
function connectWebSocket() {
  // Convert standard HTTP/HTTPS URLs to WS/WSS protocols
  let wsUrl = CONFIG.WORKER_URL.trim();
  if (wsUrl.startsWith("http://")) {
    wsUrl = wsUrl.replace("http://", "ws://");
  } else if (wsUrl.startsWith("https://")) {
    wsUrl = wsUrl.replace("https://", "wss://");
  }
  if (!wsUrl.endsWith("/ws")) {
    wsUrl = wsUrl.replace(/\/$/, "") + "/ws";
  }

  console.log("Connecting to WebSocket target:", wsUrl);
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log("Connected to Worker Backend successfully!");
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === "BALL_DRAWN") {
        if (drawnBalls.length < MAX_BALLS) {
          drawnBalls.push(data.ball);
          updateCallerDisplay(data.ball);
          playSound("ball");

          if (tg?.HapticFeedback) {
            tg.HapticFeedback.impactOccurred("medium");
          }
        }
      } else if (data.type === "GAME_OVER") {
        const callerLabel = document.getElementById("current-letter");
        if (callerLabel) callerLabel.innerText = "GAME OVER (20 BALLS DRAWN)";

        if (tg?.HapticFeedback) {
          tg.HapticFeedback.notificationOccurred("warning");
        }
      } else if (data.type === "CLAIM_RESULT") {
        if (data.success) {
          playSound("win");
          triggerConfetti();
          alert(`🎉 WINNER! ${data.message || 'Bingo verified successfully!'}`);
        } else {
          alert(`❌ INVALID BINGO: ${data.message || 'Check your tickets.'}`);
        }
      }
    } catch (err) {
      console.error("Error parsing WebSocket message:", err);
    }
  };

  ws.onclose = () => {
    console.log("WebSocket connection closed. Retrying in 3 seconds...");
    setTimeout(connectWebSocket, 3000);
  };

  ws.onerror = (err) => {
    console.error("WebSocket Connection Error:", err);
  };
}

function updateCallerDisplay(ball) {
  const getLetter = (num) => {
    if (num <= 15) return "B";
    if (num <= 30) return "I";
    if (num <= 45) return "N";
    if (num <= 60) return "G";
    return "O";
  };

  const ballElement = document.getElementById("current-ball");
  const letterElement = document.getElementById("current-letter");
  const countElement = document.getElementById("called-count");
  const recentContainer = document.getElementById("recent-balls-list");

  if (ballElement) ballElement.innerText = ball;
  if (letterElement) letterElement.innerText = `${getLetter(ball)} - ${ball}`;
  if (countElement) countElement.innerText = `Balls: ${drawnBalls.length} / ${MAX_BALLS}`;

  if (recentContainer) {
    recentContainer.innerHTML = drawnBalls
      .slice(-5)
      .reverse()
      .map((b) => `<div class="mini-ball">${b}</div>`)
      .join("");
  }
}

// ==========================================
// 6. WIN CLAIM & CONFETTI ANIMATION
// ==========================================
function claimBingo() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        type: "CLAIM_BINGO",
        userId: user.id,
        tickets: userTickets,
        drawnBalls: drawnBalls
      })
    );
  } else {
    // Client-side fallback check if disconnected
    const localWin = checkLocalBingo();
    if (localWin) {
      playSound("win");
      triggerConfetti();
      alert("🎉 BINGO! (Verified offline)");
    } else {
      alert("❌ Invalid Bingo. Make sure you have marked a full horizontal line!");
    }
  }
}

function checkLocalBingo() {
  const cols = ["B", "I", "N", "G", "O"];

  return userTickets.some((ticket) => {
    for (let r = 0; r < 5; r++) {
      let rowComplete = true;
      for (let c = 0; c < 5; c++) {
        const val = ticket.grid[cols[c]][r];
        const isMarked = ticket.marked[r][c];
        if (val !== "FREE" && (!isMarked || !drawnBalls.includes(val))) {
          rowComplete = false;
          break;
        }
      }
      if (rowComplete) return true;
    }
    return false;
  });
}

function triggerConfetti() {
  const canvas = document.getElementById("confetti-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = Array.from({ length: 100 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height - canvas.height,
    size: Math.random() * 8 + 4,
    color: ["#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#ec4899"][
      Math.floor(Math.random() * 5)
    ],
    vx: (Math.random() - 0.5) * 2,
    vy: Math.random() * 4 + 2,
    rotation: Math.random() * 360
  }));

  let animationFrame;
  const startTime = Date.now();

  function renderFrame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += 2;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();

      if (p.y > canvas.height) p.y = -10;
    });

    if (Date.now() - startTime < 4000) {
      animationFrame = requestAnimationFrame(renderFrame);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      cancelAnimationFrame(animationFrame);
    }
  }

  renderFrame();
}
