let adminWs = null;
let drawn = [];

function initAdmin() {
  const wsUrl = window.location.protocol === 'https:' ? 'wss://' : 'ws://' + window.location.host + '/ws';
  adminWs = new WebSocket(wsUrl);

  adminWs.onmessage = (evt) => {
    const msg = JSON.parse(evt.data);
    if (msg.type === 'BALL_DRAWN') {
      drawn.push(msg.ball);
      document.getElementById('count').innerText = drawn.length;
      renderMatrix();
    }
  };
  renderMatrix();
}

function renderMatrix() {
  const container = document.getElementById('admin-matrix');
  container.innerHTML = '';
  for (let i = 1; i <= 75; i++) {
    const isCalled = drawn.includes(i);
    container.innerHTML += `<div class="cell ${isCalled ? 'called' : ''}">${i}</div>`;
  }
}

function startAutoDraw() {
  if (adminWs) adminWs.send(JSON.stringify({ type: 'ADMIN_START_GAME' }));
}

function resetGame() {
  drawn = [];
  document.getElementById('count').innerText = '0';
  renderMatrix();
}

window.onload = initAdmin;
