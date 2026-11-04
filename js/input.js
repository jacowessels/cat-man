// Swipe, keyboard and on-screen D-pad controls.
const KEYS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
  W: 'up', S: 'down', A: 'left', D: 'right',
};
const SWIPE_PX = 18;

export function directionFromDelta(dx, dy, threshold = SWIPE_PX) {
  if (Math.hypot(dx, dy) < threshold) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

function isUiElement(el) {
  return !!(el && el.closest && el.closest('button, input, label, a, .screen, .dpad'));
}

export function setupInput({ swipeArea, dpad, onDirection, onPause, isActive }) {
  window.addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT') return;
    const dir = KEYS[e.key];
    if (dir && isActive()) {
      e.preventDefault();
      onDirection(dir);
    } else if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && isActive(true)) {
      onPause();
    }
  });

  // Swipe: a direction is sent as soon as the finger has moved far enough,
  // then the start point resets, so one long swipe can steer round corners.
  let start = null;
  swipeArea.addEventListener('pointerdown', (e) => {
    if (isUiElement(e.target) || !isActive()) return;
    start = { id: e.pointerId, x: e.clientX, y: e.clientY };
  });
  swipeArea.addEventListener('pointermove', (e) => {
    if (!start || e.pointerId !== start.id) return;
    const dir = directionFromDelta(e.clientX - start.x, e.clientY - start.y);
    if (dir) {
      onDirection(dir);
      start = { id: e.pointerId, x: e.clientX, y: e.clientY };
    }
  });
  const end = (e) => {
    if (start && e.pointerId === start.id) start = null;
  };
  swipeArea.addEventListener('pointerup', end);
  swipeArea.addEventListener('pointercancel', end);
  // Stop the page from scrolling or zooming while swiping.
  swipeArea.addEventListener(
    'touchmove',
    (e) => {
      if (!isUiElement(e.target)) e.preventDefault();
    },
    { passive: false },
  );

  if (dpad) {
    for (const btn of dpad.querySelectorAll('[data-dir]')) {
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (isActive()) onDirection(btn.dataset.dir);
      });
    }
  }
}
