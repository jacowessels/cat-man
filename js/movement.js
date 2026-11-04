// Grid movement shared by the cat and the dogs.
// A Mover sits on tile (tx, ty) and is a fraction `p` (0..1) of the way
// towards the next tile in direction `dir`.
export const DIRS = {
  up: { x: 0, y: -1, name: 'up' },
  down: { x: 0, y: 1, name: 'down' },
  left: { x: -1, y: 0, name: 'left' },
  right: { x: 1, y: 0, name: 'right' },
};
export const NONE = { x: 0, y: 0, name: 'none' };
export const DIR_ORDER = [DIRS.up, DIRS.left, DIRS.down, DIRS.right];

export function isNone(d) {
  return !d || (d.x === 0 && d.y === 0);
}

export function opposite(d) {
  if (isNone(d)) return NONE;
  if (d === DIRS.up) return DIRS.down;
  if (d === DIRS.down) return DIRS.up;
  if (d === DIRS.left) return DIRS.right;
  return DIRS.left;
}

export class Mover {
  constructor(x, y, wrapX = (v) => v) {
    this.tx = x;
    this.ty = y;
    this.dir = NONE;
    this.p = 0;
    this.wrapX = wrapX;
  }

  get x() {
    return this.tx + this.dir.x * this.p;
  }

  get y() {
    return this.ty + this.dir.y * this.p;
  }

  // Nearest tile to the mover's current position.
  get nearestTile() {
    if (this.p < 0.5) return { x: this.tx, y: this.ty };
    return { x: this.wrapX(this.tx + this.dir.x), y: this.ty + this.dir.y };
  }

  place(x, y, dir = NONE) {
    this.tx = x;
    this.ty = y;
    this.p = 0;
    this.dir = dir;
  }

  // Turn around on the spot (allowed between tiles).
  reverse() {
    if (isNone(this.dir)) return;
    if (this.p > 0) {
      this.tx = this.wrapX(this.tx + this.dir.x);
      this.ty += this.dir.y;
      this.p = 1 - this.p;
    }
    this.dir = opposite(this.dir);
  }

  // Forgiving turns: if the cat has only just passed the centre of a tile
  // where the wanted turn is open, step back to that centre and turn there.
  // Returns the distance given back (to be added to this frame's movement),
  // or 0 if no turn was made.
  tryLateTurn(want, canEnter, tolerance) {
    if (isNone(this.dir) || isNone(want)) return 0;
    if (want === this.dir || want === opposite(this.dir)) return 0;
    if (this.p <= 0 || this.p > tolerance) return 0;
    if (!canEnter(this.tx + want.x, this.ty + want.y)) return 0;
    const back = this.p;
    this.p = 0;
    this.dir = want;
    return back;
  }

  // Move `dist` tiles. At every tile centre, `choose(mover)` returns the
  // direction it would like to go; `canEnter(x, y)` says if a tile is open.
  advance(dist, canEnter, choose) {
    let guard = 0;
    while (dist > 1e-9 && guard++ < 64) {
      if (isNone(this.dir)) {
        const d = choose(this);
        if (isNone(d) || !canEnter(this.tx + d.x, this.ty + d.y)) return;
        this.dir = d;
        this.p = 0;
      } else if (this.p === 0 && !canEnter(this.tx + this.dir.x, this.ty + this.dir.y)) {
        const d = choose(this);
        if (isNone(d) || !canEnter(this.tx + d.x, this.ty + d.y)) {
          this.dir = NONE;
          return;
        }
        this.dir = d;
      }
      const remaining = 1 - this.p;
      if (dist < remaining) {
        this.p += dist;
        return;
      }
      dist -= remaining;
      this.tx = this.wrapX(this.tx + this.dir.x);
      this.ty += this.dir.y;
      this.p = 0;
      const d = choose(this);
      if (!isNone(d) && canEnter(this.tx + d.x, this.ty + d.y)) {
        this.dir = d;
      } else if (!canEnter(this.tx + this.dir.x, this.ty + this.dir.y)) {
        this.dir = NONE;
        return;
      }
    }
  }
}

// The cat goes the way the player asked if it can, otherwise keeps going.
// The request stays remembered, so a swipe made just before a corner works.
export function catChooser(getWanted, canEnter) {
  return (m) => {
    const w = getWanted();
    if (!isNone(w) && canEnter(m.tx + w.x, m.ty + w.y)) return w;
    return m.dir;
  };
}
