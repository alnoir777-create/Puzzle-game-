const COLS = 10, ROWS = 18, DROP_MS = 650;
const POINTS_PIECE = 5, POINTS_LINE = 120;
const PIECES = {
  I: ['#38bdf8', [[1,1,1,1]]],
  O: ['#facc15', [[1,1],[1,1]]],
  T: ['#a78bfa', [[1,1,1],[0,1,0]]],
  S: ['#4ade80', [[0,1,1],[1,1,0]]],
  Z: ['#f87171', [[1,1,0],[0,1,1]]],
  J: ['#60a5fa', [[1,0,0],[1,1,1]]],
  L: ['#fb923c', [[0,0,1],[1,1,1]]]
};
const $ = (id) => document.getElementById(id);
const bc = $('board'), bx = bc.getContext('2d');
const nc = $('next'), nx = nc.getContext('2d');
const isTouch = !(matchMedia('(hover:hover) and (pointer:fine)').matches);
const HINT = isTouch
  ? 'Glisse sur le plateau pour déplacer, touche pour tourner, balaie vite vers le bas pour faire tomber. Tu peux aussi utiliser les boutons.'
  : 'Flèches ou A / D pour bouger, ↑ ou W pour tourner, Espace pour faire tomber, P pour la pause.';

let board, cur, nxt, score = 0, best = 0, timer = null, state = 'idle', cell = 24;

try { best = Number(localStorage.getItem('bloc-best')) || 0; } catch (e) {}
$('best').textContent = best;

const newBoard = () => Array.from({ length: ROWS }, () => Array(COLS).fill(null));
function rnd() {
  const k = Object.keys(PIECES)[Math.floor(Math.random() * 7)];
  return { color: PIECES[k][0], m: PIECES[k][1].map((r) => [...r]), x: 0, y: 0 };
}
const buzz = (ms) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

function collides(m, x, y) {
  for (let r = 0; r < m.length; r++) for (let c = 0; c < m[r].length; c++) {
    if (!m[r][c]) continue;
    const X = x + c, Y = y + r;
    if (X < 0 || X >= COLS || Y >= ROWS) return true;
    if (Y >= 0 && board[Y][X]) return true;
  }
  return false;
}
function spawn() {
  cur = nxt || rnd();
  cur.x = Math.floor((COLS - cur.m[0].length) / 2); cur.y = 0;
  nxt = rnd();
  if (collides(cur.m, cur.x, cur.y)) end();
}
function setScore(v) {
  score = v; $('score').textContent = score;
  if (score > best) {
    best = score; $('best').textContent = best;
    try { localStorage.setItem('bloc-best', best); } catch (e) {}
  }
}
function lock() {
  cur.m.forEach((row, r) => row.forEach((v, c) => { if (v && cur.y + r >= 0) board[cur.y + r][cur.x + c] = cur.color; }));
  let n = 0;
  for (let r = ROWS - 1; r >= 0; r--) if (board[r].every(Boolean)) { board.splice(r, 1); board.unshift(Array(COLS).fill(null)); n++; r++; }
  setScore(score + POINTS_PIECE + n * POINTS_LINE);
  if (n) buzz(n > 1 ? [30, 30, 60] : 30);
  spawn(); draw();
}
function move(dx, dy) {
  if (state !== 'running') return false;
  if (!collides(cur.m, cur.x + dx, cur.y + dy)) { cur.x += dx; cur.y += dy; draw(); return true; }
  if (dy > 0) lock();
  return false;
}
function rotate(ccw) {
  if (state !== 'running') return;
  const m = cur.m, R = m.length, C = m[0].length;
  const t = Array.from({ length: C }, () => Array(R).fill(0));
  for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) { if (ccw) t[C - 1 - x][y] = m[y][x]; else t[x][R - 1 - y] = m[y][x]; }
  for (const k of [0, -1, 1, -2, 2]) if (!collides(t, cur.x + k, cur.y)) { cur.m = t; cur.x += k; draw(); return; }
}
function ghostY() { let y = cur.y; while (!collides(cur.m, cur.x, y + 1)) y++; return y; }
function hardDrop() {
  if (state !== 'running') return;
  cur.y = ghostY(); buzz(15); lock();
}
function act(a) {
  if (a === 'left') move(-1, 0);
  else if (a === 'right') move(1, 0);
  else if (a === 'down') move(0, 1);
  else if (a === 'rotate') rotate();
  else if (a === 'rotateL') rotate(true);
  else if (a === 'drop') hardDrop();
}

function tick() { clearInterval(timer); timer = setInterval(() => move(0, 1), DROP_MS); }
function show(title, text, btn) {
  $('otitle').textContent = title; $('otext').textContent = text; $('go').textContent = btn;
  $('ologo').hidden = state !== 'idle';
  $('overlay').classList.remove('hidden');
}
function ui() {
  $('pauseBtn').hidden = state !== 'running';
  $('restartBtn').hidden = state === 'idle';
}
function newGame() {
  board = newBoard(); nxt = rnd(); setScore(0); spawn();
  state = 'running'; $('overlay').classList.add('hidden'); ui(); draw(); tick();
}
function pause() {
  if (state !== 'running') return;
  state = 'paused'; clearInterval(timer); ui();
  show('Pause', 'Ta partie est en pause. Reprends quand tu veux.', 'Reprendre');
}
function resume() { state = 'running'; $('overlay').classList.add('hidden'); ui(); tick(); }
function end() {
  state = 'over'; clearInterval(timer); ui(); buzz([80, 40, 120]);
  show('Partie terminée', 'Score final : ' + score, 'Rejouer');
}

