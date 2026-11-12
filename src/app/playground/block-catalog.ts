import { Dataset, DATASETS } from '../learning/datasets';
import { BlockKind, BlockNode, BLOCKS, customBlockName } from './graph';
import { Activation, ACTIVATIONS } from '../learning/curriculum';
export interface Tile {
  kind: BlockKind;
  activation?: Activation;
  name: string;
  description: string;
  era: number;
}
export const TILES: Tile[] = [
  { kind: 'image', name: 'Image', description: 'A tiny handwritten digit', era: 0 },
  { kind: 'flatten', name: 'Flatten', description: 'Picture → list of numbers', era: 0 },
  {
    kind: 'dense',
    name: 'Dense',
    description: 'Neurons that learn connections',
    era: 0,
  },
  { kind: 'softmax', name: 'Softmax', description: '10 scores → 10 probabilities', era: 0 },
  {
    kind: 'activation',
    activation: 'linear',
    name: 'Linear',
    description: 'Let the numbers pass through',
    era: 0,
  },
  {
    kind: 'activation',
    activation: 'sigmoid',
    name: 'Sigmoid',
    description: 'Squeeze between 0 and 1',
    era: 1,
  },
  {
    kind: 'activation',
    activation: 'tanh',
    name: 'Tanh',
    description: 'A twist centered on zero',
    era: 1,
  },
  {
    kind: 'activation',
    activation: 'relu',
    name: 'ReLU',
    description: 'Keep the positive numbers',
    era: 2,
  },
  {
    kind: 'custom',
    name: 'Custom block',
    description: 'Dense → activation. Repeat it ×N',
    era: 1,
  },
  {
    kind: 'classifier',
    name: 'Digit guess',
    description: 'Display 10 digit probabilities',
    era: 0,
  },
];

export function blockName(node: BlockNode, dataset: Dataset = DATASETS.mnist): string {
  if (node.kind === 'image') return dataset.inputTitle;
  if (node.kind === 'classifier') return dataset.outputTitle;
  if (node.kind === 'custom') {
    const name = customBlockName(node.name);
    return name ? `${name} block` : BLOCKS.custom.title;
  }
  return node.kind === 'activation'
    ? ACTIVATIONS.find((a) => a.value === node.activation)!.label
    : BLOCKS[node.kind].title;
}

export function tilesFor(dataset: Dataset): Tile[] {
  return TILES.map((tile) =>
    tile.kind === 'image'
      ? { ...tile, description: dataset.subject }
      : tile.kind === 'classifier'
        ? { ...tile, name: dataset.outputTitle, description: 'Display 10 class probabilities' }
        : tile,
  );
}
