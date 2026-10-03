import { Activation } from '../learning/curriculum';

export type BlockKind = 'image' | 'flatten' | 'dense' | 'activation' | 'classifier';
export type PortType = 'image' | 'vector';
export interface Point {
  x: number;
  y: number;
}
export interface Viewport extends Point {
  zoom: number;
}
export interface BlockNode extends Point {
  id: string;
  kind: BlockKind;
  units?: number;
  activation?: Activation;
}
export interface Edge {
  from: string;
  to: string;
}
export interface Board {
  nodes: BlockNode[];
  edges: Edge[];
  viewport: Viewport;
}
export interface BlockDefinition {
  title: string;
  subtitle: string;
  icon: string;
  input?: PortType;
  output?: PortType;
  height: number;
  help: string;
}
export const BLOCK_WIDTH = 236;
export const BLOCKS: Record<BlockKind, BlockDefinition> = {
  image: {
    title: 'Handwritten digit',
    subtitle: 'THE STARTING POINT',
    icon: '▦',
    output: 'image',
    height: 190,
    help: 'A tiny grayscale picture. Each pixel is a number between 0 and 1. Connect it to Flatten to make a list of numbers.',
  },
  flatten: {
    title: 'Flatten',
    subtitle: 'UNROLL THE PICTURE',
    icon: '↳',
    input: 'image',
    output: 'vector',
    height: 148,
    help: 'Turn 28 × 28 pixels into one list of 784 numbers. Nothing is learned or thrown away here. Only the shape changes.',
  },
  dense: {
    title: 'Dense layer',
    subtitle: 'MAKE CONNECTIONS',
    icon: '✳',
    input: 'vector',
    output: 'vector',
    height: 170,
    help: 'Every input connects to every neuron. Training adjusts the weights and biases. The input size comes from the block before this one.',
  },
  activation: {
    title: 'Activation',
    subtitle: 'GIVE IT A LITTLE TWIST',
    icon: '∿',
    input: 'vector',
    output: 'vector',
    height: 172,
    help: 'Change each number without changing the length of the list. Nonlinear activations help stacked layers learn more than a single linear transformation.',
  },
  classifier: {
    title: 'Digit guess',
    subtitle: '10 NEURONS + SOFTMAX',
    icon: '?',
    input: 'vector',
    height: 236,
    help: 'A trainable layer with 10 neurons, one per digit. Softmax turns its scores into probabilities that add to 100%. A confident guess can still be wrong.',
  },
};
export type Step =
  | { kind: 'flatten' }
  | { kind: 'dense'; units: number }
  | { kind: 'activation'; activation: Activation }
  | { kind: 'classifier' };
