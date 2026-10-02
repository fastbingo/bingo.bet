/* ==========================================
   CONFIG
========================================== */

const API =
"https://https://bingobet.ketiolcj.workers.dev/";

const ADMIN_TOKEN =
localStorage.getItem(
  "adminToken"
);

/* ==========================================
   AUTH CHECK
========================================== */

if (!ADMIN_TOKEN) {

  window.location.href =
    "admin-login.html";

}

/* ==========================================
   LOAD DASHBOARD
========================================== */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    loadPending();

  }
);

/* ==========================================
   LOAD PENDING TRANSACTIONS
========================================== */

async function loadPending() {

  try {

    const response =
      await fetch(
        `${API}/api/admin/pending`,
        {
          headers: {
            "x-admin-key":
              ADMIN_TOKEN
          }
        }
      );

    if (
      response.status === 403
    ) {

      logout();

      return;
    }

    const data =
      await response.json();

    renderTransactions(
      data
    );

  } catch (error) {

    console.error(error);

    document.getElementById(
      "transactions"
    ).innerHTML = `
      <div class="txn">
        Failed to load transactions.
      </div>
    `;

  }

}

/* ==========================================
   RENDER TRANSACTIONS
========================================== */

function renderTransactions(
  transactions
) {

  const container =
    document.getElementById(
      "transactions"
    );

  let deposits = 0;
  let withdrawals = 0;

  container.innerHTML = "";

  if (
    !transactions ||
    transactions.length === 0
  ) {

    container.innerHTML = `
      <div class="txn">
        No pending transactions.
      </div>
    `;

    updateCounters(
      0,
      0
    );

    return;
  }

  transactions.forEach(txn => {

    if (
      txn.type === "Deposit"
    ) {
      deposits++;
    }

    if (
      txn.type === "Withdrawal"
    ) {
      withdrawals++;
    }

    const card =
      document.createElement(
        "div"
      );

    card.className = "txn";

    card.innerHTML = `

      <h3>${txn.type}</h3>

      <p>
        <strong>User:</strong>
        ${txn.first_name}
      </p>

      <p>
        <strong>Amount:</strong>
        ${txn.amount} ETB
      </p>

      <p>
        <strong>Details:</strong>
        ${txn.details}
      </p>

      <p>
        <strong>Status:</strong>
        ${txn.status}
      </p>

      <p>
        <strong>Date:</strong>
        ${txn.created_at}
      </p>

      <div class="actions">

        <button
          class="approve"
          onclick="approveTxn('${txn.id}')">

          ✅ Approve

        </button>

        <button
          class="reject"
          onclick="rejectTxn('${txn.id}')">

          ❌ Reject

        </button>

      </div>

    `;

    container.appendChild(
      card
    );

  });

  updateCounters(
    deposits,
    withdrawals
  );

}

/* ==========================================
   UPDATE COUNTERS
========================================== */

function updateCounters(
  deposits,
  withdrawals
) {

  const dep =
    document.getElementById(
      "deposit-count"
    );

  const wd =
    document.getElementById(
      "withdraw-count"
    );

  if (dep) {
    dep.textContent =
      deposits;
  }

  if (wd) {
    wd.textContent =
      withdrawals;
  }

}

/* ==========================================
   APPROVE
========================================== */

async function approveTxn(
  txnId
) {

  const ok =
    confirm(
      "Approve this transaction?"
    );

  if (!ok) return;

  try {

    const response =
      await fetch(
        `${API}/api/admin/action`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "x-admin-key":
              ADMIN_TOKEN
          },

          body: JSON.stringify({

            txnId,
            action: "approve"

          })

        }
      );

    const result =
      await response.json();

    if (
      result.success
    ) {

      alert(
        "Transaction approved."
      );

      loadPending();

    } else {

      alert(
        result.error ||
        "Unable to approve."
      );

    }

  } catch (error) {

    console.error(error);

    alert(
      "Approval failed."
    );

  }

}

/* ==========================================
   REJECT
========================================== */

async function rejectTxn(
  txnId
) {

  const ok =
    confirm(
      "Reject this transaction?"
    );

  if (!ok) return;

  try {

    const response =
      await fetch(
        `${API}/api/admin/action`,
        {
          method: "POST",

          headers: {

            "Content-Type":
              "application/json",

            "x-admin-key":
              ADMIN_TOKEN

          },

          body: JSON.stringify({

            txnId,
            action: "reject"

          })

        }
      );

    const result =
      await response.json();

    if (
      result.success
    ) {

      alert(
        "Transaction rejected."
      );

      loadPending();

    } else {

      alert(
        result.error ||
        "Unable to reject."
      );

    }

  } catch (error) {

    console.error(error);

    alert(
      "Rejection failed."
    );

  }

}

/* ==========================================
   LOGOUT
========================================== */

function logout() {

  localStorage.removeItem(
    "adminToken"
  );

  window.location.href =
    "admin-login.html";

}

/* ==========================================
   AUTO REFRESH
========================================== */

setInterval(
  loadPending,
  15000
);

window.logout =
  logout;

window.approveTxn =
  approveTxn;

window.rejectTxn =
  rejectTxn;
