import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ACCENT_CHOICES, accentOf, inkOn, rippleGeometry } from '../../src/core/theme.mjs';

describe('accentOf - what a seat chose', () => {
  it("nothing chosen is Foundry's own accent", () => assert.equal(accentOf('', null), null));
  it('a pad colour is that preset', () => assert.deepEqual(accentOf('violet', '#123456'), { preset: 'violet' }));
  it('custom is the picked colour, with a readable ink', () => {
    assert.deepEqual(accentOf('custom', '#FFD000'), { custom: '#ffd000', ink: '#111111' });
    assert.deepEqual(accentOf('custom', '#1a1a40'), { custom: '#1a1a40', ink: '#ffffff' });
  });
  it("custom with no valid colour falls back to Foundry's", () => {
    assert.equal(accentOf('custom', null), null);
    assert.equal(accentOf('custom', 'red'), null);
    assert.equal(accentOf('custom', '#fff'), null);
  });
  it("anything unknown is Foundry's", () => assert.equal(accentOf('mauve', '#ffffff'), null));
  it('the choices are Foundry, the six pad colours, and custom', () =>
    assert.deepEqual(ACCENT_CHOICES, ['', 'red', 'orange', 'yellow', 'green', 'blue', 'violet', 'custom']));
});

describe('inkOn - text that stays readable on the accent', () => {
  it('white on black, near-black on white', () => {
    assert.equal(inkOn('#000000'), '#ffffff');
    assert.equal(inkOn('#ffffff'), '#111111');
  });
  it('a mid red takes white, a mid yellow takes near-black', () => {
    assert.equal(inkOn('#9e4545'), '#ffffff');
    assert.equal(inkOn('#b89704'), '#111111');
  });
});

describe('rippleGeometry - from the press until it covers the card', () => {
  const rect = { width: 200, height: 100 };
  it('from the pressed point, wide enough to reach the farthest corner', () => {
    const g = rippleGeometry(rect, { x: 0, y: 0 });
    assert.deepEqual([g.x, g.y], [0, 0]);
    assert.ok(Math.abs(g.size - 2 * Math.hypot(200, 100)) < 1e-9);
  });
  it('a press with no position starts at the centre', () => {
    const g = rippleGeometry(rect, null);
    assert.deepEqual([g.x, g.y], [100, 50]);
    assert.ok(Math.abs(g.size - 2 * Math.hypot(100, 50)) < 1e-9);
  });
  it('a point outside the card also starts at the centre', () =>
    assert.deepEqual(rippleGeometry(rect, { x: -5, y: 20 }).x, 100));
});
