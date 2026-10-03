import { BlockKind, BlockNode, BLOCKS } from './graph';
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
    kind: 'classifier',
    name: 'Digit guess',
    description: '10 neurons + softmax',
    era: 0,
  },
];

export function blockName(node: BlockNode): string {
  return node.kind === 'activation'
    ? ACTIVATIONS.find((a) => a.value === node.activation)!.label
    : BLOCKS[node.kind].title;
}
