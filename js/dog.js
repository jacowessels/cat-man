import { Mover, NONE, DIRS, DIR_ORDER, opposite, isNone } from './movement.js';
import { KENNEL_EXIT, KENNEL_CENTER } from './maze.js';

// Each dog has its own colours, home corner and way of picking a target.
export const DOG_TYPES = [
  { name: 'Rex', fur: '#9a5b2e', ear: '#5e3517', snout: '#d9a877', corner: { x: 17, y: -3 }, style: 'direct' },
  { name: 'Bella', fur: '#e0b27a', ear: '#a8733f', snout: '#f6dcb6', corner: { x: 1, y: -3 }, style: 'ahead' },
  { name: 'Max', fur: '#8e959c', ear: '#4b5157', snout: '#c9ced3', corner: { x: 18, y: 23 }, style: 'flank' },
  { name: 'Daisy', fur: '#f3f0ea', ear: '#2b2b2b', snout: '#ffffff', corner: { x: 0, y: 23 }, style: 'shy', spots: true },
];

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export class Dog {
  constructor(index, type, home, maze) {
    this.index = index;
    this.type = type;
    this.home = home;
    this.maze = maze;
    this.mover = new Mover(home.x, home.y, (x) => maze.wrapX(x));
    // state: 'house' | 'leaving' | 'active' | 'eaten' | 'entering'
    this.state = 'house';
    this.scared = false;
    this.releaseAt = 0;
  }

  get x() {
    return this.mover.x;
  }

  get y() {
    return this.mover.y;
  }

  canEnter(x, y) {
    const inKennelMode = this.state === 'leaving' || this.state === 'entering' || this.state === 'house';
    return this.maze.dogCanEnter(x, y, inKennelMode);
  }

  // Where this dog wants to go right now.
  target(game) {
    const cat = game.cat;
    const c = { x: cat.tx, y: cat.ty };
    const cd = isNone(cat.dir) ? NONE : cat.dir;
    if (this.state === 'eaten') return KENNEL_EXIT;
    if (this.state === 'entering') return KENNEL_CENTER;
    if (this.state === 'leaving') return KENNEL_EXIT;
    if (game.mode === 'scatter') return this.type.corner;
    switch (this.type.style) {
      case 'ahead':
        return { x: c.x + cd.x * 4, y: c.y + cd.y * 4 };
      case 'flank': {
        const lead = game.dogs[0];
        if (!lead || lead === this) return c;
        const px = c.x + cd.x * 2;
        const py = c.y + cd.y * 2;
        return { x: lead.mover.tx + (px - lead.mover.tx) * 2, y: lead.mover.ty + (py - lead.mover.ty) * 2 };
      }
      case 'shy':
        if (dist2(this.mover.tx, this.mover.ty, c.x, c.y) > 64) return c;
        return this.type.corner;
      default:
        return c;
    }
  }

  // Called at every tile centre to pick the next direction.
  choose(game) {
    const m = this.mover;
    let allowReverse = isNone(m.dir);

    if (this.state === 'leaving' && m.tx === KENNEL_EXIT.x && m.ty === KENNEL_EXIT.y) {
      this.state = 'active';
      allowReverse = true;
      if (isNone(m.dir) || m.dir === DIRS.up) {
        return this.pickBest(game, true, DIRS.down);
      }
    }
    if (this.state === 'eaten' && m.tx === KENNEL_EXIT.x && m.ty === KENNEL_EXIT.y) {
      this.state = 'entering';
      allowReverse = true;
    }
    if (this.state === 'entering' && m.tx === KENNEL_CENTER.x && m.ty === KENNEL_CENTER.y) {
      this.state = 'leaving';
      allowReverse = true;
    }
    return this.pickBest(game, allowReverse);
  }

  pickBest(game, allowReverse, forbid = null) {
    const m = this.mover;
    const back = opposite(m.dir);
    const options = DIR_ORDER.filter(
      (d) => d !== forbid && (allowReverse || d !== back) && this.canEnter(m.tx + d.x, m.ty + d.y),
    );
    if (options.length === 0) {
      return this.canEnter(m.tx + back.x, m.ty + back.y) ? back : NONE;
    }
    if (this.scared && this.state === 'active') {
      return options[Math.floor(game.rng() * options.length)];
    }
    const t = this.target(game);
    let best = options[0];
    let bestD = Infinity;
    for (const d of options) {
      const dd = dist2(m.tx + d.x, m.ty + d.y, t.x, t.y);
      if (dd < bestD) {
        bestD = dd;
        best = d;
      }
    }
    return best;
  }

  speed(cfg) {
    switch (this.state) {
      case 'house':
        return 0;
      case 'leaving':
      case 'entering':
        return this.state === 'entering' ? cfg.homeRunDogSpeed * 0.6 : cfg.kennelDogSpeed;
      case 'eaten':
        return cfg.homeRunDogSpeed;
      default:
        if (this.maze.isTunnel(this.mover.tx, this.mover.ty)) return cfg.tunnelDogSpeed;
        return this.scared ? cfg.scaredDogSpeed : cfg.dogSpeed;
    }
  }

  update(dt, game) {
    if (this.state === 'house') {
      if (game.levelTime >= this.releaseAt) this.state = 'leaving';
      else return;
    }
    const dist = this.speed(game.cfg) * dt;
    this.mover.advance(
      dist,
      (x, y) => this.canEnter(x, y),
      () => this.choose(game),
    );
  }
}
