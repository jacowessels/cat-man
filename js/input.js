// Swipe, keyboard and on-screen D-pad controls.
const KEYS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
  W: 'up', S: 'down', A: 'left', D: 'right',
};
export const SWIPE_PX = 12; // finger travel needed while swiping
export const FLICK_PX = 6; // smaller travel still counts when the finger lifts
const DOMINANCE = 1.2; // one axis must clearly win, so diagonals don't misfire

export function directionFromDelta(dx, dy, threshold = SWIPE_PX) {
  if (Math.hypot(dx, dy) < threshold) return null;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax >= ay * DOMINANCE) return dx > 0 ? 'right' : 'left';
  if (ay >= ax * DOMINANCE) return dy > 0 ? 'down' : 'up';
  return null;
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
    start = { id: e.pointerId, x: e.clientX, y: e.clientY, sent: false };
  });
  swipeArea.addEventListener('pointermove', (e) => {
    if (!start || e.pointerId !== start.id) return;
    // Look at every finger position the browser collected since the last
    // event, so a fast swipe is noticed as early as possible.
    const points = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
    if (points.length === 0) points.push(e);
    for (const pt of points) {
      const dir = directionFromDelta(pt.clientX - start.x, pt.clientY - start.y);
      if (dir) {
        onDirection(dir);
        start = { id: e.pointerId, x: pt.clientX, y: pt.clientY, sent: true };
      }
    }
  });
  swipeArea.addEventListener('pointerup', (e) => {
    if (!start || e.pointerId !== start.id) return;
    // A quick flick that lifted before reaching the swipe distance.
    if (!start.sent) {
      const dir = directionFromDelta(e.clientX - start.x, e.clientY - start.y, FLICK_PX);
      if (dir) onDirection(dir);
    }
    start = null;
  });
  swipeArea.addEventListener('pointercancel', (e) => {
    if (start && e.pointerId === start.id) start = null;
  });
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
