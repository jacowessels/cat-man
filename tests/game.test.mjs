import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game.js';
import { Mover, DIRS, catChooser } from '../js/movement.js';
import { Maze } from '../js/maze.js';
import { directionFromDelta } from '../js/input.js';

function seeded(seed = 1) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

function run(game, seconds, step = 1 / 120) {
  for (let t = 0; t < seconds; t += step) game.update(step);
}

test('swipe direction from finger movement', () => {
  assert.equal(directionFromDelta(30, 5), 'right');
  assert.equal(directionFromDelta(-30, 5), 'left');
  assert.equal(directionFromDelta(4, -40), 'up');
  assert.equal(directionFromDelta(0, 40), 'down');
  assert.equal(directionFromDelta(5, 5), null);
  assert.equal(directionFromDelta(13, 0), 'right', '12 px is enough');
  assert.equal(directionFromDelta(0, -11), null, 'under 12 px is not');
  assert.equal(directionFromDelta(13, 12), null, 'a near-diagonal is ignored');
  assert.equal(directionFromDelta(7, 1, 6), 'right', 'a short flick counts on release');
});

test('a turn asked for just after a junction is still taken there', () => {
  const m = new Maze();
  const can = (x, y) => m.catCanEnter(x, y);
  // Row 1, moving right, 0.2 past the centre of x=4 where down is open.
  const cat = new Mover(4, 1, (x) => m.wrapX(x));
  cat.dir = DIRS.right;
  cat.p = 0.2;
  const back = cat.tryLateTurn(DIRS.down, can, 0.4);
  assert.ok(Math.abs(back - 0.2) < 1e-9);
  assert.equal(cat.dir, DIRS.down);
  assert.equal(cat.tx, 4);
  assert.equal(cat.p, 0);
});

test('late turns are refused when too late, blocked or a reverse', () => {
  const m = new Maze();
  const can = (x, y) => m.catCanEnter(x, y);
  const make = (x, p) => {
    const c = new Mover(x, 1, (v) => m.wrapX(v));
    c.dir = DIRS.right;
    c.p = p;
    return c;
  };
  const tooLate = make(4, 0.6);
  assert.equal(tooLate.tryLateTurn(DIRS.down, can, 0.4), 0);
  assert.equal(tooLate.dir, DIRS.right);
  const blocked = make(2, 0.2); // (2,2) is a hedge
  assert.equal(blocked.tryLateTurn(DIRS.down, can, 0.4), 0);
  assert.equal(blocked.dir, DIRS.right);
  const reverse = make(4, 0.2);
  assert.equal(reverse.tryLateTurn(DIRS.left, can, 0.4), 0);
  assert.equal(reverse.dir, DIRS.right);
});

test('in a game, a late swipe turns at the junction without losing ground', () => {
  const g = new Game({ rng: seeded() });
  g.start('Tom');
  run(g, 2.5);
  g.dogs.forEach((d) => d.mover.place(1, 19)); // keep the dogs away
  g.cfg.dogSpeed = 0;
  g.cat.place(4, 1, DIRS.right);
  g.cat.p = 0.3;
  g.wanted = DIRS.right;
  g.setDirection('down');
  assert.equal(g.cat.dir, DIRS.down);
  assert.equal(g.cat.tx, 4);
  g.update(1 / 120);
  const step = g.cfg.catSpeed / 120;
  assert.ok(Math.abs(g.cat.y - (1 + 0.3 + step)) < 1e-6, `cat y ${g.cat.y}`);
});

test('a turn asked for early is taken at the next opening', () => {
  const m = new Maze();
  // Cat on row 1 heading right from (1,1); asks for "down" which opens at x=4.
  const cat = new Mover(1, 1, (x) => m.wrapX(x));
  cat.dir = DIRS.right;
  let wanted = DIRS.down;
  const can = (x, y) => m.catCanEnter(x, y);
  const choose = catChooser(() => wanted, can);
  cat.advance(1.5, can, choose); // passes x=2, where down is a hedge
  assert.equal(cat.dir, DIRS.right);
  assert.equal(cat.tx, 2);
  cat.advance(1.5, can, choose); // reaches x=4, where down is open
  assert.equal(cat.tx, 4);
  assert.equal(cat.dir, DIRS.down);
});

test('cat stops at a hedge and reverses instantly', () => {
  const m = new Maze();
  const cat = new Mover(1, 1, (x) => m.wrapX(x));
  cat.dir = DIRS.up;
  const can = (x, y) => m.catCanEnter(x, y);
  cat.advance(0.5, can, catChooser(() => DIRS.up, can));
  assert.equal(cat.dir.name, 'none');
  const c2 = new Mover(3, 3);
  c2.dir = DIRS.right;
  c2.p = 0.3;
  c2.reverse();
  assert.equal(c2.dir, DIRS.left);
  assert.ok(Math.abs(c2.x - 3.3) < 1e-9);
});

