import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import * as tf from './tensorflow';
import { buildModel } from '../playground/model-builder';
import { Board, compileBoard } from '../playground/graph';
import { inspectionStep, inspectImageModel, activationValue } from './model-inspection';
import { buildTextModel } from './text-model';
import { transformerBoard } from '../playground/text-fixtures';
import { encode } from './shakespeare';

const imageBoard = (): Board => ({
  nodes: [
    { id: 'image', kind: 'image', x: 0, y: 0 },
    { id: 'flatten', kind: 'flatten', x: 0, y: 0 },
    {
      id: 'custom',
      kind: 'custom',
      repeat: 2,
      blocks: [
        { id: 'd', kind: 'dense', units: 4 },
        { id: 'r', kind: 'activation', activation: 'relu' },
      ],
      x: 0,
      y: 0,
    },
    { id: 'scores', kind: 'dense', units: 10, x: 0, y: 0 },
    { id: 'softmax', kind: 'softmax', x: 0, y: 0 },
    { id: 'guess', kind: 'classifier', x: 0, y: 0 },
  ],
  edges: [
    { from: 'image', to: 'flatten' },
    { from: 'flatten', to: 'custom' },
    { from: 'custom', to: 'scores' },
    { from: 'scores', to: 'softmax' },
    { from: 'softmax', to: 'guess' },
  ],
  viewport: { x: 0, y: 0, zoom: 1 },
});

test('visible custom cards resolve to separate executed copies', () => {
  const board = imageBoard(),
    network = compileBoard(board).network!;
  assert.equal(inspectionStep(board, network, { id: 'custom', innerId: 'd', copy: 1 }), 1);
  assert.equal(inspectionStep(board, network, { id: 'custom', innerId: 'd', copy: 2 }), 3);
  assert.equal(inspectionStep(board, network, { id: 'custom', innerId: 'r', copy: 2 }), 4);
  assert.equal(inspectionStep(board, network, { id: 'softmax' }), 6);
  assert.equal(inspectionStep(board, network, { id: 'loose' }), -1);
});

test('image snapshots expose actual kernels, contributions and Softmax without changing weights or leaking tensors', async () => {
  await tf.setBackend('cpu');
  const model = buildModel(tf, compileBoard(imageBoard()).network!);
  const pixels = new Float32Array(784).fill(0.5);
  const before = tf.memory().numTensors;
  const first = inspectImageModel(tf, model, 1, pixels);
  for (let j = 0; j < 4; j++) {
    const sum = first.inputs.reduce(
      (sum, x, i) => sum + x * first.weights![i * 4 + j],
      first.biases![j],
    );
    assert.ok(Math.abs(sum - first.outputs[j]) < 1e-5);
  }
  assert.equal(first.weights!.length, 784 * 4);
  const second = inspectImageModel(tf, model, 3, pixels);
  assert.equal(second.weights!.length, 4 * 4);
  const softmax = inspectImageModel(tf, model, 6, pixels);
  assert.ok(Math.abs(softmax.outputs.reduce((a, b) => a + b, 0) - 1) < 1e-6);
  assert.equal(softmax.weights, undefined);
  for (let i = 0; i < 10; i++)
    assert.deepEqual(inspectImageModel(tf, model, 1, pixels).weights, first.weights);
  assert.equal(tf.memory().numTensors, before);
  model.dispose();
});

test('text snapshots respect shortcuts and expose real Softmax probabilities at the last character', async () => {
  await tf.setBackend('cpu');
  const board = transformerBoard(16),
    network = compileBoard(board).network!;
  const model = buildTextModel(tf, network);
  const ids = tf.tensor2d(encode('ROMEO:').ids, [1, 6], 'int32');
  const scores = inspectionStep(board, network, { id: 'scores' });
  const softmax = inspectionStep(board, network, { id: 'softmax' });
  const before = tf.memory().numTensors;
  const dense = model.inspect(scores, ids);
  const chances = model.inspect(softmax, ids);
  assert.equal(dense.inputs.length, 16);
  assert.equal(dense.weights!.length, 16 * 65);
  assert.deepEqual(chances.inputs, dense.outputs);
  assert.ok(Math.abs(chances.outputs.reduce((a, b) => a + b, 0) - 1) < 1e-6);
  for (let j = 0; j < 65; j++) {
    const sum = dense.inputs.reduce(
      (sum, x, i) => sum + x * dense.weights![i * 65 + j],
      dense.biases![j],
    );
    assert.ok(Math.abs(sum - dense.outputs[j]) < 1e-4);
  }
  assert.equal(tf.memory().numTensors, before);
  ids.dispose();
  model.dispose();
});

test('activation values match the displayed definitions', () => {
  assert.equal(activationValue('relu', -2), 0);
  assert.equal(activationValue('linear', -2), -2);
  assert.equal(activationValue('sigmoid', 0), 0.5);
  assert.equal(activationValue('tanh', 0), 0);
});
