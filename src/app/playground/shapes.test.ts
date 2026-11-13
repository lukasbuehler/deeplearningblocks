import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Board, inferShapes, newConnectionError, validDenseUnits } from './graph';

const board: Board = {
  viewport: { x: 0, y: 0, zoom: 1 },
  nodes: [
    { id: 'image', kind: 'image', x: 0, y: 0 },
    { id: 'flatten', kind: 'flatten', x: 0, y: 0 },
    { id: 'hidden', kind: 'dense', units: 23, x: 0, y: 0 },
    { id: 'relu', kind: 'activation', activation: 'relu', x: 0, y: 0 },
    { id: 'scores', kind: 'dense', units: 10, x: 0, y: 0 },
    { id: 'softmax', kind: 'softmax', x: 0, y: 0 },
  ],
  edges: [
    { from: 'flatten', to: 'hidden' },
    { from: 'hidden', to: 'relu' },
    { from: 'relu', to: 'scores' },
    { from: 'scores', to: 'softmax' },
  ],
};

test('Softmax accepts any vector size and preserves it in its probabilities', () => {
  const loose = { ...board, edges: board.edges.slice(0, 2) };
  assert.equal(inferShapes(loose).get('relu')?.output, 23);
  assert.equal(newConnectionError(loose, 'relu', 'softmax'), null);
  const connected = { ...loose, edges: [...loose.edges, { from: 'relu', to: 'softmax' }] };
  assert.deepEqual(inferShapes(connected).get('softmax'), { input: 23, output: 23 });
  connected.nodes = [...connected.nodes, { id: 'guess', kind: 'classifier', x: 0, y: 0 }];
  assert.match(newConnectionError(connected, 'softmax', 'guess')!, /10 probabilities.*23/);
  assert.equal(newConnectionError(loose, 'scores', 'softmax'), null);
  assert.ok(validDenseUnits(23));
  assert.ok(!validDenseUnits(23.5));
  assert.ok(!validDenseUnits(129));
});

test('a Dense block uses its own input size until a wire dictates one', () => {
  const unwired: Board = {
    ...board,
    nodes: board.nodes.map((n) => (n.id === 'hidden' ? { ...n, inputs: 50 } : n)),
    edges: board.edges.slice(1),
  };
  assert.deepEqual(inferShapes(unwired).get('hidden'), { input: 50, output: 23 });
  assert.equal(inferShapes(unwired).get('scores')?.input, 23);

  // Once Flatten is wired in, its 784 numbers win; the stored 50 is only a placeholder.
  const wired = { ...unwired, edges: [{ from: 'image', to: 'flatten' }, ...board.edges] };
  assert.deepEqual(inferShapes(wired).get('hidden'), { input: 784, output: 23 });
});
