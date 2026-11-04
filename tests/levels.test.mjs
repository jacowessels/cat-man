import { test } from 'node:test';
import assert from 'node:assert/strict';
import { levelConfig, LIVES_PER_LEVEL } from '../js/levels.js';

test('three lives per level', () => {
  assert.equal(LIVES_PER_LEVEL, 3);
});

test('level 1 starts gentle', () => {
  const c = levelConfig(1);
  assert.equal(c.dogCount, 2);
  assert.equal(c.catnipSeconds, 8);
  assert.ok(Math.abs(c.dogSpeed / c.catSpeed - 0.75) < 1e-9);
});

test('each level is at least as hard as the one before', () => {
  for (let l = 1; l < 40; l++) {
    const a = levelConfig(l);
    const b = levelConfig(l + 1);
    assert.ok(b.dogSpeed / b.catSpeed >= a.dogSpeed / a.catSpeed);
    assert.ok(b.catnipSeconds <= a.catnipSeconds);
    assert.ok(b.scatterSeconds <= a.scatterSeconds);
    assert.ok(b.chaseSeconds >= a.chaseSeconds);
    assert.ok(b.dogCount >= a.dogCount);
    assert.ok(b.releaseInterval <= a.releaseInterval);
  }
  assert.ok(levelConfig(5).dogSpeed / levelConfig(5).catSpeed > levelConfig(1).dogSpeed / levelConfig(1).catSpeed);
});

test('difficulty stays within limits', () => {
  const c = levelConfig(500);
  assert.ok(c.dogSpeed <= c.catSpeed);
  assert.ok(c.catnipSeconds >= 2);
  assert.ok(c.scatterSeconds >= 2);
  assert.equal(c.dogCount, 4);
  assert.ok(c.releaseInterval >= 1);
  assert.ok(c.catSpeed <= 8);
});
