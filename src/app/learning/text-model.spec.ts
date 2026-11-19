import * as tf from './tensorflow';
import { buildTextModel, generateText } from './text-model';
import { CONTEXT, TEXT_TRAINING, encode, sampleBatch, seededRandom } from './shakespeare';
import { compileBoard } from '../playground/graph';
import { transformerBoard } from '../playground/text-fixtures';

describe('Text model on WebGL', () => {
  afterEach(async () => {
    await tf.setBackend('cpu');
  });
  // CI's headless Chrome often has no WebGL; then this spec is skipped, not failed.
  it('trains the reference transformer with finite, falling loss', async () => {
    if (!(await tf.setBackend('webgl'))) {
      pending('WebGL is not available in this browser');
      return;
    }
    const network = compileBoard(transformerBoard()).network!;
    const model = buildTextModel(tf, network);
    expect(model.countParams()).toBe(network.parameters);
    const text = encode(
      'ROMEO:\nBut soft, what light through yonder window breaks?\nIt is the east.\n'.repeat(40),
    ).ids;
    const optimizer = tf.train.adam(TEXT_TRAINING.learningRate);
    const random = seededRandom(1);
    const losses: number[] = [];
    const started = performance.now();
    const steps = 30;
    for (let step = 0; step < steps; step++) {
      const { inputs, targets } = sampleBatch(text, TEXT_TRAINING.batch, CONTEXT, random);
      const ids = tf.tensor2d(inputs, [TEXT_TRAINING.batch, CONTEXT], 'int32'),
        answers = tf.tensor2d(targets, [TEXT_TRAINING.batch, CONTEXT], 'int32');
      const loss = optimizer.minimize(() => model.loss(ids, answers), true, model.variables)!;
      losses.push((await loss.data())[0]);
      tf.dispose([loss, ids, answers]);
    }
    console.log(
      `WebGL text training: ${((performance.now() - started) / steps).toFixed(1)} ms per step`,
    );
    expect(losses.every(Number.isFinite)).toBeTrue();
    expect(losses.at(-1)!).toBeLessThan(losses[0] - 1);
    const written = await generateText(tf, model, encode('ROMEO').ids, 20, 0.8, seededRandom(3));
    expect(written.length).toBe(20);
    optimizer.dispose();
    model.dispose();
  }, 120000); // Compiling WebGL shaders the first time, especially in software, takes a while.
});
