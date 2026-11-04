import { Game } from './game.js';
import { Renderer } from './render.js';
import { AudioEngine } from './audio.js';
import { setupInput } from './input.js';
import { LocalScoreStore, sanitizeName } from './scores.js';

const $ = (id) => document.getElementById(id);
const DPAD_KEY = 'catman.dpad';

const scores = new LocalScoreStore();
const audio = new AudioEngine();
const renderer = new Renderer($('game'));
let playerName = scores.getLastName();
let lastSubmitted = null;

const game = new Game({ onEvent: handleEvent });
// Handy for testing in the browser console.
globalThis.catman = { game, audio, scores };

function handleEvent(name, data) {
  switch (name) {
    case 'levelStart':
      audio.setTempo(data.bpm);
      audio.startMusic(data.bpm);
      audio.duck(false);
      audio.play('levelStart');
      updateHud(true);
      break;
    case 'caught':
      audio.duck(true);
      audio.play('caught');
      break;
    case 'ready':
      audio.duck(false);
      break;
    case 'levelClear':
      audio.duck(true);
      audio.play('levelClear');
      break;
    case 'gameOver':
      audio.stopMusic();
      audio.play('gameOver');
      onGameOver(data);
      break;
    case 'pause':
      audio.duck(true);
      break;
    case 'resume':
      audio.duck(false);
      break;
    default:
      audio.play(name, data);
  }
}

// ---------- Screens ----------
function show(id) {
  for (const s of ['screen-start', 'screen-pause', 'screen-over']) $(s).hidden = s !== id;
}

async function renderScores(listEl, highlight) {
  const top = await scores.top(10);
  listEl.innerHTML = '';
  if (top.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty-row';
    li.innerHTML = '<span class="empty">No scores yet. Be the first!</span>';
    listEl.appendChild(li);
    return;
  }
  top.forEach((e, i) => {
    const li = document.createElement('li');
    if (highlight && e.date === highlight.date && e.score === highlight.score) li.className = 'me';
    const cells = [
      ['pos', `${i + 1}.`],
      ['nm', e.name],
      ['lv', `Lv ${e.level}`],
      ['sc', e.score.toLocaleString()],
    ];
    for (const [cls, text] of cells) {
      const span = document.createElement('span');
      span.className = cls;
      span.textContent = text;
      li.appendChild(span);
    }
    listEl.appendChild(li);
  });
}

function showStart() {
  audio.stopMusic();
  game.state = 'idle';
  $('hud').hidden = true;
  $('player-name').value = playerName;
  show('screen-start');
  renderScores($('scores-start'));
  layout();
}

function startGame() {
  audio.unlock();
  $('hud').hidden = false;
  $('hud-name').textContent = playerName;
  show(null);
  game.start(playerName);
  layout();
}

async function onGameOver({ score, level }) {
  const result = await scores.submit({ name: playerName, score, level });
  const top = await scores.top(10);
  lastSubmitted = result.rank ? top[result.rank - 1] : null;
  $('over-summary').textContent = `${playerName}, you scored ${score.toLocaleString()} and reached level ${level}.`;
  $('over-rank').textContent = result.rank === 1
    ? '🏆 New high score!'
    : result.rank
      ? `You are number ${result.rank} on the high-score table!`
      : '';
  await renderScores($('scores-over'), lastSubmitted);
  setTimeout(() => show('screen-over'), 900);
}

$('name-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = sanitizeName($('player-name').value);
  if (!name) {
    $('name-error').hidden = false;
    $('player-name').focus();
    return;
  }
  $('name-error').hidden = true;
  playerName = name;
  scores.setLastName(name);
  $('player-name').blur();
  startGame();
});

$('btn-again').addEventListener('click', startGame);
$('btn-change').addEventListener('click', showStart);
$('btn-quit').addEventListener('click', showStart);
$('btn-resume').addEventListener('click', togglePause);
$('btn-pause').addEventListener('click', togglePause);

function togglePause() {
  audio.unlock();
  if (game.state === 'paused') {
    game.resume();
    show(null);
  } else if (['ready', 'playing', 'dogEaten', 'dying', 'levelClear'].includes(game.state)) {
    game.pause();
    show('screen-pause');
  }
}

function updateMuteButton() {
  $('btn-mute').textContent = audio.muted ? '🔇' : '🔊';
}
$('btn-mute').addEventListener('click', () => {
  audio.unlock();
  audio.setMuted(!audio.muted);
  updateMuteButton();
});
updateMuteButton();

// D-pad option
function readDpad() {
  try {
    return localStorage.getItem(DPAD_KEY) === '1';
  } catch {
    return false;
  }
}
$('opt-dpad').checked = readDpad();
$('opt-dpad').addEventListener('change', (e) => {
  try {
    localStorage.setItem(DPAD_KEY, e.target.checked ? '1' : '0');
  } catch {
    // ignore
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && ['ready', 'playing', 'dogEaten'].includes(game.state)) {
    game.pause();
    show('screen-pause');
  }
});

// ---------- Input ----------
setupInput({
  swipeArea: $('app'),
  dpad: $('dpad'),
  onDirection: (dir) => game.setDirection(dir),
  onPause: togglePause,
  isActive: (forPause) => (forPause ? game.state !== 'idle' && game.state !== 'gameover' : !['idle', 'gameover', 'paused'].includes(game.state)),
});

// ---------- HUD ----------
let hudCache = '';
function updateHud(force) {
  const key = `${game.score}|${game.level}|${game.lives}`;
  if (!force && key === hudCache) return;
  hudCache = key;
  $('hud-score').textContent = game.score.toLocaleString();
  $('hud-level').textContent = String(game.level);
  $('hud-lives').textContent = '🐱'.repeat(Math.max(0, game.lives));
}

// ---------- Layout ----------
function layout() {
  const playing = game.state !== 'idle';
  $('dpad').hidden = !(playing && $('opt-dpad').checked);
  const stage = $('stage');
  const r = stage.getBoundingClientRect();
  if (!game.maze) {
    game.start('preview');
    game.state = 'idle';
  }
  renderer.resize(game.maze, r.width - 16, r.height - 12);
}
window.addEventListener('resize', layout);
window.addEventListener('orientationchange', () => setTimeout(layout, 200));

// ---------- Main loop ----------
const STEP = 1 / 120;
let last = performance.now();
let acc = 0;
let lastMaze = null;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (game.state !== 'idle') {
    acc += dt;
    while (acc >= STEP) {
      game.update(STEP);
      acc -= STEP;
    }
  } else {
    acc = 0;
    game.time += dt;
  }
  if (game.maze !== lastMaze) {
    lastMaze = game.maze;
    renderer.wallLayer = null;
  }
  renderer.draw(game);
  updateHud(false);
  requestAnimationFrame(frame);
}

showStart();
requestAnimationFrame(frame);