/* Dessin net sur écrans haute densité */
function fit() {
  const st = $('stage'), dpr = window.devicePixelRatio || 1;
  cell = Math.max(10, Math.min(40, Math.floor(Math.min((st.clientWidth - 4) / COLS, (st.clientHeight - 4) / ROWS))));
  bc.style.width = cell * COLS + 'px'; bc.style.height = cell * ROWS + 'px';
  bc.width = cell * COLS * dpr; bc.height = cell * ROWS * dpr;
  const o = $('overlay'); o.style.width = bc.style.width; o.style.height = bc.style.height; o.style.margin = 'auto';
  nc.width = 72 * dpr; nc.height = 72 * dpr;
  draw();
}
function block(ctx, x, y, s, color, alpha) {
  ctx.globalAlpha = alpha || 1;
  ctx.fillStyle = color; ctx.fillRect(x * s + 1, y * s + 1, s - 2, s - 2);
  ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(x * s + 1, y * s + 1, s - 2, Math.max(2, s * .15));
  ctx.globalAlpha = 1;
}
function draw() {
  if (!board) return;
  const dpr = window.devicePixelRatio || 1;
  bx.setTransform(dpr, 0, 0, dpr, 0, 0);
  bx.fillStyle = '#0b1120'; bx.fillRect(0, 0, cell * COLS, cell * ROWS);
  bx.strokeStyle = 'rgba(148,163,184,.1)'; bx.lineWidth = 1;
  for (let x = 1; x < COLS; x++) { bx.beginPath(); bx.moveTo(x * cell + .5, 0); bx.lineTo(x * cell + .5, cell * ROWS); bx.stroke(); }
  for (let y = 1; y < ROWS; y++) { bx.beginPath(); bx.moveTo(0, y * cell + .5); bx.lineTo(cell * COLS, y * cell + .5); bx.stroke(); }
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (board[y][x]) block(bx, x, y, cell, board[y][x]);
  if (cur && state !== 'over') {
    const gy = ghostY();
    cur.m.forEach((row, r) => row.forEach((v, c) => { if (v) block(bx, cur.x + c, gy + r, cell, cur.color, .22); }));
    cur.m.forEach((row, r) => row.forEach((v, c) => { if (v && cur.y + r >= 0) block(bx, cur.x + c, cur.y + r, cell, cur.color); }));
  }
  nx.setTransform(dpr, 0, 0, dpr, 0, 0);
  nx.clearRect(0, 0, 72, 72);
  if (nxt) {
    const s = 16, m = nxt.m, ox = (72 - m[0].length * s) / 2 / s, oy = (72 - m.length * s) / 2 / s;
    m.forEach((row, r) => row.forEach((v, c) => { if (v) block(nx, ox + c, oy + r, s, nxt.color); }));
  }
}

/* Boutons : appui maintenu = répétition pour les déplacements */
document.querySelectorAll('.btn').forEach((b) => {
  const a = b.dataset.a, rep = a === 'left' || a === 'right' || a === 'down';
  let t, i;
  const stop = () => { clearTimeout(t); clearInterval(i); };
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault(); stop(); act(a);
    if (rep) t = setTimeout(() => { i = setInterval(() => act(a), a === 'down' ? 55 : 80); }, 180);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => b.addEventListener(ev, stop));
});

/* Gestes sur le plateau : glisser = déplacer, toucher = tourner, flick bas = chute */
let g = null;
bc.addEventListener('pointerdown', (e) => {
  if (state !== 'running') return;
  bc.setPointerCapture(e.pointerId);
  g = { x0: e.clientX, y0: e.clientY, lx: e.clientX, ly: e.clientY, t: performance.now(), moved: false };
});
bc.addEventListener('pointermove', (e) => {
  if (!g || state !== 'running') return;
  const step = cell * 0.9;
  while (Math.abs(e.clientX - g.lx) >= step) {
    const d = e.clientX > g.lx ? 1 : -1; g.lx += d * step; g.moved = true; move(d, 0);
  }
  if (Math.abs(e.clientY - g.y0) > Math.abs(e.clientX - g.x0)) {
    while (e.clientY - g.ly >= cell) { g.ly += cell; g.moved = true; move(0, 1); }
  }
});
function release(e) {
  if (!g) return;
  const dt = performance.now() - g.t, dy = e.clientY - g.y0, dx = e.clientX - g.x0;
  if (state === 'running') {
    if (dy > 80 && dt < 250 && Math.abs(dx) < dy / 2) hardDrop();
    else if (!g.moved && dt < 300 && Math.hypot(dx, dy) < 12) rotate();
  }
  g = null;
}
bc.addEventListener('pointerup', release);
bc.addEventListener('pointercancel', () => { g = null; });

/* Boutons de l’interface */
$('go').addEventListener('click', () => (state === 'paused' ? resume() : newGame()));
$('pauseBtn').addEventListener('click', pause);
$('restartBtn').addEventListener('click', newGame);
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'p' || k === 'escape') { state === 'paused' ? resume() : pause(); return; }
  if (state !== 'running') return;
  const map = { arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right', arrowdown: 'down', s: 'down', arrowup: 'rotate', w: 'rotate' };
  const a = map[k] || (e.code === 'Space' ? 'drop' : null);
  if (a) { e.preventDefault(); act(a); }
});
new ResizeObserver(fit).observe($('stage'));
addEventListener('orientationchange', () => setTimeout(fit, 200));

board = newBoard(); nxt = rnd();
$('otext').textContent = HINT;
fit();
