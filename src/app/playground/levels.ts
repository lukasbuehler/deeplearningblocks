import { DATASETS, DatasetId } from '../learning/datasets';
import { ERAS } from '../learning/curriculum';
import { NetworkSpec, World, hasHiddenActivation, hasTransformerBlock } from './graph';

/** Stable save IDs stay independent of presentation order and historical dates. */
export const LEVEL_IDS = ['first-network', 'hidden-layers', 'deeper-network', 'attention'] as const;
export type LevelId = (typeof LEVEL_IDS)[number];
const LEVEL_DATASETS: DatasetId[] = ['mnist', 'fashion-mnist', 'fashion-mnist', 'tiny-shakespeare'];
export const LAST_ERA = LEVEL_IDS.length - 1;
export const LEVELS = ERAS.map((era, index) => ({
  ...era,
  id: LEVEL_IDS[index],
  era: index,
  dataset: LEVEL_DATASETS[index],
  world: (DATASETS[LEVEL_DATASETS[index]].kind === 'text' ? 'text' : 'images') as World,
  datasetLabel: DATASETS[LEVEL_DATASETS[index]].subject,
  task: [
    'Read a digit',
    'Sort the wardrobe',
    'Same clothes, more layers',
    'Teach a tiny Shakespeare',
  ][index],
  challenge: [
    'Connect Image → Flatten → Dense (10 neurons) → Softmax → Digit guess. Check your build above. Training is optional.',
    'Meet ten kinds of clothing. Build a hidden Dense followed by Sigmoid or Tanh before a 10-neuron Dense and Softmax. Give your network a bend!',
    'Keep the same clothing dataset and explore a deeper recipe. Connect two hidden Dense layers with ReLU between them, then a 10-neuron Dense, Softmax and Clothing guess.',
    'Build a tiny transformer that writes like Shakespeare, one letter at a time. It needs Self-attention and Dense → ReLU → Dense, each with an Add block and a shortcut wire around it. Blocky will show you every step.',
  ][index],
}));
export const levelWorld = (id: LevelId): World => LEVELS.find((l) => l.id === id)!.world;

export function meetsLevel(era: number, network: NetworkSpec | null): boolean {
  if (!network) return false;
  if (era === 3) return network.world === 'text' && hasTransformerBlock(network);
  if (network.world === 'text') return false;
  const dense = network.steps.filter((s) => s.kind === 'dense').length;
  return era === 0
    ? dense >= 1
    : era === 1
      ? dense >= 2 && hasHiddenActivation(network, ['sigmoid', 'tanh'])
      : dense >= 3 && hasHiddenActivation(network, ['relu']);
}