export interface NetworkSpec {
  steps: Step[];
  signature: string;
  parameters: number;
  nodeIds: string[];
}
export interface GraphIssue {
  nodeId?: string;
  message: string;
}
export interface Compilation {
  network: NetworkSpec | null;
  issues: GraphIssue[];
}
export const freshBoard = (): Board => ({
  nodes: [
    { id: 'image', kind: 'image', x: 90, y: 50 },
    { id: 'classifier', kind: 'classifier', x: 470, y: 430 },
  ],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
});
export function portPosition(node: BlockNode, side: 'input' | 'output'): Point {
  return {
    x: node.x + BLOCK_WIDTH / 2,
    y: node.y + (side === 'output' ? BLOCKS[node.kind].height : 0),
  };
}
export function connectionError(board: Board, from: string, to: string): string | null {
  const source = board.nodes.find((n) => n.id === from),
    target = board.nodes.find((n) => n.id === to);
  if (!source || !target) return 'That block is no longer on the paper.';
  if (from === to) return 'A block cannot connect to itself.';
  const output = BLOCKS[source.kind].output,
    input = BLOCKS[target.kind].input;
  if (!output || !input) return 'Connect a bottom stud to a top socket.';
  if (output !== input)
    return output === 'image'
      ? 'This is a picture. Add Flatten before a layer that needs numbers.'
      : 'Flatten needs a picture, not a list of numbers.';
  if (board.edges.some((e) => e.from === from && e.to === to))
    return 'These blocks are already connected.';
  if (board.edges.some((e) => e.from === from || e.to === to))
    return 'That port is occupied. Disconnect its wire first.';
  const seen = new Set<string>();
  let next: string | undefined = to;
  while (next && !seen.has(next)) {
    if (next === from) return 'That would make a loop. Keep your numbers flowing toward the guess.';
    seen.add(next);
    next = board.edges.find((e) => e.from === next)?.to;
  }
  return null;
}
export function connect(board: Board, from: string, to: string): Board {
  return connectionError(board, from, to)
    ? board
    : { ...board, edges: [...board.edges, { from, to }] };
}
export function removeNode(board: Board, id: string): Board {
  return {
    ...board,
    nodes: board.nodes.filter((n) => n.id !== id),
    edges: board.edges.filter((e) => e.from !== id && e.to !== id),
  };
}
export function inferShapes(board: Board): Map<string, { input?: number; output?: number }> {
  const shapes = new Map<string, { input?: number; output?: number }>();
  let node = board.nodes.find((n) => n.kind === 'image'),
    width: number | undefined;
  const visited = new Set<string>();
  while (node && !visited.has(node.id)) {
    visited.add(node.id);
    const input = width;
    width =
      node.kind === 'image'
        ? undefined
        : node.kind === 'flatten'
          ? 784
          : node.kind === 'dense'
            ? node.units
            : node.kind === 'classifier'
              ? 10
              : width;
    shapes.set(node.id, { input, output: width });
    const next = board.edges.find((e) => e.from === node!.id)?.to;
    node = board.nodes.find((n) => n.id === next);
  }
  return shapes;
}
export function compileBoard(board: Board): Compilation {
  const issues: GraphIssue[] = [],
    checked: Board = { ...board, edges: [] };
  if (new Set(board.nodes.map((n) => n.id)).size !== board.nodes.length)
    issues.push({ message: 'Each block needs its own identity.' });
  for (const kind of ['image', 'classifier'] as const) {
    if (board.nodes.filter((n) => n.kind === kind).length !== 1)
      issues.push({ message: `Add exactly one ${BLOCKS[kind].title.toLowerCase()} block.` });
  }
  for (const edge of board.edges) {
    const message = connectionError(checked, edge.from, edge.to);
    if (message) issues.push({ nodeId: edge.to, message });
    else checked.edges.push(edge);
  }
  if (issues.length) return { network: null, issues };
  const path: BlockNode[] = [];
  let node = board.nodes.find((n) => n.kind === 'image');
  while (node) {
    path.push(node);
    if (node.kind === 'classifier') break;
    const next = board.edges.find((e) => e.from === node!.id)?.to;
    if (!next)
      return {
        network: null,
        issues: [
          {
            nodeId: node.id,
            message: `Connect ${BLOCKS[node.kind].title.toLowerCase()} to the next block. Follow the studs to your digit guess.`,
          },
        ],
      };
    node = board.nodes.find((n) => n.id === next);
  }
  if (path.filter((n) => n.kind === 'dense').length > 6)
    return {
      network: null,
      issues: [{ message: 'Try up to six dense layers in this little lab.' }],
    };
  const steps: Step[] = [];
  let width = 784,
    parameters = 0;
  for (const block of path.slice(1)) {
    if (block.kind === 'dense') {
      if (![16, 32, 64, 128].includes(block.units!))
        return {
          network: null,
          issues: [{ nodeId: block.id, message: 'Choose 16, 32, 64 or 128 neurons.' }],
        };
      parameters += (width + 1) * block.units!;
      width = block.units!;
      steps.push({ kind: 'dense', units: block.units! });
    } else if (block.kind === 'activation') {
      if (!['linear', 'sigmoid', 'tanh', 'relu'].includes(block.activation!))
        return { network: null, issues: [{ nodeId: block.id, message: 'Choose an activation.' }] };
      steps.push({ kind: 'activation', activation: block.activation! });
    } else if (block.kind === 'classifier') {
      parameters += (width + 1) * 10;
      steps.push({ kind: 'classifier' });
    } else if (block.kind === 'flatten') steps.push({ kind: 'flatten' });
  }
  return {
    network: {
      steps,
      signature: JSON.stringify(steps),
      parameters,
      nodeIds: path.map((n) => n.id),
    },
    issues: [],
  };
}
export function describeNetwork(network: NetworkSpec): string {
  return network.steps
    .map((s) =>
      s.kind === 'dense'
        ? `Dense ${s.units}`
        : s.kind === 'activation'
          ? s.activation
          : s.kind === 'flatten'
            ? 'Flatten'
            : '10-way guess',
    )
    .join(' → ');
}
export function unlockAfter(era: number, network: NetworkSpec): number {
  if (era === 0 && network.steps.some((s) => s.kind === 'dense')) return 1;
  if (
    era === 1 &&
    network.steps.some((s) => s.kind === 'activation' && ['sigmoid', 'tanh'].includes(s.activation))
  )
    return 2;
  return era;
}
