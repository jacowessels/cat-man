import { Maze, DOG_HOMES, FISH_SPOT } from './maze.js';
import { Mover, DIRS, NONE, isNone, opposite, catChooser } from './movement.js';
import { Dog, DOG_TYPES } from './dog.js';
import { levelConfig, LIVES_PER_LEVEL } from './levels.js';

export const POINTS = { mouse: 10, catnip: 50, dogBase: 200 };
const FISH_AT_MICE = [60, 130]; // a fish appears after this many mice are eaten
const FISH_SECONDS = 9;
const CATCH_DISTANCE = 0.6;

// All the game rules. No drawing or sound here: the game reports what
// happened through `onEvent(name, data)` so the page can react.
export class Game {
  constructor({ onEvent = () => {}, rng = Math.random } = {}) {
    this.onEvent = onEvent;
    this.rng = rng;
    this.state = 'idle';
    this.score = 0;
    this.level = 1;
    this.lives = LIVES_PER_LEVEL;
    this.popups = [];
    this.time = 0;
  }

  emit(name, data = {}) {
    try {
      this.onEvent(name, data);
    } catch (e) {
      console.error(e);
    }
  }

  start(playerName = 'Player') {
    this.playerName = playerName;
    this.score = 0;
    this.level = 1;
    this.startLevel();
  }

  startLevel() {
    this.cfg = levelConfig(this.level);
    this.maze = new Maze();
    this.lives = LIVES_PER_LEVEL;
    this.miceEaten = 0;
    this.fishSpawned = 0;
    this.resetPositions();
    this.state = 'ready';
    this.stateTimer = 2.2;
    this.banner = `LEVEL ${this.level}`;
    this.emit('levelStart', { level: this.level, bpm: this.cfg.musicBpm });
  }

  resetPositions() {
    const m = this.maze;
    this.cat = new Mover(m.catStart.x, m.catStart.y, (x) => m.wrapX(x));
    this.cat.dir = NONE;
    this.wanted = DIRS.left;
    this.mouthTime = 0;
    this.levelTime = 0;
    this.mode = 'scatter';
    this.modeTimer = this.cfg.scatterSeconds;
    this.scaredTimer = 0;
    this.dogsEatenThisCatnip = 0;
    this.fish = null;
    this.dogs = [];
    for (let i = 0; i < this.cfg.dogCount; i++) {
      const dog = new Dog(i, DOG_TYPES[i], DOG_HOMES[i], m);
      if (i === 0) {
        dog.state = 'active';
        dog.mover.dir = DIRS.left;
      } else {
        dog.releaseAt = i * this.cfg.releaseInterval;
      }
      this.dogs.push(dog);
    }
  }

  setDirection(name) {
    const d = DIRS[name];
    if (!d) return;
    this.wanted = d;
    if (this.state === 'playing' || this.state === 'ready') {
      if (!isNone(this.cat.dir) && d === opposite(this.cat.dir)) this.cat.reverse();
    }
  }

  pause() {
    if (this.state === 'paused' || this.state === 'idle' || this.state === 'gameover') return;
    this.pausedFrom = this.state;
    this.state = 'paused';
    this.emit('pause');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = this.pausedFrom;
    this.emit('resume');
  }

  // The way the cat is looking (kept when it stops against a hedge).
  lastFacing() {
    if (!isNone(this.cat.dir)) this.facing = this.cat.dir;
    return this.facing || NONE;
  }

  get isScared() {
    return this.scaredTimer > 0;
  }

