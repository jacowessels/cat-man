import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Maze, MAZE_TEMPLATE, KENNEL_EXIT, DOG_HOMES, TUNNEL_ROW } from '../js/maze.js';

const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function flood(maze, start, canEnter) {
  const seen = new Set([`${start.x},${start.y}`]);
  const queue = [start];
  while (queue.length) {
    const c = queue.shift();
    for (const [dx, dy] of NEIGHBOURS) {
      const x = maze.wrapX(c.x + dx);
      const y = c.y + dy;
      const k = `${x},${y}`;
      if (!seen.has(k) && canEnter(x, y)) {
        seen.add(k);
        queue.push({ x, y });
      }
    }
  }
  return seen;
}

test('every row has the same width', () => {
  for (const row of MAZE_TEMPLATE) assert.equal(row.length, MAZE_TEMPLATE[0].length);
});

test('maze is mirror-symmetric', () => {
  for (const row of MAZE_TEMPLATE) {
    const clean = row.replace('C', ' ');
    assert.equal(clean, [...clean].reverse().join(''));
  }
});

test('cat can reach every open tile', () => {
  const m = new Maze();
  const seen = flood(m, m.catStart, (x, y) => m.catCanEnter(x, y));
  let open = 0;
  for (let y = 0; y < m.rows; y++) for (let x = 0; x < m.cols; x++) if (m.catCanEnter(x, y)) open++;
  assert.equal(seen.size, open);
});

test('no dead ends for the cat', () => {
  const m = new Maze();
  for (let y = 0; y < m.rows; y++) {
    for (let x = 0; x < m.cols; x++) {
      if (!m.catCanEnter(x, y)) continue;
      const exits = NEIGHBOURS.filter(([dx, dy]) => m.catCanEnter(x + dx, y + dy)).length;
      assert.ok(exits >= 2, `dead end at ${x},${y}`);
    }
  }
});

test('dogs can get out of the kennel', () => {
  const m = new Maze();
  for (const home of DOG_HOMES) {
    const seen = flood(m, home, (x, y) => m.dogCanEnter(x, y, true));
    assert.ok(seen.has(`${KENNEL_EXIT.x},${KENNEL_EXIT.y}`));
  }
});

test('the cat cannot walk into the kennel', () => {
  const m = new Maze();
  assert.equal(m.catCanEnter(9, 8), false);
  assert.equal(m.catCanEnter(9, 9), false);
});

test('tunnel wraps around', () => {
  const m = new Maze();
  assert.equal(m.wrapX(-1), m.cols - 1);
  assert.equal(m.wrapX(m.cols), 0);
  assert.ok(m.catCanEnter(-1, TUNNEL_ROW));
  assert.ok(m.catCanEnter(m.cols, TUNNEL_ROW));
});

test('mice are counted and can be eaten', () => {
  const m = new Maze();
  const dots = MAZE_TEMPLATE.join('').split('').filter((c) => c === '.').length;
  assert.equal(m.mice, dots);
  assert.equal(m.catnip, 4);
  assert.equal(m.eat(1, 1), '.');
  assert.equal(m.mice, dots - 1);
  assert.equal(m.eat(1, 1), null);
  assert.equal(m.eat(1, 2), 'o');
});
