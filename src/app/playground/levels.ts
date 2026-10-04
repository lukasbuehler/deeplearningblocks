import { ERAS } from '../learning/curriculum';
import { NetworkSpec, hasHiddenActivation } from './graph';

/** Stable save IDs stay independent of presentation order and historical dates. */
export const LEVEL_IDS = ['first-network', 'hidden-layers', 'deeper-network'] as const;
export type LevelId = (typeof LEVEL_IDS)[number];
export const LEVELS = ERAS.map((era, index) => ({
  ...era,
  id: LEVEL_IDS[index],
  era: index,
  challenge: [
    'Connect Image → Flatten → Dense · 10 → Softmax → Digit guess. Check your build above. Training is optional.',
    'Build a hidden Dense followed by Sigmoid or Tanh before Dense · 10 and Softmax. Give your network a bend!',
    'Connect two hidden Dense layers with ReLU between them, then Dense · 10, Softmax and Digit guess.',
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
