import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import * as tf from '../learning/tensorflow';
import { buildModel } from './model-builder';
import { Activation } from '../learning/curriculum';

test('explicit activations match embedded activations on image-shaped tensors', async () => {
  await tf.setBackend('cpu');
  for (const activation of ['linear', 'sigmoid', 'tanh', 'relu'] as Activation[]) {
    const explicit = buildModel(tf, {
      steps: [
        { kind: 'flatten' },
        { kind: 'dense', units: 16 },
        { kind: 'activation', activation },
        { kind: 'classifier' },
      ],
      signature: '',
      parameters: 12730,
      nodeIds: [],
    });
    const embedded = tf.sequential();
    embedded.add(tf.layers.flatten({ inputShape: [28, 28, 1] }));
    embedded.add(
      tf.layers.dense({
        units: 16,
        activation,
        kernelInitializer: tf.initializers.glorotUniform({ seed: 1958 }),
      }),
    );
    embedded.add(
      tf.layers.dense({
        units: 10,
        activation: 'softmax',
        kernelInitializer: tf.initializers.glorotUniform({ seed: 1998 }),
      }),
    );
    const input = tf.ones([2, 28, 28, 1]);
    const a = explicit.predict(input) as tf.Tensor;
    const b = embedded.predict(input) as tf.Tensor;
    const values = Array.from(a.dataSync());
    assert.equal(explicit.countParams(), 12730);
    assert.deepEqual(a.shape, [2, 10]);
    assert.deepEqual(values, Array.from(b.dataSync()));
    assert.ok(Math.abs(values.slice(0, 10).reduce((a, b) => a + b, 0) - 1) < 1e-6);
    input.dispose();
    a.dispose();
    b.dispose();
    explicit.dispose();
    embedded.dispose();
  }
});
