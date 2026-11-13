import { Dataset, DATASETS } from '../learning/datasets';
import { BlockKind, BlockNode, BLOCKS, World, customBlockName } from './graph';
import { Activation, ACTIVATIONS } from '../learning/curriculum';
export interface Tile {
  kind: BlockKind;
  activation?: Activation;
  name: string;
  description: string;
  era: number;
  /** Shown only in this world. Tiles without one appear in both. */
  world?: World;
}
export const TILES: Tile[] = [
  {
    kind: 'image',
    name: 'Image',
    description: 'A tiny handwritten digit',
    era: 0,
    world: 'images',
  },
  {
    kind: 'flatten',
    name: 'Flatten',
    description: 'Picture → list of numbers',
    era: 0,
    world: 'images',
  },
  {
    kind: 'text',
    name: 'Shakespeare text',
    description: '32 letters at a time',
    era: 3,
    world: 'text',
  },
  {
    kind: 'embedding',
    name: 'Letter embedding',
    description: 'Each letter → a list of numbers',
    era: 3,
    world: 'text',
  },
  {
    kind: 'position',
    name: 'Position',
    description: 'Tell letters where they sit',
    era: 3,
    world: 'text',
  },
  {
    kind: 'layernorm',
    name: 'Layer norm',
    description: 'Keep the numbers steady',
    era: 3,
    world: 'text',
  },
  {
    kind: 'attention',
    name: 'Self-attention',
    description: 'Look back at earlier letters',
    era: 3,
    world: 'text',
  },
  { kind: 'add', name: 'Add', description: 'Join a shortcut wire', era: 3, world: 'text' },
  {
    kind: 'dense',
    name: 'Dense',
    description: 'Neurons that learn connections',
    era: 0,
  },
  { kind: 'softmax', name: 'Softmax', description: 'Scores → probabilities', era: 0 },
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
    world: 'images',
  },
  {
    kind: 'writer',
    name: 'Shakespeare writer',
    description: 'Writes one letter at a time',
    era: 3,
    world: 'text',
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
  const world: World = dataset.kind === 'text' ? 'text' : 'images';
  return TILES.filter((tile) => !tile.world || tile.world === world).map((tile) =>
    tile.kind === 'image'
      ? { ...tile, description: dataset.subject }
      : tile.kind === 'classifier'
        ? { ...tile, name: dataset.outputTitle, description: 'Display 10 class probabilities' }
        : tile.kind === 'softmax' && world === 'images'
          ? { ...tile, description: '10 scores → 10 probabilities' }
          : tile,
  );
}
