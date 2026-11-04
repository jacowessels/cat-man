import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LocalScoreStore, memoryStorage, sanitizeName } from '../js/scores.js';

test('names are cleaned up', () => {
  assert.equal(sanitizeName('   Tom   Cat  '), 'Tom Cat');
  assert.equal(sanitizeName('abcdefghijklmnop'), 'abcdefghijkl');
  assert.equal(sanitizeName('a\u0007b'), 'ab');
  assert.equal(sanitizeName(null), '');
});

test('scores are sorted and ranked', async () => {
  const s = new LocalScoreStore(memoryStorage());
  assert.deepEqual(await s.submit({ name: 'A', score: 100, level: 1 }), { rank: 1 });
  assert.deepEqual(await s.submit({ name: 'B', score: 300, level: 2 }), { rank: 1 });
  assert.deepEqual(await s.submit({ name: 'C', score: 200, level: 1 }), { rank: 2 });
  const top = await s.top();
  assert.deepEqual(top.map((e) => e.name), ['B', 'C', 'A']);
});

test('only the top 10 are kept', async () => {
  const s = new LocalScoreStore(memoryStorage());
  for (let i = 1; i <= 12; i++) await s.submit({ name: `P${i}`, score: i * 10 });
  const top = await s.top();
  assert.equal(top.length, 10);
  assert.equal(top[0].score, 120);
  assert.equal(top[9].score, 30);
  assert.deepEqual(await s.submit({ name: 'Low', score: 5 }), { rank: null });
});

test('broken saved data does not crash', async () => {
  const storage = memoryStorage();
  storage.setItem('catman.scores.v1', '{not json');
  const s = new LocalScoreStore(storage);
  assert.deepEqual(await s.top(), []);
  storage.setItem('catman.scores.v1', JSON.stringify([{ name: 'ok', score: 5 }, { bad: true }, null]));
  assert.equal((await s.top()).length, 1);
});

test('remembers the last player name', () => {
  const s = new LocalScoreStore(memoryStorage());
  assert.equal(s.getLastName(), '');
  s.setLastName('  Whiskers ');
  assert.equal(s.getLastName(), 'Whiskers');
});
