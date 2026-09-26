/**
 * FAST BINGO TELEBIRR MINI APP ENGINE
 * Features: 30 Birr Welcome Bonus, 10 Birr Ticket Price,
 * Contact Sharing Verification, Web Audio Sound Effects,
 * Home Navigation, Compact Ticket Board, 30s Game Loop (20 Balls).
 */

const CONFIG = {
  WORKER_URL: "https://bingobet.ketiolcj.workers.dev",
  TICKET_PRICE: 10,       // 10 Birr per ticket
  WELCOME_BONUS: 30.00,  // 30 Birr initial welcome bonus
  ROUND_DURATION: 30,    // 30-second match countdown loop
  MAX_BALLS: 20          // 20 balls called per round from 75
};

// TELEGRAM MINI APP SDK INIT
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.expand();
  tg.ready();
  if (tg.enableClosingConfirmation) tg.enableClosingConfirmation();
}

// GAME STATE
let userBalance = CONFIG.WELCOME_BONUS;
let userSelectedTickets = [];
let userTickets = [];
let drawnBalls = [];
let autoDaubEnabled = true;
let isSoundMuted = false;
let isContactVerified = false;

let gameTimer = CONFIG.ROUND_DURATION;
let timerInterval = null;
let isGameActive = false;

// WEB AUDIO SYNTHESIZER FOR SOUND EFFECTS
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function toggleSound() {
  isSoundMuted = !isSoundMuted;
  const btn = document.getElementById("sound-toggle-btn");
  if (btn) btn.innerText = isSoundMuted ? "🔇" : "🔊";
}

function playBallSound() {
  if (isSoundMuted) return;
  try {
    initAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5 note
    osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5 note

    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.25);
  } catch (e) {
    console.log("Audio play error:", e);
  }
}

function playWinSound() {
  if (isSoundMuted) return;
  try {
    initAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 fanfare
    notes.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime + i * 0.12);

      gain.gain.setValueAtTime(0.4, audioCtx.currentTime + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + i * 0.12 + 0.3);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(audioCtx.currentTime + i * 0.12);
      osc.stop(audioCtx.currentTime + i * 0.12 + 0.3);
    });
  } catch (e) {
    console.log("Audio play error:", e);
  }
}

// PUBLIC WINNERS HISTORY DB
let publicWinnersHistory = [
  { id: "WIN-901", name: "Abebe K.", userId: "892019", ticketId: 14, prize: "150 ETB", pattern: "Horizontal Row Completed", card: generatePresetTicket(14) },
  { id: "WIN-902", name: "Tigist M.", userId: "710294", ticketId: 205, prize: "80 ETB", pattern: "Vertical Column", card: generatePresetTicket(205) }
];

let walletRequests = [];

// TELEGRAM USER IDENTIFIER
const user = tg?.initDataUnsafe?.user || {
  id: Math.floor(100000 + Math.random() * 900000),
  first_name: "Player",
  photo_url: null
};

// APP INITIALIZATION
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("user-name")) document.getElementById("user-name").innerText = user.first_name;
  if (document.getElementById("user-id-display")) document.getElementById("user-id-display").innerText = user.id;
  if (user.photo_url && document.getElementById("user-avatar")) document.getElementById("user-avatar").src = user.photo_url;

  updateBalanceDisplays();
  renderPresetGrid();
  renderWinnersList();
  startRoundTimer();

  // Prompt contact verification modal for new players
  if (!isContactVerified && document.getElementById("contact-modal")) {
    document.getElementById("contact-modal").classList.remove("hidden");
  }

  // Initialize audio context on first user interaction
  document.addEventListener('click', initAudio, { once: true });
});

// CONTACT VERIFICATION FOR NEW PLAYERS
function requestContactVerification() {
  if (tg?.requestContact) {
    tg.requestContact((sent) => {
      if (sent) completeContactVerification();
      else fallbackVerification();
    });
  } else {
    fallbackVerification();
  }
}