test('game starts on level 1 with 3 lives and the cat moves', () => {
  const g = new Game({ rng: seeded() });
  g.start('Tom');
  assert.equal(g.level, 1);
  assert.equal(g.lives, 3);
  assert.equal(g.dogs.length, 2);
  run(g, 2.5);
  assert.equal(g.state, 'playing');
  const x0 = g.cat.x;
  run(g, 0.5);
  assert.notEqual(g.cat.x, x0);
  assert.ok(g.score > 0, 'ate some mice');
});

test('being caught costs a life, losing all three ends the game', () => {
  const events = [];
  const g = new Game({ rng: seeded(), onEvent: (n, d) => events.push([n, d]) });
  g.start('Tom');
  for (let i = 0; i < 3; i++) {
    run(g, 2.5);
    assert.equal(g.state, 'playing');
    const dog = g.dogs[0];
    const t = g.cat.nearestTile;
    dog.mover.place(t.x, t.y);
    g.update(1 / 120);
    assert.equal(g.state, 'dying');
    run(g, 2.1);
  }
  assert.equal(g.state, 'gameover');
  assert.equal(g.lives, 0);
  assert.ok(events.some(([n]) => n === 'caught'));
  assert.ok(events.some(([n]) => n === 'gameOver'));
});

test('clearing a level starts the next one with 3 lives and more dogs', () => {
  const g = new Game({ rng: seeded() });
  g.start('Tom');
  run(g, 2.5);
  g.dogs[0].mover.place(g.cat.nearestTile.x, g.cat.nearestTile.y);
  g.update(1 / 120);
  run(g, 2.1);
  assert.equal(g.lives, 2);
  const scoreBefore = g.score;
  g.debugEatAllMice();
  assert.equal(g.state, 'levelClear');
  run(g, 3.1);
  assert.equal(g.level, 2);
  assert.equal(g.lives, 3);
  assert.equal(g.dogs.length, 3);
  assert.ok(g.score >= scoreBefore, 'score carries over');
  assert.ok(g.cfg.dogSpeed > 0);
});

test('catnip scares the dogs and a scared dog can be caught', () => {
  const g = new Game({ rng: seeded() });
  g.start('Tom');
  run(g, 2.5);
  // put the cat next to a catnip and walk onto it
  g.cat.place(1, 14, DIRS.down);
  g.wanted = DIRS.down;
  run(g, 0.3);
  assert.ok(g.isScared);
  assert.ok(g.dogs[0].scared);
  const before = g.score;
  g.dogs[0].mover.place(g.cat.nearestTile.x, g.cat.nearestTile.y);
  g.update(1 / 120);
  assert.equal(g.dogs[0].state, 'eaten');
  assert.equal(g.score - before >= 200, true);
  assert.equal(g.lives, 3);
});

test('dogs leave the kennel and an eaten dog comes back', () => {
  const g = new Game({ rng: seeded(7) });
  g.start('Tom');
  g.cat.place(1, 19);
  run(g, 2.5);
  g.cfg.dogSpeed = 0; // keep things calm
  run(g, 8);
  const second = g.dogs[1];
  assert.ok(['active', 'leaving'].includes(second.state), `dog state ${second.state}`);
  second.state = 'eaten';
  second.mover.place(1, 1);
  for (let i = 0; i < 2000 && second.state !== 'active'; i++) {
    second.update(1 / 60, g);
  }
  assert.equal(second.state, 'active');
});

test('long random play never crashes and dogs stay on the board', () => {
  const g = new Game({ rng: seeded(3) });
  g.start('Bot');
  const rnd = seeded(11);
  const names = ['up', 'down', 'left', 'right'];
  for (let i = 0; i < 120 * 300; i++) {
    if (i % 30 === 0) g.setDirection(names[Math.floor(rnd() * 4)]);
    g.update(1 / 120);
    if (g.state === 'gameover') g.start('Bot');
    for (const d of g.dogs) {
      assert.ok(d.mover.ty >= 0 && d.mover.ty < g.maze.rows);
      assert.ok(!g.maze.isWall(d.mover.tx, d.mover.ty), `dog in wall at ${d.mover.tx},${d.mover.ty}`);
    }
    assert.ok(g.maze.catCanEnter(g.cat.tx, g.cat.ty));
  }
});
