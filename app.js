/**
 * 75-BALL BINGO TELEBIRR MINI APP ENGINE
 * Features: Telebirr Deposit/Withdrawal, 500 Preset Tickets, Automated 30s Loop,
 * Public Winners Inspector Board, and Web Audio SFX.
 */

const CONFIG = {
  WORKER_URL: "https://bingobet.ketiolcj.workers.dev",
  TICKET_PRICE: 50,
  ROUND_DURATION: 30, // 30s loop between games
  MAX_BALLS: 20
};

// TELEGRAM MINI APP SDK INIT
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.expand();
  tg.ready();
  if (tg.enableClosingConfirmation) tg.enableClosingConfirmation();
}

// GAME & USER STATE
let userBalance = 500.00;
let userSelectedTickets = [];
let userTickets = [];
let drawnBalls = [];
let autoDaubEnabled = true;

let gameTimer = CONFIG.ROUND_DURATION;
let timerInterval = null;
let isGameActive = false;
let ws = null;

// Mock Winners History DB
let publicWinnersHistory = [
  { id: "WIN-901", name: "Abebe K.", userId: "892019", ticketId: 14, prize: "2,500 ETB", pattern: "Top Horizontal Line", card: generatePresetTicket(14) },
  { id: "WIN-902", name: "Tigist M.", userId: "710294", ticketId: 205, prize: "1,200 ETB", pattern: "Vertical B-Column", card: generatePresetTicket(205) }
];

let walletRequests = [];

// TELEGRAM USER IDENTIFIER
const user = tg?.initDataUnsafe?.user || {
  id: Math.floor(100000 + Math.random() * 900000),
  first_name: "Player",
  photo_url: null
};

// INITIALIZATION
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("user-name").innerText = user.first_name;
  document.getElementById("user-id-display").innerText = user.id;
  if (user.photo_url) document.getElementById("user-avatar").src = user.photo_url;

  updateBalanceDisplays();
  renderPresetGrid();
  renderWinnersList();
  startRoundTimer();
  connectWebSocket();
});

// TAB SWITCHING LOGIC
function switchTab(tab) {
  ["game", "winners", "wallet"].forEach(t => {
    document.getElementById(`view-${t}`)?.classList.add("hidden");
    document.getElementById(`tab-${t}`)?.classList.remove("active");
  });

  document.getElementById(`view-${tab}`)?.classList.remove("hidden");
  document.getElementById(`tab-${tab}`)?.classList.add("active");
}