  update(dt) {
    this.time += dt;
    for (const p of this.popups) p.ttl -= dt;
    this.popups = this.popups.filter((p) => p.ttl > 0);

    switch (this.state) {
      case 'ready':
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.state = 'playing';
          this.banner = null;
          this.emit('go');
        }
        break;
      case 'playing':
        this.step(dt);
        break;
      case 'dogEaten':
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) this.state = 'playing';
        break;
      case 'dying':
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) this.afterDeath();
        break;
      case 'levelClear':
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.level++;
          this.startLevel();
        }
        break;
      default:
        break;
    }
  }

  step(dt) {
    this.levelTime += dt;

    // Scatter / chase rhythm (paused while the dogs are scared).
    if (this.scaredTimer > 0) {
      this.scaredTimer -= dt;
      if (this.scaredTimer <= 0) {
        this.scaredTimer = 0;
        for (const d of this.dogs) d.scared = false;
        this.emit('scaredEnd');
      }
    } else {
      this.modeTimer -= dt;
      if (this.modeTimer <= 0) {
        this.mode = this.mode === 'scatter' ? 'chase' : 'scatter';
        this.modeTimer = this.mode === 'scatter' ? this.cfg.scatterSeconds : this.cfg.chaseSeconds;
        for (const d of this.dogs) if (d.state === 'active') d.mover.reverse();
      }
    }

    // Cat
    const canEnter = (x, y) => this.maze.catCanEnter(x, y);
    const before = this.cat.x + this.cat.y;
    this.cat.advance(this.cfg.catSpeed * dt, canEnter, catChooser(() => this.wanted, canEnter));
    if (this.cat.x + this.cat.y !== before) this.mouthTime += dt;
    this.eatAtCat();
    if (this.state !== 'playing') return;

    // Fish bonus
    if (this.fish) {
      this.fish.ttl -= dt;
      if (this.fish.ttl <= 0) this.fish = null;
      else if (this.near(this.cat, this.fish)) {
        this.addScore(this.cfg.fishPoints, this.fish.x, this.fish.y);
        this.fish = null;
        this.emit('fish');
      }
    }

    if (this.checkCollisions()) return;
    for (const d of this.dogs) d.update(dt, this);
    this.checkCollisions();
  }

  eatAtCat() {
    const t = this.cat.nearestTile;
    const item = this.maze.eat(t.x, t.y);
    if (item === '.') {
      this.miceEaten++;
      this.addScore(POINTS.mouse);
      this.emit('mouse');
      if (FISH_AT_MICE[this.fishSpawned] === this.miceEaten) {
        this.fishSpawned++;
        this.fish = { x: FISH_SPOT.x, y: FISH_SPOT.y, ttl: FISH_SECONDS };
        this.emit('fishAppear');
      }
      if (this.maze.mice === 0) this.clearLevel();
    } else if (item === 'o') {
      this.addScore(POINTS.catnip);
      this.scaredTimer = this.cfg.catnipSeconds;
      this.dogsEatenThisCatnip = 0;
      for (const d of this.dogs) {
        if (d.state === 'active') {
          if (!d.scared) d.mover.reverse();
          d.scared = true;
        }
      }
      this.emit('catnip');
    }
  }

  near(a, b) {
    let dx = Math.abs(a.x - b.x);
    dx = Math.min(dx, this.maze.cols - dx);
    const dy = Math.abs(a.y - b.y);
    return dx * dx + dy * dy < CATCH_DISTANCE * CATCH_DISTANCE;
  }

  checkCollisions() {
    for (const d of this.dogs) {
      if (d.state !== 'active' || !this.near(this.cat, d)) continue;
      if (d.scared) {
        const pts = POINTS.dogBase * 2 ** this.dogsEatenThisCatnip;
        this.dogsEatenThisCatnip++;
        d.scared = false;
        d.state = 'eaten';
        this.addScore(pts, d.x, d.y);
        this.state = 'dogEaten';
        this.stateTimer = 0.6;
        this.emit('dogEaten', { points: pts, dog: d.type.name });
        return true;
      }
      this.state = 'dying';
      this.stateTimer = 2.0;
      this.deathTime = this.time;
      this.emit('caught', { dog: d.type.name, livesLeft: this.lives - 1 });
      return true;
    }
    return false;
  }

  afterDeath() {
    this.lives--;
    if (this.lives <= 0) {
      this.state = 'gameover';
      this.emit('gameOver', { score: this.score, level: this.level, name: this.playerName });
      return;
    }
    this.resetPositions();
    this.state = 'ready';
    this.stateTimer = 1.6;
    this.banner = 'READY!';
    this.emit('ready', { lives: this.lives });
  }

  clearLevel() {
    this.state = 'levelClear';
    this.stateTimer = 3;
    this.banner = 'LEVEL CLEAR!';
    this.scaredTimer = 0;
    for (const d of this.dogs) d.scared = false;
    this.emit('levelClear', { level: this.level });
  }

  addScore(points, x, y) {
    this.score += points;
    if (x !== undefined) this.popups.push({ x, y, text: String(points), ttl: 1.2 });
  }

  // Test / debug helper: eat every mouse except one next to the cat... or all.
  debugEatAllMice() {
    for (let y = 0; y < this.maze.rows; y++) {
      for (let x = 0; x < this.maze.cols; x++) {
        if (this.maze.get(x, y) === '.') this.maze.eat(x, y);
      }
    }
    this.clearLevel();
  }
}
