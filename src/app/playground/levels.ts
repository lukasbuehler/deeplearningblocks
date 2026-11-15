import { DATASETS, DatasetId } from '../learning/datasets';
import { ERAS } from '../learning/curriculum';
import { NetworkSpec, hasHiddenActivation } from './graph';

/** Stable save IDs stay independent of presentation order and historical dates. */
export const LEVEL_IDS = ['first-network', 'hidden-layers', 'deeper-network'] as const;
export type LevelId = (typeof LEVEL_IDS)[number];
export const LEVELS = ERAS.map((era, index) => ({
  ...era,
  id: LEVEL_IDS[index],
  era: index,
  dataset: (index === 0 ? 'mnist' : 'fashion-mnist') as DatasetId,
  datasetLabel: index === 0 ? DATASETS.mnist.subject : DATASETS['fashion-mnist'].subject,
  buildLabel: ['One score layer', 'Hidden layer + Sigmoid/Tanh', 'Two hidden layers + ReLU'][index],
  task: ['Read a digit', 'Sort the wardrobe', 'Same clothes, more layers'][index],
  challenge: [
    'Connect Image → Flatten → Dense (10 neurons) → Softmax → Digit guess. Check your build above. Training is optional.',
    'Meet ten kinds of clothing. Build a hidden Dense followed by Sigmoid or Tanh before a 10-neuron Dense and Softmax. Give your network a bend!',
    'Keep the same clothing dataset and explore a deeper recipe. Connect two hidden Dense layers with ReLU between them, then a 10-neuron Dense, Softmax and Clothing guess.',
  ][index],
}));

export function meetsLevel(era: number, network: NetworkSpec | null): boolean {
  if (!network) return false;
  const dense = network.steps.filter((s) => s.kind === 'dense').length;
  return era === 0
    ? dense >= 1
    : era === 1
      ? dense >= 2 && hasHiddenActivation(network, ['sigmoid', 'tanh'])
      : dense >= 3 && hasHiddenActivation(network, ['relu']);
}
