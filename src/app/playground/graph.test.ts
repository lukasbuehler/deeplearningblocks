import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  BlockNode,
  Board,
  compileBoard,
  connect,
  connectionError,
  freshBoard,
  inferShapes,
  removeNode,
  unlockAfter,
} from './graph';
import { BoardHistory } from './history';
import { snapTarget, toWorld, zoomAt } from './geometry';
import { loadGame, SAVE_KEY } from './storage';
function network(): Board {
  const nodes: BlockNode[] = [
    { id: 'a', kind: 'image', x: 0, y: 0 },
    { id: 'b', kind: 'flatten', x: 0, y: 240 },
    { id: 'c', kind: 'dense', units: 32, x: 0, y: 440 },
    { id: 'd', kind: 'activation', activation: 'relu', x: 0, y: 660 },
    { id: 'e', kind: 'classifier', x: 0, y: 890 },
  ];
  return {
    nodes,
    edges: nodes.slice(1).map((n, i) => ({ from: nodes[i].id, to: n.id })),
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}
test('explicit connections determine execution, dimensions and parameters', () => {
  const board = network();
  board.nodes.reverse();
  const result = compileBoard(board).network!;
  assert.deepEqual(result.steps, [
    { kind: 'flatten' },
    { kind: 'dense', units: 32 },
    { kind: 'activation', activation: 'relu' },
    { kind: 'classifier' },
  ]);
  assert.equal(result.parameters, 25450);
  assert.deepEqual(inferShapes(board).get('c'), { input: 784, output: 32 });
  board.nodes.forEach((n) => (n.x += 500));
  assert.equal(compileBoard(board).network?.signature, result.signature);
  board.nodes.push({ id: 'loose', kind: 'dense', units: 128, x: 0, y: 0 });
  assert.equal(compileBoard(board).network?.signature, result.signature);
});
test('connections reject wrong types, occupied ports, duplicate edges and cycles', () => {
  const b = network();
  b.edges = [];
  assert.match(connectionError(b, 'a', 'c')!, /Flatten/);
  const linked = connect(b, 'c', 'd');
  assert.match(connectionError(linked, 'c', 'd')!, /already/);
  assert.match(connectionError(linked, 'c', 'e')!, /occupied/);
  assert.match(connectionError(linked, 'd', 'c')!, /loop/);
  assert.match(connectionError(b, 'c', 'c')!, /itself/);
  assert.equal(compileBoard(b).network, null);
});
test('delete and undo restore incident wires without automatic rewiring', () => {
  const b = network(),
    history = new BoardHistory();
  history.record(b);
  const deleted = removeNode(b, 'c');
  assert.equal(deleted.edges.length, 2);
  assert.equal(compileBoard(deleted).network, null);
  const restored = history.undo(deleted)!;
  assert.deepEqual(restored, b);
  assert.deepEqual(history.redo(restored), deleted);
});
test('snapping uses screen distance at every zoom level', () => {
  const b = network();
  b.edges = [];
  const moved = { ...b.nodes[1], y: 208 };
  assert.equal(snapTarget(b, moved)?.from, 'a');
  b.viewport.zoom = 1.6;
  assert.equal(snapTarget(b, moved), null);
  const v = { x: 100, y: 60, zoom: 0.8 },
    p = { x: 350, y: 300 };
  assert.deepEqual(toWorld(p, zoomAt(v, p, 1.3)), toWorld(p, v));
});
test('legacy progress migrates to explicit operations without losing unlocks', () => {
  const old = { era: 1, blocks: [{ id: 1, units: 32, activation: 'sigmoid' }], experiments: [] };
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (key: string) => (key === SAVE_KEY ? null : JSON.stringify(old)) },
  });
  const save = loadGame();
  assert.equal(save.era, 1);
  assert.equal(save.sandbox.board.edges.length, 0);
  const compiled = compileBoard(save.journey.board).network!;
  assert.equal(compiled.parameters, 25450);
  assert.equal(unlockAfter(1, compiled), 2);
  assert.deepEqual(compiled.steps[2], { kind: 'activation', activation: 'sigmoid' });
});
test('unavailable storage starts with loose endpoints', () => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get: () => {
      throw new Error('blocked');
    },
  });
  assert.deepEqual(loadGame().journey.board, freshBoard());
});
