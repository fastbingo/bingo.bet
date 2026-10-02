/**
 * FAST BINGO TELEGRAM MINI APP
 * Production Version
 */

const CONFIG = {
  WORKER_URL: "https://bingobet.ketiolcj.workers.dev",
  TICKET_PRICE: 10,
  MAX_TICKETS: 4
};

// --------------------
// TELEGRAM
// --------------------

const tg = window.Telegram?.WebApp;

if (tg) {
  tg.ready();
  tg.expand();
}

const user = tg?.initDataUnsafe?.user || {
  id: 999999,
  first_name: "Guest"
};

// --------------------
// GLOBAL STATE
// --------------------

let userBalance = 0;
let selectedTickets = [];
let userTickets = [];
let drawnBalls = [];
let socket = null;
let muted = false;

// --------------------
// API
// --------------------

async function api(endpoint, options = {}) {
  const response = await fetch(
    `${CONFIG.WORKER_URL}${endpoint}`,
    {
      headers: {
        "Content-Type": "application/json"
      },
      ...options
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error || "Request Failed"
    );
  }

  return data;
}

// --------------------
// LOAD BALANCE
// --------------------

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

// --------------------
// UPDATE UI
// --------------------

function updateBalanceUI() {
  const el1 =
    document.getElementById(
      "user-balance"
    );

  const el2 =
    document.getElementById(
      "wallet-balance-large"
    );

  if (el1) {
    el1.innerText =
      userBalance.toFixed(2);
  }

  if (el2) {
    el2.innerText =
      `${userBalance.toFixed(2)} ETB`;
  }
}

// --------------------
// WEBSOCKET
// --------------------

function connectSocket() {

  const wsUrl =
    CONFIG.WORKER_URL.replace(
      "https://",
      "wss://"
    );

  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    console.log(
      "WebSocket Connected"
    );
  };

  socket.onmessage = event => {

    const message =
      JSON.parse(event.data);

    switch (message.type) {

      case "INIT_STATE":
        drawnBalls =
          message.drawnBalls || [];
        break;

      case "GAME_STARTED":
        drawnBalls = [];
        break;

      case "BALL_DRAWN":
        drawnBalls =
          message.drawnBalls;

        updateCurrentBall(
          message.ball
        );

        autoDaub(message.ball);

        break;

      case "WINNER_DECLARED":

        alert(
          `Winner: ${message.winner}`
        );

        break;

      case "GAME_OVER":

        alert(
          "Round Finished"
        );

        break;

      case "CLAIM_RESULT":

        if (message.success) {

          alert(
            "🎉 BINGO VERIFIED"
          );

          loadBalance();

        } else {

          alert(
            "Invalid Claim"
          );
        }

        break;
    }
  };

  socket.onclose = () => {

    console.log(
      "Reconnecting..."
    );

    setTimeout(
      connectSocket,
      3000
    );
  };
}

// --------------------
// TICKETS
// --------------------

function generateTicket(id) {

  function pick(min, max, count) {

    const nums = [];

    while (
      nums.length < count
    ) {

      const n =
        Math.floor(
          Math.random() *
            (max - min + 1)
        ) + min;

      if (
        !nums.includes(n)
      ) {
        nums.push(n);
      }
    }

    return nums;
  }

  const B =
    pick(1, 15, 5);

  const I =
    pick(16, 30, 5);

  const N =
    pick(31, 45, 4);

  const G =
    pick(46, 60, 5);

  const O =
    pick(61, 75, 5);

  return {
    id,
    grid: {
      B,
      I,
      N: [
        N[0],
        N[1],
        "FREE",
        N[2],
        N[3]
      ],
      G,
      O
    }
  };
}

function selectTicket(id) {

  if (
    selectedTickets.includes(id)
  ) {

    selectedTickets =
      selectedTickets.filter(
        t => t !== id
      );

    return;
  }

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

// --------------------
// PURCHASE
// --------------------

function buyTickets() {

  const total =
    selectedTickets.length *
    CONFIG.TICKET_PRICE;

  if (
    selectedTickets.length === 0
  ) {
    alert(
      "Select ticket"
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

  userTickets =
    selectedTickets.map(
      ticketId =>
        generateTicket(ticketId)
    );

  alert(
    "Tickets Purchased"
  );
}

// --------------------
// AUTO DAUB
// --------------------

function autoDaub(ball) {

  userTickets.forEach(ticket => {

    const cols = [
      "B",
      "I",
      "N",
      "G",
      "O"
    ];

    cols.forEach(col => {

      ticket.grid[col]
        .forEach(value => {

          if (
            value === ball
          ) {
            console.log(
              "Marked",
              ball
            );
          }

        });

    });

  });

}

// --------------------
// BALL UI
// --------------------

function updateCurrentBall(
  ball
) {

  const num =
    document.getElementById(
      "current-number"
    );

  if (num) {
    num.innerText = ball;
  }

}

// --------------------
// CLAIM BINGO
// --------------------

function claimBingo() {

  if (!socket) {

    alert(
      "Server unavailable"
    );

    return;
  }

  socket.send(
    JSON.stringify({
      type:
        "CLAIM_BINGO",
      userId:
        String(user.id),
      tickets:
        userTickets
    })
  );

}

// --------------------
// DEPOSIT
// --------------------

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
          body:
            JSON.stringify({
              userId:
                user.id,
              firstName:
                user.first_name,
              type:
                "Deposit",
              amount,
              details:
                txn
            })
        }
      );

    alert(
      `Deposit Submitted\n${result.txnId}`
    );

  } catch (err) {

    alert(
      err.message
    );

  }

}

// --------------------
// WITHDRAW
// --------------------

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
          body:
            JSON.stringify({
              userId:
                user.id,
              firstName:
                user.first_name,
              type:
                "Withdrawal",
              amount,
              details:
                phone
            })
        }
      );

    alert(
      `Withdrawal Submitted\n${result.txnId}`
    );

    await loadBalance();

  } catch (err) {

    alert(
      err.message
    );

  }

}

// --------------------
// NAVIGATION
// --------------------

function switchTab(tab) {

  [
    "home",
    "game",
    "wallet",
    "winners"
  ]
  .forEach(name => {

    document
      .getElementById(
        `view-${name}`
      )
      ?.classList.add(
        "hidden"
      );

  });

  document
    .getElementById(
      `view-${tab}`
    )
    ?.classList.remove(
      "hidden"
    );

}

// --------------------
// SOUND
// --------------------

function toggleSound() {

  muted = !muted;

  const btn =
    document.getElementById(
      "sound-toggle-btn"
    );

  if (btn) {
    btn.innerText =
      muted
        ? "🔇"
        : "🔊";
  }

}

// --------------------
// INIT
// --------------------

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    const username =
      document.getElementById(
        "user-name"
      );

    if (username) {
      username.innerText =
        user.first_name;
    }

    const userid =
      document.getElementById(
        "user-id-display"
      );

    if (userid) {
      userid.innerText =
        user.id;
    }

    await loadBalance();

    connectSocket();

    console.log(
      "Fast Bingo Ready"
    );

  }
);

// --------------------
// EXPORTS
// --------------------

window.switchTab =
  switchTab;

window.buyTickets =
  buyTickets;

window.claimBingo =
  claimBingo;

window.selectTicket =
  selectTicket;

window.submitDepositRequest =
  submitDepositRequest;

window.submit
