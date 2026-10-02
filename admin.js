const API =
"https://YOUR-WORKER.workers.dev";

async function loadPending() {

const res =
await fetch(
`${API}/api/admin/pending`
);

const data =
await res.json();

document.getElementById(
"transactions"
).innerHTML = "";

let dep = 0;
let wd = 0;

data.forEach(txn => {

if(txn.type === "Deposit"){
dep++;
}

if(txn.type === "Withdrawal"){
wd++;
}

const div =
document.createElement("div");

div.className = "txn";

div.innerHTML = `
<h3>${txn.type}</h3>

<p>User: ${txn.first_name}</p>

<p>Amount: ${txn.amount} ETB</p>

<p>Details: ${txn.details}</p>

<p>Status: ${txn.status}</p>

<div class="actions">

<button
class="approve"
onclick="approveTxn('${txn.id}')">

Approve

</button>

<button
class="reject"
onclick="rejectTxn('${txn.id}')">

Reject

</button>

</div>
`;

document
.getElementById("transactions")
.appendChild(div);

});

document.getElementById(
"deposit-count"
).innerText = dep;

document.getElementById(
"withdraw-count"
).innerText = wd;

}

async function approveTxn(id){

await fetch(
`${API}/api/admin/action`,
{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
txnId:id,
action:"approve"
})
}
);

loadPending();

}

async function rejectTxn(id){

await fetch(
`${API}/api/admin/action`,
{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
txnId:id,
action:"reject"
})
}
);

loadPending();

}

loadPending();
