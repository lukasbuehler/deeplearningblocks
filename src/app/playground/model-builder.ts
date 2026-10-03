import type * as TF from '../learning/tensorflow';
import { NetworkSpec } from './graph';

/** Each visible operation becomes its own executable layer. */
export function buildModel(tf: typeof TF, network: NetworkSpec): TF.Sequential {
  const model = tf.sequential();
  let denseIndex = 0;
  const lastDense = network.steps.filter((s) => s.kind === 'dense').at(-1);
  for (const step of network.steps) {
    switch (step.kind) {
      case 'flatten':
        model.add(tf.layers.flatten({ inputShape: [28, 28, 1] }));
        break;
      case 'dense':
        model.add(
          tf.layers.dense({
            units: step.units,
            activation: 'linear',
            kernelInitializer: tf.initializers.glorotUniform({
              seed: step === lastDense ? 1998 : 1958 + denseIndex++,
            }),
          }),
        );
        break;
      case 'activation':
        model.add(tf.layers.activation({ activation: step.activation }));
        break;
      case 'softmax':
        model.add(tf.layers.softmax({ axis: -1 }));
        break;
    }
  }
  return model;
}
