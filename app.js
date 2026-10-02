/* =========================================================
   FAST BINGO PRO
   APP.JS
========================================================= */

const CONFIG = {
  WORKER_URL: "https://bingobet.ketiolcj.workers.dev",
  TICKET_PRICE: 10,
  WELCOME_BONUS: 30,
  REFERRAL_BONUS: 15,
  MAX_TICKETS: 4
};

/* =========================================================
   TELEGRAM
========================================================= */

const tg = window.Telegram?.WebApp;

if (tg) {
  tg.ready();
  tg.expand();
}

const user = tg?.initDataUnsafe?.user || {
  id: Math.floor(Math.random() * 999999),
  first_name: "Guest"
};

/* =========================================================
   GLOBAL STATE
========================================================= */

let socket = null;

let userBalance = 0;

let selectedTickets = [];
let userTickets = [];

let drawnBalls = [];

let autoDaubEnabled = true;
let isMuted = false;

let referralCode = "";

/* =========================================================
   API
========================================================= */

async function api(endpoint, options = {}) {

  const res = await fetch(
    CONFIG.WORKER_URL + endpoint,
    {
      headers: {
        "Content-Type": "application/json",
        "x-telegram-init-data":
          tg?.initData || ""
      },
      ...options
    }
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(
      data.error || "Request Failed"
    );
  }

  return data;
}

/* =========================================================
   INITIALIZE
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    loadProfile();

    generateReferralCode();

    renderTicketGrid();

    connectSocket();

    await loadBalance();

  }
);

/* =========================================================
   USER PROFILE
========================================================= */

function loadProfile() {

  const name =
    document.getElementById(
      "user-name"
    );

  const id =
    document.getElementById(
      "user-id-display"
    );

  if (name) {
    name.innerText =
      user.first_name;
  }

  if (id) {
    id.innerText =
      user.id;
  }

}

/* =========================================================
   BALANCE
========================================================= */

async function loadBalance() {

  try {

    const result = await api(
      `/api/user/balance?userId=${user.id}`
    );

    userBalance =
      Number(result.balance || 0);

    updateBalanceUI();

  } catch (err) {

    console.error(err);

  }

}

function updateBalanceUI() {

  const s =
    document.getElementById(
      "user-balance"
    );

  const w =
    document.getElementById(
      "wallet-balance-large"
    );

  if (s) {
    s.innerText =
      userBalance.toFixed(2);
  }

  if (w) {
    w.innerText =
      userBalance.toFixed(2)
      + " ETB";
  }

}

/* =========================================================
   REFERRAL SYSTEM
========================================================= */

function generateReferralCode() {

  referralCode =
    user.first_name
      .substring(0, 4)
      .toUpperCase()
      +
    String(user.id)
      .slice(-4);

  const el =
    document.getElementById(
      "referral-code"
    );

  if (el) {
    el.innerText =
      referralCode;
  }

}

function copyReferralCode() {

  navigator.clipboard.writeText(
    referralCode
  );

  alert(
    "Referral code copied!"
  );

}

/* =========================================================
   TELEBIRR
========================================================= */

function copyTelebirrNumber() {

  navigator.clipboard.writeText(
    "0920384625"
  );

  alert(
    "Telebirr number copied."
  );

}

async function submitDepositRequest() {

  try {

    const amount =
      parseFloat(
        document.getElementById(
          "dep-amount"
        ).value
      );

    const txn =
      document.getElementById(
        "dep-txnid"
      ).value;

    const result =
      await api(
        "/api/transaction/create",
        {
          method: "POST",
          body: JSON.stringify({
            userId: user.id,
            firstName: user.first_name,
            type: "Deposit",
            amount,
            details: txn
          })
        }
      );

    alert(
      "Deposit Submitted\n"
      + result.txnId
    );

  } catch (err) {

    alert(err.message);

  }

}

async function submitWithdrawalRequest() {

  try {

    const amount =
      parseFloat(
        document.getElementById(
          "wd-amount"
        ).value
      );

    const phone =
      document.getElementById(
        "wd-phone"
      ).value;

    const result =
      await api(
        "/api/transaction/create",
        {
          method: "POST",
          body: JSON.stringify({
            userId: user.id,
            firstName: user.first_name,
            type: "Withdrawal",
            amount,
            details: phone
          })
        }
      );

    alert(
      "Withdrawal Submitted\n"
      + result.txnId
    );

  } catch (err) {

    alert(err.message);

  }

}

/* =========================================================
   TABS
========================================================= */

function switchTab(tab) {

  const tabs = [
    "home",
    "game",
    "wallet",
    "winners",
    "referral"
  ];

  tabs.forEach(t => {

    document
      .getElementById(
        `view-${t}`
      )
      ?.classList.add(
        "hidden"
      );

    document
      .getElementById(
        `tab-${t}`
      )
      ?.classList.remove(
        "active"
      );

  });

  document
    .getElementById(
      `view-${tab}`
    )
    ?.classList.remove(
      "hidden"
    );

  document
    .getElementById(
      `tab-${tab}`
    )
    ?.classList.add(
      "active"
    );

}

function goHome() {
  switchTab("home");
}

/* =========================================================
   TICKETS
========================================================= */

