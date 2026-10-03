import type * as TF from '../learning/tensorflow';
import { NetworkSpec } from './graph';

/** Each visible operation becomes its own executable layer. */
export function buildModel(tf: typeof TF, network: NetworkSpec): TF.Sequential {
  const model = tf.sequential();
  let denseIndex = 0;
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
            kernelInitializer: tf.initializers.glorotUniform({ seed: 1958 + denseIndex++ }),
          }),
        );
        break;
      case 'activation':
        model.add(tf.layers.activation({ activation: step.activation }));
        break;
      case 'classifier':
        model.add(
          tf.layers.dense({
            units: 10,
            activation: 'softmax',
            kernelInitializer: tf.initializers.glorotUniform({ seed: 1998 }),
          }),
        );
        break;
    }
  }
  return model;
}