function fallbackVerification() {
  const phone = prompt("Please share/enter your phone number to activate your 30 ETB bonus:");
  if (phone && phone.length >= 9) {
    completeContactVerification();
  } else {
    alert("Phone contact verification is required to claim your 30 ETB welcome bonus!");
  }
}

function completeContactVerification() {
  isContactVerified = true;
  if (document.getElementById("contact-modal")) {
    document.getElementById("contact-modal").classList.add("hidden");
  }
  alert("🎉 Contact verified! 30 ETB Welcome Bonus activated.");
}

// HOME BUTTON & TAB NAVIGATION
function goHome() {
  switchTab('home');
}

function switchTab(tab) {
  ["home", "game", "winners", "wallet"].forEach(t => {
    document.getElementById(`view-${t}`)?.classList.add("hidden");
    document.getElementById(`tab-${t}`)?.classList.remove("active");
  });

  const activeView = document.getElementById(`view-${tab}`);
  const activeTab = document.getElementById(`tab-${tab}`);

  if (activeView) activeView.classList.remove("hidden");
  if (activeTab) activeTab.classList.add("active");
}

// PRESET TICKET SEED GENERATOR (#1 - #500)
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
    pill.className = `pill ticket-pill ${userSelectedTickets.includes(i) ? "selected" : ""}`;
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

  if (document.getElementById("selected-tickets-count")) {
    document.getElementById("selected-tickets-count").innerText = userSelectedTickets.length;
  }
  if (document.getElementById("total-ticket-cost")) {
    document.getElementById("total-ticket-cost").innerText = `${userSelectedTickets.length * CONFIG.TICKET_PRICE} ETB`;
  }

  renderPresetGrid();
}

function selectRandomTicket() {
  const randomId = Math.floor(Math.random() * 500) + 1;
  toggleTicketSelection(randomId);
}