// PRESET TICKET ENGINE (#1 - #500)
function seedRandom(seed) {
  let x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

function generatePresetTicket(ticketId) {
  let seed = ticketId * 997;
  const getCols = (min, max, count) => {
    let pool = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    let res = [];
    for (let i = 0; i < count; i++) {
      let idx = Math.floor(seedRandom(seed++) * pool.length);
      res.push(pool.splice(idx, 1)[0]);
    }
    return res;
  };

  const b = getCols(1, 15, 5);
  const i = getCols(16, 30, 5);
  const n = getCols(31, 45, 4);
  const g = getCols(46, 60, 5);
  const o = getCols(61, 75, 5);

  const nColumn = [n[0], n[1], "FREE", n[2], n[3]];
  const marked = Array(5).fill(null).map(() => Array(5).fill(false));
  marked[2][2] = true;

  return {
    id: ticketId,
    grid: { B: b, I: i, N: nColumn, G: g, O: o },
    marked: marked
  };
}

function renderPresetGrid() {
  const container = document.getElementById("preset-grid");
  if (!container) return;
  container.innerHTML = "";

  for (let i = 1; i <= 500; i++) {
    const pill = document.createElement("div");
    pill.className = `ticket-pill ${userSelectedTickets.includes(i) ? "selected" : ""}`;
    pill.id = `pill-${i}`;
    pill.innerText = `#${i}`;
    pill.onclick = () => toggleTicketSelection(i);
    container.appendChild(pill);
  }
}

function toggleTicketSelection(id) {
  const idx = userSelectedTickets.indexOf(id);
  if (idx > -1) {
    userSelectedTickets.splice(idx, 1);
  } else {
    if (userSelectedTickets.length >= 4) {
      alert("Maximum 4 tickets allowed per round!");
      return;
    }
    userSelectedTickets.push(id);
  }

  document.getElementById("selected-tickets-count").innerText = userSelectedTickets.length;
  document.getElementById("total-ticket-cost").innerText = `${userSelectedTickets.length * CONFIG.TICKET_PRICE} ETB`;

  renderPresetGrid();
}

function selectRandomTicket() {
  const randomId = Math.floor(Math.random() * 500) + 1;
  toggleTicketSelection(randomId);
}

function jumpToTicket() {
  const val = parseInt(document.getElementById("ticket-search-input").value);
  if (val >= 1 && val <= 500) {
    const el = document.getElementById(`pill-${val}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      toggleTicketSelection(val);
    }
  }
}

function toggleAutoDaub(enabled) {
  autoDaubEnabled = enabled;
}

// TICKET PURCHASE & MATCH START
function confirmPurchase() {
  if (userSelectedTickets.length === 0) {
    alert("Please select at least one ticket!");
    return;
  }

  const totalCost = userSelectedTickets.length * CONFIG.TICKET_PRICE;
  if (userBalance < totalCost) {
    alert("Insufficient Telebirr balance! Please deposit money in the Wallet tab.");
    switchTab("wallet");
    return;
  }

  userBalance -= totalCost;
  updateBalanceDisplays();

  userTickets = userSelectedTickets.map(id => generatePresetTicket(id));

  document.getElementById("purchase-panel").classList.add("hidden");
  document.getElementById("tickets-container").classList.remove("hidden");
  document.getElementById("action-bar").classList.remove("hidden");

  renderUserTickets();
}

function renderUserTickets() {
  const container = document.getElementById("tickets-container");
  if (!container) return;
  container.innerHTML = "";

  const cols = ["B", "I", "N", "G", "O"];

  userTickets.forEach((ticket, tIdx) => {
    const cardEl = document.createElement("div");
    cardEl.className = "bingo-card";

    let html = `
      <div class="card-header">
        <span>TICKET #${ticket.id}</span>
        <span>STANDARD 5x5</span>
      </div>
      <div class="bingo-grid">
        <div class="grid-header">B</div>
        <div class="grid-header">I</div>
        <div class="grid-header">N</div>
        <div class="grid-header">G</div>
        <div class="grid-header">O</div>
    `;

    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const val = ticket.grid[cols[c]][r];
        const isDaubed = ticket.marked[r][c];
        const isFree = val === "FREE";

        html += `
          <div class="grid-cell ${isDaubed ? "daubed" : ""} ${isFree ? "free" : ""}"
               onclick="manualDaub(${tIdx}, ${r}, ${c})">
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

function manualDaub(tIdx, r, c) {
  userTickets[tIdx].marked[r][c] = !userTickets[tIdx].marked[r][c];
  renderUserTickets();
}

// 30-SECOND ROUND TIMER & SIMULATED DRAW ENGINE
function startRoundTimer() {
  clearInterval(timerInterval);
  gameTimer = CONFIG.ROUND_DURATION;
  isGameActive = false;

  timerInterval = setInterval(() => {
    gameTimer--;
    document.getElementById("match-timer-badge").innerText = `NEXT GAME IN ${gameTimer}s`;
    document.getElementById("game-phase-label").innerText = "TICKET WAITING PHASE";

    if (gameTimer <= 0) {
      clearInterval(timerInterval);
      startMatch();
    }
  }, 1000);
}

function startMatch() {
  isGameActive = true;
  drawnBalls = [];
  document.getElementById("game-phase-label").innerText = "LIVE ROUND DRAWING";
  
  let drawCount = 0;
  const matchInterval = setInterval(() => {
    if (drawCount >= CONFIG.MAX_BALLS) {
      clearInterval(matchInterval);
      document.getElementById("game-phase-label").innerText = "ROUND COMPLETED";
      setTimeout(startRoundTimer, 5000); // Wait 5s before starting next 30s loop
      return;
    }

    let nextBall;
    do {
      nextBall = Math.floor(Math.random() * 75) + 1;
    } while (drawnBalls.includes(nextBall));

    drawnBalls.push(nextBall);
    drawCount++;

    processDrawnBall(nextBall);
  }, 2500); // Draw new ball every 2.5 seconds
}

function processDrawnBall(ball) {
  const getLetter = (num) => {
    if (num <= 15) return "B";
    if (num <= 30) return "I";
    if (num <= 45) return "N";
    if (num <= 60) return "G";
    return "O";
  };

  const letter = getLetter(ball);
  document.getElementById("current-ball-el").className = `giant-ball ${letter}`;
  document.getElementById("current-letter").innerText = letter;
  document.getElementById("current-number").innerText = ball;
  document.getElementById("called-count").innerText = drawnBalls.length;

  document.getElementById("recent-balls-list").innerHTML = drawnBalls
    .slice(-5)
    .reverse()
    .map(b => `<div class="mini-ball">${b}</div>`)
    .join("");

  if (autoDaubEnabled && userTickets.length > 0) {
    const cols = ["B", "I", "N", "G", "O"];
    userTickets.forEach(ticket => {
      cols.forEach((colName, c) => {
        ticket.grid[colName].forEach((val, r) => {
          if (val === ball) ticket.marked[r][c] = true;
        });
      });
    });
    renderUserTickets();
  }
}

// BINGO CLAIM & PUBLIC WINNERS INSPECTOR
function claimBingo() {
  if (userTickets.length === 0) {
    alert("You don't have any active tickets in this match!");
    return;
  }

  const hasWon = checkLocalBingo();
  if (hasWon) {
    const prize = userTickets.length * 200;
    userBalance += prize;
    updateBalanceDisplays();

    const winRecord = {
      id: `WIN-${Math.floor(100 + Math.random() * 900)}`,
      name: user.first_name,
      userId: user.id,
      ticketId: userTickets[0].id,
      prize: `${prize} ETB`,
      pattern: "Horizontal Row Completed",
      card: userTickets[0]
    };

    publicWinnersHistory.unshift(winRecord);
    renderWinnersList();

    triggerConfetti();
    alert(`🎉 BINGO! Congratulations, you won ${prize} ETB! Balance updated.`);
  } else {
    alert("❌ Invalid Claim: Complete a line before pressing BINGO!");
  }
}

function checkLocalBingo() {
  const cols = ["B", "I", "N", "G", "O"];
  return userTickets.some(ticket => {
    for (let r = 0; r < 5; r++) {
      let complete = true;
      for (let c = 0; c < 5; c++) {
        const val = ticket.grid[cols[c]][r];
        const isMarked = ticket.marked[r][c];
        if (val !== "FREE" && (!isMarked || !drawnBalls.includes(val))) {
          complete = false; break;
        }
      }
      if (complete) return true;
    }
    return false;
  });
}

function renderWinnersList() {
  const container = document.getElementById("public-winners-list");
  if (!container) return;
  container.innerHTML = "";

  publicWinnersHistory.forEach(win => {
    const card = document.createElement("div");
    card.className = "winner-card";
    card.onclick = () => inspectWinnerTicket(win);

    card.innerHTML = `
      <div class="winner-info">
        <span class="winner-name">${win.name} (ID: ${win.userId})</span>
        <span class="winner-sub">Ticket #${win.ticketId} • ${win.pattern}</span>
      </div>
      <div>
        <div class="winner-prize">+${win.prize}</div>
        <span class="inspect-badge">Tap to Inspect 🔍</span>
      </div>
    `;
    container.appendChild(card);
  });
}

function inspectWinnerTicket(win) {
  const modal = document.getElementById("winner-modal");
  const content = document.getElementById("modal-content");
  modal.classList.remove("hidden");

  const cols = ["B", "I", "N", "G", "O"];
  const ticket = win.card;

  let html = `
    <h3 style="font-family:var(--font-display); color:var(--accent-gold); margin-bottom:4px;">${win.name}'s Ticket #${win.ticketId}</h3>
    <p style="font-size:12px; color:var(--text-muted); margin-bottom:12px;">Winner ID: ${win.userId} • Prize: ${win.prize}</p>
    <div class="bingo-grid">
      <div class="grid-header">B</div><div class="grid-header">I</div><div class="grid-header">N</div><div class="grid-header">G</div><div class="grid-header">O</div>
  `;

  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const val = ticket.grid[cols[c]][r];
      const isDaubed = ticket.marked[r][c];
      html += `<div class="grid-cell ${isDaubed ? 'daubed' : ''}">${val}</div>`;
    }
  }

  html += `</div>`;
  content.innerHTML = html;
}

function closeWinnerModal(e, force = false) {
  if (force || e.target.id === "winner-modal") {
    document.getElementById("winner-modal").classList.add("hidden");
  }
}

// TELEBIRR WALLET ENGINE (DEPOSIT & WITHDRAW)
function toggleWalletForm(type) {
  document.getElementById("deposit-form").classList.toggle("hidden", type !== "deposit");
  document.getElementById("withdraw-form").classList.toggle("hidden", type !== "withdraw");

  document.getElementById("btn-show-deposit").classList.toggle("active", type === "deposit");
  document.getElementById("btn-show-withdraw").classList.toggle("active", type === "withdraw");
}

function submitDepositRequest() {
  const amt = parseFloat(document.getElementById("dep-amount").value);
  const txn = document.getElementById("dep-txnid").value.trim();

  if (!amt || amt < 10) { alert("Minimum deposit amount is 10 ETB"); return; }
  if (!txn) { alert("Please provide your Telebirr Transaction ID"); return; }

  walletRequests.unshift({ type: "Deposit", amount: amt, details: `TXN: ${txn}`, status: "Pending Approval" });
  renderWalletHistory();

  alert("Deposit request submitted! Admin will verify your Telebirr transaction shortly.");
  document.getElementById("dep-amount").value = "";
  document.getElementById("dep-txnid").value = "";
}

function submitWithdrawalRequest() {
  const amt = parseFloat(document.getElementById("wd-amount").value);
  const phone = document.getElementById("wd-phone").value.trim();

  if (!amt || amt > userBalance) { alert("Invalid withdrawal amount or insufficient balance!"); return; }
  if (!phone || phone.length < 9) { alert("Please provide a valid Telebirr phone number"); return; }

  userBalance -= amt;
  updateBalanceDisplays();

  walletRequests.unshift({ type: "Withdrawal", amount: amt, details: `To: ${phone}`, status: "Processing" });
  renderWalletHistory();

  alert("Withdrawal request submitted! Funds will be sent to your Telebirr wallet.");
  document.getElementById("wd-amount").value = "";
  document.getElementById("wd-phone").value = "";
}

function renderWalletHistory() {
  const container = document.getElementById("wallet-history-list");
  if (!container) return;
  container.innerHTML = "";

  if (walletRequests.length === 0) {
    container.innerHTML = '<p class="empty-msg">No pending or past transactions.</p>';
    return;
  }

  walletRequests.forEach(req => {
    const item = document.createElement("div");
    item.className = "history-item";
    item.innerHTML = `
      <div>
        <strong>${req.type} - ${req.amount} ETB</strong><br>
        <span style="color:var(--text-muted);">${req.details}</span>
      </div>
      <span class="status pending">${req.status}</span>
    `;
    container.appendChild(item);
  });
}

function updateBalanceDisplays() {
  document.getElementById("user-balance").innerText = userBalance.toFixed(2);
  document.getElementById("wallet-balance-large").innerText = `${userBalance.toFixed(2)} ETB`;
}

// WEBSOCKET INTEGRATION
function connectWebSocket() {
  let wsUrl = CONFIG.WORKER_URL.trim();
  if (wsUrl.startsWith("http://")) wsUrl = wsUrl.replace("http://", "ws://");
  else if (wsUrl.startsWith("https://")) wsUrl = wsUrl.replace("https://", "wss://");
  if (!wsUrl.endsWith("/ws")) wsUrl = wsUrl.replace(/\/$/, "") + "/ws";

  ws = new WebSocket(wsUrl);
  ws.onopen = () => console.log("WebSocket connected!");
  ws.onerror = (e) => console.log("WS Error:", e);
}

// CONFETTI ANIMATION
function triggerConfetti() {
  const canvas = document.getElementById("confetti-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = Array.from({ length: 80 }, () => ({
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
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.rot += 3;
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
