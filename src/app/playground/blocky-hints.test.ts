import { splitLegacyOutput } from './board-migration';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Board, freshBoard } from './graph';
import { blockyHint, hintContext } from './blocky-hints';
const chain = (): Board =>
  splitLegacyOutput({
    nodes: [
      { id: 'i', kind: 'image', x: 0, y: 0 },
      { id: 'f', kind: 'flatten', x: 0, y: 250 },
      { id: 'd', kind: 'dense', units: 32, x: 0, y: 450 },
      { id: 'c', kind: 'classifier', x: 0, y: 700 },
    ],
    edges: [
      { from: 'i', to: 'f' },
      { from: 'f', to: 'd' },
      { from: 'd', to: 'c' },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  });
test('clues follow missing pieces and connection gaps', () => {
  assert.equal(blockyHint(freshBoard(), 0, 'journey').id, 'flatten');
  const board = chain();
  board.edges = board.edges.filter((e) => e.from !== 'd');
  assert.equal(blockyHint(board, 0, 'journey'), null);
  assert.equal(blockyHint(chain(), 0, 'journey').id, 'ready');
});
test('nonlinear chapter points at the wire to unplug; loose activations do not satisfy it', () => {
  const board = chain();
  board.nodes.push({ id: 's', kind: 'activation', activation: 'sigmoid', x: 400, y: 0 });
  assert.deepEqual(blockyHint(board, 1, 'journey').target, {
    kind: 'edge',
    from: 'd',
    to: 'c-scores',
  });
  assert.equal(blockyHint(board, 1, 'journey').id, 'nonlinear');
  board.edges = board.edges.filter((e) => e.from !== 'd');
  board.edges.push({ from: 'd', to: 's' }, { from: 's', to: 'c-scores' });
  assert.equal(blockyHint(board, 1, 'journey').id, 'ready');
  assert.equal(blockyHint(board, 2, 'journey').id, 'deeper');
  assert.equal(blockyHint(board, 2, 'sandbox').id, 'ready');
});
test('layout changes keep clue dismissals stable; computational changes do not', () => {
  const board = chain(),
    before = hintContext(board, 0, 'journey');
  board.nodes[0].x = 500;
  board.viewport = { x: 100, y: 200, zoom: 0.5 };
  assert.equal(hintContext(board, 0, 'journey'), before);
  board.nodes[2].units = 64;
  assert.notEqual(hintContext(board, 0, 'journey'), before);
  assert.notEqual(hintContext(chain(), 0, 'sandbox'), before);
});
test('rejected connections explain the actual error and tolerate a deleted target', () => {
  const board = chain();
  board.edges = [];
  const hint = blockyHint(board, 0, 'journey', { from: 'i', to: 'd' });
  assert.equal(hint.id, 'connection');
  assert.deepEqual(hint.target, { kind: 'node', id: 'd' });
  assert.match(hint.text, /Flatten/);
  assert.notEqual(blockyHint(board, 0, 'journey', { from: 'i', to: 'deleted' })?.id, 'connection');
});

test('stacked Dense layers get a tip once activations exist, never a first-lesson warning', () => {
  const b = chain();
  b.nodes.push({ id: 'extra', kind: 'dense', units: 16, x: 200, y: 0 });
  b.edges = b.edges.filter((e) => e.from !== 'd');
  b.edges.push({ from: 'd', to: 'extra' }, { from: 'extra', to: 'c-scores' });
  assert.equal(blockyHint(b, 2, 'sandbox').id, 'linear-stack');
  assert.deepEqual(blockyHint(b, 2, 'sandbox').target, { kind: 'edge', from: 'd', to: 'extra' });
  assert.equal(blockyHint(b, 0, 'journey').id, 'ready');
  // A real bend elsewhere does not excuse two Dense layers that touch.
  b.nodes.push({ id: 'bend', kind: 'activation', activation: 'relu', x: 400, y: 0 });
  b.edges = b.edges.filter((e) => e.from !== 'f');
  b.edges.push({ from: 'f', to: 'bend' }, { from: 'bend', to: 'd' });
  assert.equal(blockyHint(b, 2, 'sandbox').id, 'linear-stack');
});
test('a bend between Dense layers satisfies the tip; Linear does not', () => {
  const b = chain();
  b.nodes.push(
    { id: 'act', kind: 'activation', activation: 'linear', x: 200, y: 0 },
    { id: 'extra', kind: 'dense', units: 16, x: 400, y: 0 },
  );
  b.edges = b.edges.filter((e) => e.from !== 'd');
  b.edges.push(
    { from: 'd', to: 'act' },
    { from: 'act', to: 'extra' },
    { from: 'extra', to: 'c-scores' },
  );
  assert.equal(blockyHint(b, 2, 'sandbox').id, 'linear-stack');
  assert.deepEqual(blockyHint(b, 2, 'sandbox').target, { kind: 'edge', from: 'act', to: 'extra' });
  // With a real bend there, Blocky moves on to the next pair: extra feeds the 10-score Dense.
  b.nodes.find((n) => n.id === 'act')!.activation = 'relu';
  assert.deepEqual(blockyHint(b, 2, 'sandbox').target, {
    kind: 'edge',
    from: 'extra',
    to: 'c-scores',
  });
  // Inside one custom block, Blocky points at the block itself.
  const c = chain();
  c.nodes.push({
    id: 'cb',
    kind: 'custom',
    blocks: [
      { id: 'x1', kind: 'dense', units: 16 },
      { id: 'x2', kind: 'dense', units: 16 },
    ],
    x: 200,
    y: 0,
  });
  c.edges = c.edges.filter((e) => e.from !== 'f');
  c.edges.push({ from: 'f', to: 'cb' }, { from: 'cb', to: 'd' });
  assert.deepEqual(blockyHint(c, 2, 'sandbox').target, { kind: 'node', id: 'cb' });
});
