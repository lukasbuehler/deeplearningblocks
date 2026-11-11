import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Board, inferShapes, newConnectionError, validDenseUnits } from './graph';
import { layerDiagram } from './layer-diagram';

const board: Board = {
  viewport: { x: 0, y: 0, zoom: 1 },
  nodes: [
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

test('the layer view counts connected input, hidden neurons and output scores', () => {
  assert.deepEqual(
    layerDiagram(board, 'hidden').map(({ label, width, selected }) => [label, width, selected]),
    [
      ['Input', 784, false],
      ['Hidden 1', 23, true],
      ['Output scores', 10, false],
    ],
  );
});

test('known vector sizes travel through loose chains and reject an incompatible Softmax wire', () => {
  const loose = { ...board, edges: board.edges.slice(0, 2) };
  assert.equal(inferShapes(loose).get('relu')?.output, 23);
  assert.match(newConnectionError(loose, 'relu', 'softmax')!, /Vector · 10.*Vector · 23/);
  assert.equal(newConnectionError(loose, 'scores', 'softmax'), null);
  assert.ok(validDenseUnits(23));
  assert.ok(!validDenseUnits(23.5));
  assert.ok(!validDenseUnits(129));
});