function jumpToTicket() {
  const input = document.getElementById("ticket-search-input");
  if (!input) return;
  const val = parseInt(input.value);
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

// CONFIRM PURCHASE & DEDUCT BALANCE
function confirmPurchase() {
  if (userSelectedTickets.length === 0) {
    alert("Please select at least one ticket!");
    return;
  }

  const totalCost = userSelectedTickets.length * CONFIG.TICKET_PRICE;

  // VERIFY SUFFICIENT BALANCE
  if (userBalance < totalCost) {
    alert(`Insufficient balance! Needed ${totalCost} ETB. Please deposit money into your Telebirr wallet.`);
    switchTab("wallet");
    return;
  }

  // DEDUCT BALANCE UPON PURCHASE
  userBalance -= totalCost;
  updateBalanceDisplays();

  userTickets = userSelectedTickets.map(id => generatePresetTicket(id));

  // Show live game board view
  switchTab("game");
  if (document.getElementById("action-bar")) document.getElementById("action-bar").classList.remove("hidden");

  renderUserTickets();
}

// COMPACT PLAYER TICKET RENDERER
function renderUserTickets() {
  const container = document.getElementById("tickets-container");
  if (!container) return;
  container.innerHTML = "";

  const cols = ["B", "I", "N", "G", "O"];

  userTickets.forEach((ticket, tIdx) => {
    const cardEl = document.createElement("div");
    cardEl.className = "compact-ticket-card bingo-card";

    let html = `
      <div class="card-info-row card-header">
        <span>TICKET #${ticket.id}</span>
        <span>FAST 5x5</span>
      </div>
      <div class="bingo-grid-compact bingo-grid">
        <div class="grid-col-header grid-header">B</div>
        <div class="grid-col-header grid-header">I</div>
        <div class="grid-col-header grid-header">N</div>
        <div class="grid-col-header grid-header">G</div>
        <div class="grid-col-header grid-header">O</div>
    `;

    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const val = ticket.grid[cols[c]][r];
        const isDaubed = ticket.marked[r][c];
        const isFree = val === "FREE";

        html += `
          <div class="grid-cell-compact grid-cell ${isDaubed ? "daubed" : ""} ${isFree ? "free" : ""}"
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

// 30-SECOND ROUND TIMER & 20-BALL MATCH ENGINE
function startRoundTimer() {
  clearInterval(timerInterval);
  gameTimer = CONFIG.ROUND_DURATION;
  isGameActive = false;

  timerInterval = setInterval(() => {
    gameTimer--;

    const timerEl = document.getElementById("match-timer-display") || document.getElementById("match-timer-badge");
    const phaseEl = document.getElementById("game-phase-tag") || document.getElementById("game-phase-label");

    if (timerEl) timerEl.innerText = `STARTS IN ${gameTimer}s`;
    if (phaseEl) phaseEl.innerText = "WAITING FOR NEXT ROUND";

    if (gameTimer <= 0) {
      clearInterval(timerInterval);
      startMatch();
    }
  }, 1000);
}

function startMatch() {
  isGameActive = true;
  drawnBalls = [];

  const phaseEl = document.getElementById("game-phase-tag") || document.getElementById("game-phase-label");
  if (phaseEl) phaseEl.innerText = "LIVE ROUND DRAWING";

  let drawCount = 0;
  const matchInterval = setInterval(() => {
    if (drawCount >= CONFIG.MAX_BALLS) {
      clearInterval(matchInterval);
      if (phaseEl) phaseEl.innerText = "ROUND COMPLETED";

      // AUTO RESET FOR NEXT MATCH:
      setTimeout(() => {
        resetTicketsForNextMatch();
        startRoundTimer();
      }, 3000);
      return;
    }

    let nextBall;
    do {
      nextBall = Math.floor(Math.random() * 75) + 1;
    } while (drawnBalls.includes(nextBall));

    drawnBalls.push(nextBall);
    drawCount++;

    processDrawnBall(nextBall);
  }, 2000); // 2 seconds per ball call
}

function processDrawnBall(ball) {
  // PLAY SOUND EFFECT WHEN BALL IS CALLED
  playBallSound();

  const getLetter = (num) => {
    if (num <= 15) return "B";
    if (num <= 30) return "I";
    if (num <= 45) return "N";
    if (num <= 60) return "G";
    return "O";
  };

  const letter = getLetter(ball);

  if (document.getElementById("current-ball-el")) document.getElementById("current-ball-el").className = `giant-ball ${letter}`;
  if (document.getElementById("current-letter")) document.getElementById("current-letter").innerText = letter;
  if (document.getElementById("current-number")) document.getElementById("current-number").innerText = ball;
  if (document.getElementById("called-count")) document.getElementById("called-count").innerText = drawnBalls.length;

  if (document.getElementById("recent-balls-list")) {
    document.getElementById("recent-balls-list").innerHTML = drawnBalls
      .slice(-5)
      .reverse()
      .map(b => `<div class="mini-ball">${b}</div>`)
      .join("");
  }

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

// RESET TICKETS AFTER MATCH COMPLETION
function resetTicketsForNextMatch() {
  userTickets = [];
  userSelectedTickets = [];

  if (document.getElementById("action-bar")) document.getElementById("action-bar").classList.add("hidden");
  switchTab("home");

  if (document.getElementById("selected-tickets-count")) document.getElementById("selected-tickets-count").innerText = "0";
  if (document.getElementById("total-ticket-cost")) document.getElementById("total-ticket-cost").innerText = "0 ETB";

  renderPresetGrid();
}

// BINGO CLAIM & WINNING CREDIT
function claimBingo() {
  if (userTickets.length === 0) {
    alert("You don't have active tickets in this match!");
    return;
  }

  const hasWon = checkLocalBingo();
  if (hasWon) {
    // PLAY WINNER FANFARE SOUND
    playWinSound();

    // CALCULATE WINNING PRIZE & ADD TO PLAYER BALANCE
    const prizeAmount = userTickets.length * 100;
    userBalance += prizeAmount;
    updateBalanceDisplays();

    const winRecord = {
      id: `WIN-${Math.floor(100 + Math.random() * 900)}`,
      name: user.first_name,
      userId: user.id,
      ticketId: userTickets[0].id,
      prize: `${prizeAmount} ETB`,
      pattern: "Horizontal Row Completed",
      card: userTickets[0]
    };

    publicWinnersHistory.unshift(winRecord);
    renderWinnersList();

    triggerConfetti();
    alert(`🎉 FAST BINGO! Congratulations, you won ${prizeAmount} ETB! The prize has been added to your Telebirr balance.`);
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
    card.className = "winner-item winner-card";
    card.onclick = () => inspectWinnerTicket(win);

    card.innerHTML = `
      <div class="winner-info">
        <span class="w-name winner-name">${win.name} (ID: ${win.userId})</span><br>
        <span class="w-sub winner-sub">Ticket #${win.ticketId} • ${win.pattern}</span>
      </div>
      <div>
        <div class="w-prize winner-prize">+${win.prize}</div>
        <span class="w-inspect inspect-badge">Tap to Inspect 🔍</span>
      </div>
    `;
    container.appendChild(card);
  });
}

function inspectWinnerTicket(win) {
  const modal = document.getElementById("winner-modal");
  const content = document.getElementById("modal-content");
  if (!modal || !content) return;
  modal.classList.remove("hidden");

  const cols = ["B", "I", "N", "G", "O"];
  const ticket = win.card;

  let html = `
    <h3 style="color:var(--accent-gold); margin-bottom:4px;">${win.name}'s Ticket #${win.ticketId}</h3>
    <p style="font-size:11px; color:var(--text-muted); margin-bottom:10px;">Player ID: ${win.userId} • Prize: ${win.prize}</p>
    <div class="bingo-grid-compact bingo-grid">
      <div class="grid-col-header grid-header">B</div>
      <div class="grid-col-header grid-header">I</div>
      <div class="grid-col-header grid-header">N</div>
      <div class="grid-col-header grid-header">G</div>
      <div class="grid-col-header grid-header">O</div>
  `;

  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const val = ticket.grid[cols[c]][r];
      const isDaubed = ticket.marked[r][c];
      html += `<div class="grid-cell-compact grid-cell ${isDaubed ? 'daubed' : ''}">${val}</div>`;
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

// TELEBIRR WALLET SYSTEM (DEPOSIT & WITHDRAW)
function toggleWalletForm(type) {
  document.getElementById("deposit-form")?.classList.toggle("hidden", type !== "deposit");
  document.getElementById("withdraw-form")?.classList.toggle("hidden", type !== "withdraw");

  document.getElementById("btn-show-deposit")?.classList.toggle("active", type === "deposit");
  document.getElementById("btn-show-withdraw")?.classList.toggle("active", type === "withdraw");
}

function submitDepositRequest() {
  const amt = parseFloat(document.getElementById("dep-amount").value);
  const txn = document.getElementById("dep-txnid").value.trim();

  if (!amt || amt < 10) { alert("Minimum deposit amount is 10 ETB"); return; }
  if (!txn) { alert("Please enter your Telebirr Transaction ID"); return; }

  walletRequests.unshift({ type: "Deposit", amount: amt, details: `TXN: ${txn}`, status: "Pending Approval" });
  renderWalletHistory();

  alert("Deposit request submitted! Account Admin (EFA - 0920384625) will verify your transaction shortly.");
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

  alert("Withdrawal request submitted! Funds will be sent to your Telebirr phone number.");
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
    item.style.fontSize = "11px";
    item.style.padding = "6px 0";
    item.style.borderBottom = "1px solid rgba(255,255,255,0.08)";
    item.innerHTML = `
      <div>
        <strong>${req.type} - ${req.amount} ETB</strong><br>
        <span style="color:var(--text-muted);">${req.details}</span>
      </div>
      <span class="status pending" style="color:var(--accent-gold);">${req.status}</span>
    `;
    container.appendChild(item);
  });
}

function updateBalanceDisplays() {
  if (document.getElementById("user-balance")) document.getElementById("user-balance").innerText = userBalance.toFixed(2);
  if (document.getElementById("wallet-balance-large")) document.getElementById("wallet-balance-large").innerText = `${userBalance.toFixed(2)} ETB`;
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