function renderTicketGrid() {

  const grid =
    document.getElementById(
      "preset-grid"
    );

  if (!grid) return;

  grid.innerHTML = "";

  for (let i = 1; i <= 500; i++) {

    const ticket =
      document.createElement(
        "div"
      );

    ticket.className =
      "pill";

    ticket.innerText =
      "#" + i;

    ticket.onclick = () =>
      toggleTicket(i);

    grid.appendChild(
      ticket
    );

  }

}

function toggleTicket(id) {

  const index =
    selectedTickets.indexOf(id);

  if (index > -1) {

    selectedTickets.splice(
      index,
      1
    );

  } else {

    if (
      selectedTickets.length >=
      CONFIG.MAX_TICKETS
    ) {
      alert(
        "Maximum 4 tickets"
      );
      return;
    }

    selectedTickets.push(id);

  }

  updateSelectionUI();

}

function updateSelectionUI() {

  const count =
    document.getElementById(
      "selected-tickets-count"
    );

  const cost =
    document.getElementById(
      "total-ticket-cost"
    );

  if (count) {
    count.innerText =
      selectedTickets.length;
  }

  if (cost) {

    cost.innerText =
      (
        selectedTickets.length *
        CONFIG.TICKET_PRICE
      ) + " ETB";

  }

}

function selectRandomTicket() {

  const ticket =
    Math.floor(
      Math.random() * 500
    ) + 1;

  toggleTicket(ticket);

}

function jumpToTicket() {

  const value =
    parseInt(
      document.getElementById(
        "ticket-search-input"
      ).value
    );

  if (
    value >= 1 &&
    value <= 500
  ) {

    const el =
      document.querySelectorAll(
        ".pill"
      )[value - 1];

    el?.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

  }

}

function confirmPurchase() {

  const total =
    selectedTickets.length *
    CONFIG.TICKET_PRICE;

  if (
    selectedTickets.length === 0
  ) {
    alert(
      "Select ticket first"
    );
    return;
  }

  if (
    userBalance < total
  ) {
    alert(
      "Insufficient balance"
    );
    return;
  }

  document
    .getElementById(
      "action-bar"
    )
    ?.classList.remove(
      "hidden"
    );

  switchTab("game");

}

/* =========================================================
   WEBSOCKET
========================================================= */

function connectSocket() {

  try {

    const wsUrl =
      CONFIG.WORKER_URL.replace(
        "https://",
        "wss://"
      );

    socket =
      new WebSocket(
        wsUrl
      );

    socket.onmessage = e => {

      const msg =
        JSON.parse(e.data);

      switch (msg.type) {

        case "BALL_DRAWN":

          updateBall(
            msg.ball
          );

          break;

        case "GAME_OVER":

          alert(
            "Round Finished"
          );

          break;

        case "WINNER_DECLARED":

          alert(
            `Winner: ${msg.winner}`
          );

          break;
      }

    };

  } catch (e) {

    console.log(e);

  }

}

function updateBall(ball) {

  drawnBalls.push(ball);

  const number =
    document.getElementById(
      "current-number"
    );

  if (number) {
    number.innerText =
      ball;
  }

}

/* =========================================================
   AUTO DAUB
========================================================= */

function toggleAutoDaub(state) {
  autoDaubEnabled = state;
}

/* =========================================================
   BINGO
========================================================= */

function claimBingo() {

  if (!socket) {

    alert(
      "Game unavailable"
    );

    return;
  }

  socket.send(
    JSON.stringify({
      type:
      "CLAIM_BINGO",
      userId:
      user.id,
      tickets:
      userTickets
    })
  );

}

/* =========================================================
   SOUND
========================================================= */

function toggleSound() {

  isMuted =
    !isMuted;

  const btn =
    document.getElementById(
      "sound-toggle-btn"
    );

  if (btn) {

    btn.innerText =
      isMuted
      ? "🔇"
      : "🔊";

  }

}

/* =========================================================
   WINNERS
========================================================= */

function closeWinnerModal() {

  document
    .getElementById(
      "winner-modal"
    )
    ?.classList.add(
      "hidden"
    );

}

/* =========================================================
   CONTACT VERIFICATION
========================================================= */

function requestContactVerification() {

  if (
    tg &&
    tg.requestContact
  ) {

    tg.requestContact(
      sent => {

        if (sent) {

          alert(
            "Welcome Bonus Activated!"
          );

          document
            .getElementById(
              "contact-modal"
            )
            ?.classList.add(
              "hidden"
            );

        }

      }
    );

  }

}

/* =========================================================
   CONFETTI
========================================================= */

function triggerConfetti() {

  console.log(
    "Confetti!"
  );

}

/* =========================================================
   GLOBAL EXPORTS
========================================================= */

window.goHome = goHome;
window.switchTab = switchTab;

window.selectRandomTicket =
  selectRandomTicket;

window.jumpToTicket =
  jumpToTicket;

window.confirmPurchase =
  confirmPurchase;

window.claimBingo =
  claimBingo;

window.toggleSound =
  toggleSound;

window.toggleAutoDaub =
  toggleAutoDaub;

window.copyReferralCode =
  copyReferralCode;

window.copyTelebirrNumber =
  copyTelebirrNumber;

window.submitDepositRequest =
  submitDepositRequest;

window.submitWithdrawalRequest =
  submitWithdrawalRequest;

window.requestContactVerification =
  requestContactVerification;

window.closeWinnerModal =
  closeWinnerModal;
