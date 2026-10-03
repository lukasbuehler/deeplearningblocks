import { DenseBlock, Experiment } from './curriculum';
export interface Progress {
  era: number;
  blocks: DenseBlock[];
  experiments: Experiment[];
}
const KEY = 'dlb-lab-v1';
export const EMPTY_PROGRESS: Progress = { era: 0, blocks: [], experiments: [] };
export function readProgress(): Progress {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!value || !Number.isInteger(value.era) || value.era < 0 || value.era > 2)
      return EMPTY_PROGRESS;
    if (
      !Array.isArray(value.blocks) ||
      value.blocks.length > 3 ||
      !value.blocks.every(
        (b: DenseBlock) =>
          Number.isInteger(b.id) &&
          [16, 32, 64, 128].includes(b.units) &&
          [
            'linear',
            ...(value.era >= 1 ? ['sigmoid', 'tanh'] : []),
            ...(value.era >= 2 ? ['relu'] : []),
          ].includes(b.activation),
      ) ||
      new Set(value.blocks.map((b: DenseBlock) => b.id)).size !== value.blocks.length
    )
      return EMPTY_PROGRESS;
    const experiments = Array.isArray(value.experiments)
      ? value.experiments
          .filter(
            (e: Experiment) =>
              e &&
              Number.isFinite(e.accuracy) &&
              e.accuracy >= 0 &&
              e.accuracy <= 1 &&
              Number.isFinite(e.loss) &&
              typeof e.layers === 'string' &&
              e.layers.length <= 200 &&
              Number.isInteger(e.era) &&
              e.era >= 0 &&
              e.era <= 2,
          )
          .slice(-8)
      : [];
    return { era: value.era, blocks: value.blocks, experiments };
  } catch {
    return EMPTY_PROGRESS;
  }
}
export function saveProgress(progress: Progress): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}
