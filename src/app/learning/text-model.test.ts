import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import * as tf from './tensorflow';
import { buildTextModel, evaluateText, generateText } from './text-model';
import { CONTEXT, VOCAB_SIZE, encode, sampleBatch, seededRandom } from './shakespeare';
import { compileBoard } from '../playground/graph';
import { transformerBoard } from '../playground/text-fixtures';

const network = () => compileBoard(transformerBoard(16)).network!;

test('the browser model has exactly the parameters the board counts', async () => {
  await tf.setBackend('cpu');
  const model = buildTextModel(tf, network());
  assert.equal(model.countParams(), network().parameters);
  const scores = model.logits(tf.zeros([2, CONTEXT], 'int32') as tf.Tensor2D);
  assert.deepEqual(scores.shape, [2, CONTEXT, VOCAB_SIZE]);
  scores.dispose();
  model.dispose();
});

test('the no-peeking curtain hides later letters', async () => {
  await tf.setBackend('cpu');
  const model = buildTextModel(tf, network());
  const a = Array.from(encode('To be, or not to be, that is the').ids);
  const b = [...a.slice(0, 20), ...a.slice(20).reverse()];
  const [x, y] = [a, b].map((ids) =>
    Array.from(model.logits(tf.tensor2d([ids], [1, CONTEXT], 'int32')).dataSync()),
  );
  // The first 20 letters match, so their scores match. Later scores may differ.
  const early = 20 * VOCAB_SIZE;
  x.slice(0, early).forEach((v, i) => assert.ok(Math.abs(v - y[i]) < 1e-4));
  assert.ok(x.slice(early).some((v, i) => Math.abs(v - y[early + i]) > 1e-3));
  model.dispose();
});

test('a few practice steps lower the loss without leaking tensors', async () => {
  await tf.setBackend('cpu');
  const model = buildTextModel(tf, network());
  const text = encode(
    'ROMEO:\nBut soft, what light through yonder window breaks?\n'.repeat(20),
  ).ids;
  const optimizer = tf.train.adam(0.01);
  const random = seededRandom(1);
  const losses: number[] = [];
  let tensors = 0;
  for (let step = 0; step < 30; step++) {
    const { inputs, targets } = sampleBatch(text, 8, CONTEXT, random);
    const ids = tf.tensor2d(inputs, [8, CONTEXT], 'int32'),
      answers = tf.tensor2d(targets, [8, CONTEXT], 'int32');
    const loss = optimizer.minimize(() => model.loss(ids, answers), true, model.variables)!;
    losses.push(loss.dataSync()[0]);
    tf.dispose([loss, ids, answers]);
    if (step === 1) tensors = tf.memory().numTensors;
  }
  assert.equal(tf.memory().numTensors, tensors);
  assert.ok(losses[0] > Math.log(VOCAB_SIZE) - 1);
  assert.ok(losses.at(-1)! < losses[0] - 1, `loss ${losses[0]} → ${losses.at(-1)}`);
  const result = await evaluateText(tf, model, text, 2, seededRandom(2), 4);
  assert.ok(result.accuracy > 0.2 && result.accuracy <= 1);
  assert.equal(tf.memory().numTensors, tensors);
  // Same seed, same text; writing stops early when asked.
  const write = () => generateText(tf, model, encode('ROMEO').ids, 40, 0.8, seededRandom(3));
  assert.deepEqual(await write(), await write());
  let letters = 0;
  await generateText(tf, model, new Uint8Array(), 40, 1, seededRandom(3), () => ++letters < 5);
  assert.equal(letters, 5);
  assert.equal(tf.memory().numTensors, tensors);
  optimizer.dispose();
  model.dispose();
});

test('picture networks are refused', () => {
  assert.throws(
    () => buildTextModel(tf, { steps: [], signature: '', parameters: 0, nodeIds: [] }),
    /does not read text/,
  );
});
