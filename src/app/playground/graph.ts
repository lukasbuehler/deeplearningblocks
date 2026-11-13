import { Activation } from '../learning/curriculum';

export type BlockKind =
  'image' | 'flatten' | 'dense' | 'activation' | 'softmax' | 'classifier' | 'custom';
export type PortType = 'image' | 'vector' | 'probabilities';
export interface Point {
  x: number;
  y: number;
}
export interface Viewport extends Point {
  zoom: number;
}
/** A block inside a custom block's recipe. Inner blocks have no position on the paper. */
export interface InnerBlock {
  id: string;
  kind: 'dense' | 'activation';
  units?: number;
  activation?: Activation;
}
export interface BlockNode extends Point {
  id: string;
  kind: BlockKind;
  units?: number;
  /** Dense only: the input size to use while no wire dictates one. */
  inputs?: number;
  activation?: Activation;
  /** Custom blocks only: the player's name, the recipe and how many copies to stack. */
  name?: string;
  blocks?: InnerBlock[];
  repeat?: number;
  /** Custom blocks only: show the inner blocks at full size inside a frame. */
  expanded?: boolean;
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
  input?: PortType;
  output?: PortType;
  height: number;
  help: string;
  config?: 'units' | 'activation' | 'custom';
  inferWidth: (node: BlockNode, input?: number) => number | undefined;
  operation: (node: BlockNode) => Step | null;
}
export const MAX_DENSE_UNITS = 128;
export function validDenseUnits(units: number | undefined): units is number {
  return units !== undefined && Number.isInteger(units) && units >= 1 && units <= MAX_DENSE_UNITS;
}

/** A Dense layer reads at most one flattened 28 × 28 picture. */
export const MAX_DENSE_INPUTS = 784;
export function validDenseInputs(inputs: number | undefined): inputs is number {
  return (
    inputs !== undefined && Number.isInteger(inputs) && inputs >= 1 && inputs <= MAX_DENSE_INPUTS
  );
}
export const MAX_REPEAT = 6;
export const MAX_INNER_BLOCKS = 8;
export const MAX_NAME_LENGTH = 24;
export const INNER_KINDS: readonly BlockKind[] = ['dense', 'activation'];

/**
 * A custom block's name is the part before "block", such as "Transformer" in "Transformer block".
 * Typing the word "block" yourself is fine: it is dropped so it never shows twice.
 */
export function customBlockName(name: string | undefined): string {
  return (name ?? '').replace(/\s*\bblocks?\s*$/i, '').trim();
}

/** Every inner block of a custom block, once per copy, in execution order. */
export function expandCustom(node: BlockNode): InnerBlock[] {
  return Array.from({ length: node.repeat ?? 1 }, () => node.blocks ?? []).flat();
}

export const BLOCK_WIDTH = 236;
export const BLOCKS: Record<BlockKind, BlockDefinition> = {
  image: {
    inferWidth: () => undefined,
    operation: () => null,
    title: 'Handwritten digit',
    output: 'image',
    height: 190,
    help: 'A tiny grayscale picture. Each pixel is a number between 0 and 1. Connect it to Flatten to make a list of numbers.',
  },
  flatten: {
    inferWidth: () => 784,
    operation: () => ({ kind: 'flatten' }),
    title: 'Flatten',
    input: 'image',
    output: 'vector',
    height: 120,
    help: 'Turn 28 × 28 pixels into one list of 784 numbers. Nothing is learned or thrown away here. Only the shape changes. Use it once where the picture becomes a vector. Dense layers already produce vectors.',
  },
  dense: {
    config: 'units',
    inferWidth: (node) => node.units,
    operation: (node) => ({ kind: 'dense', units: node.units! }),
    title: 'Dense layer',
    input: 'vector',
    output: 'vector',
    height: 142,
    help: 'Every input connects to every neuron. Training adjusts the weights and biases. The input size comes from the block before this one.',
  },
  activation: {
    config: 'activation',
    inferWidth: (_, input) => input,
    operation: (node) => ({ kind: 'activation', activation: node.activation! }),
    title: 'Activation',
    input: 'vector',
    output: 'vector',
    height: 146,
    help: 'Change each number without changing the length of the list. Nonlinear activations help stacked layers learn more than a single linear transformation.',
  },
  softmax: {
    inferWidth: (_, input) => input,
    operation: () => ({ kind: 'softmax' }),
    title: 'Softmax',
    input: 'vector',
    output: 'probabilities',
    height: 140,
    help: 'Turn 10 class scores into probabilities that add to 100%. Softmax learns no weights. Connect a Dense layer with 10 neurons before it.',
  },
  custom: {
    config: 'custom',
    inferWidth: (node, input) =>
      (node.blocks ?? []).reduce<number | undefined>(
        (width, inner) => (inner.kind === 'dense' ? inner.units : width),
        input,
      ),
    operation: () => null,
    title: 'Custom block',
    input: 'vector',
    output: 'vector',
    height: 206,
    help: 'A named chain of smaller blocks. Repeat stacks copies of the whole chain, and each copy learns its own weights. Take it apart to get the ordinary blocks back.',
  },
  classifier: {
    inferWidth: () => 10,
    operation: () => null,
    title: 'Digit guess',
    input: 'probabilities',
    height: 210,
    help: 'A display for 10 probabilities, one per class. It learns nothing and adds no layers. Connect Softmax to see the network’s guess. A confident guess can still be wrong.',
  },
};
export type Step =
  | { kind: 'flatten' }
  | { kind: 'dense'; units: number }
  | { kind: 'activation'; activation: Activation }
  | { kind: 'softmax' };
export interface NetworkSpec {
  steps: Step[];
  signature: string;
  parameters: number;
  nodeIds: string[];
}
export interface GraphIssue {
  nodeId?: string;
  port?: 'input' | 'output';
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
/** Layout of an expanded custom block: a frame around full-size inner cards. */
export const FRAME = { pad: 22, head: 112, gap: 40, foot: 52 } as const;

/** The space a block takes on the paper. Expanded custom blocks grow around their inner cards. */
export function nodeSize(node: BlockNode): { width: number; height: number } {
  if (node.kind !== 'custom' || !node.expanded || !node.blocks?.length)
    return { width: BLOCK_WIDTH, height: BLOCKS[node.kind].height };
  const inner = node.blocks.reduce((sum, b) => sum + BLOCKS[b.kind].height, 0);
  return {
    width: BLOCK_WIDTH + 2 * FRAME.pad,
    height: FRAME.head + inner + FRAME.gap * (node.blocks.length - 1) + FRAME.foot,
  };
}

export function portPosition(node: BlockNode, side: 'input' | 'output'): Point {
  const size = nodeSize(node);
  return {
    x: node.x + size.width / 2,
    y: node.y + (side === 'output' ? size.height : 0),
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
  if (output !== input && (input === 'probabilities' || output === 'probabilities'))
    return input === 'probabilities'
      ? 'The output display needs 10 probabilities. Add Dense with 10 neurons, then Softmax.'
      : 'Softmax probabilities belong in the output display. Put learning layers before Softmax.';
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
  return newConnectionError(board, from, to)
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
  const nodes = new Map(board.nodes.map((node) => [node.id, node]));
  const incoming = new Map(board.edges.map((edge) => [edge.to, edge.from]));
  const visiting = new Set<string>();
  function visit(id: string): number | undefined {
    if (shapes.has(id)) return shapes.get(id)?.output;
    const node = nodes.get(id);
    if (!node || visiting.has(id)) return undefined;
    visiting.add(id);
    const source = incoming.get(id);
    // A wire dictates the input size. Without one, a Dense block uses the size the player chose.
    const input =
      source !== undefined ? visit(source) : node.kind === 'dense' ? node.inputs : undefined;
    const output = BLOCKS[node.kind].inferWidth(node, input);
    shapes.set(id, { input, output });
    visiting.delete(id);
    return output;
  }
  for (const node of board.nodes) visit(node.id);
  return shapes;
}

/** Check new wires without discarding existing wires when a layer is resized. */
export function newConnectionError(
  board: Board,
  from: string,
  to: string,
  shapes = inferShapes(board),
): string | null {
  const error = connectionError(board, from, to);
  if (error) return error;
  const width = shapes.get(from)?.output;
  if (
    width !== undefined &&
    width !== 10 &&
    board.nodes.find((n) => n.id === to)?.kind === 'softmax'
  )
    return `Softmax needs Vector · 10. This output is Vector · ${width}. Set the last Dense layer to 10 neurons.`;
  return null;
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
    if (message) issues.push({ nodeId: edge.to, port: 'input', message });
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
            port: 'output',
            message: `Connect ${node.kind === 'image' ? 'image' : BLOCKS[node.kind].title.toLowerCase()} to the next block. Follow the studs to your output display.`,
          },
        ],
      };
    node = board.nodes.find((n) => n.id === next);
  }
  const steps: Step[] = [];
  let width = 784,
    parameters = 0;
  for (const block of path.slice(1)) {
    if (block.kind === 'custom') {
      const issue = customBlockIssue(block);
      if (issue) return { network: null, issues: [{ nodeId: block.id, message: issue }] };
      for (const inner of expandCustom(block)) {
        if (inner.kind === 'dense') {
          parameters += (width + 1) * inner.units!;
          width = inner.units!;
          steps.push({ kind: 'dense', units: inner.units! });
        } else steps.push({ kind: 'activation', activation: inner.activation! });
      }
      continue;
    }
    if (block.kind === 'dense') {
      if (!validDenseUnits(block.units))
        return {
          network: null,
          issues: [{ nodeId: block.id, message: `Choose 1 to ${MAX_DENSE_UNITS} neurons.` }],
        };
      parameters += (width + 1) * block.units!;
      width = block.units!;
    } else if (block.kind === 'activation') {
      if (!ACTIVATION_VALUES.includes(block.activation!))
        return { network: null, issues: [{ nodeId: block.id, message: 'Choose an activation.' }] };
    } else if (block.kind === 'softmax' && width !== 10) {
      return {
        network: null,
        issues: [
          {
            nodeId: block.id,
            port: 'input',
            message: `Softmax needs 10 class scores, but gets ${width}. Set the last Dense layer to 10 neurons.`,
          },
        ],
      };
    }
    const operation = BLOCKS[block.kind].operation(block);
    if (operation) steps.push(operation);
  }
  if (steps.filter((step) => step.kind === 'dense').length > MAX_DENSE_LAYERS)
    return {
      network: null,
      issues: [
        {
          message:
            'Try up to six hidden Dense layers plus the 10-neuron output layer. Repeats count every copy.',
        },
      ],
    };
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
const ACTIVATION_VALUES = ['linear', 'sigmoid', 'tanh', 'relu'];
export const MAX_DENSE_LAYERS = 7;

/** Why a custom block cannot compile, or null when its recipe and repeat count are usable. */
export function customBlockIssue(node: BlockNode): string | null {
  const blocks = node.blocks ?? [];
  if (!blocks.length || blocks.length > MAX_INNER_BLOCKS)
    return `A custom block holds 1 to ${MAX_INNER_BLOCKS} blocks.`;
  if (!Number.isInteger(node.repeat ?? 1) || (node.repeat ?? 1) < 1 || node.repeat! > MAX_REPEAT)
    return `Repeat a custom block 1 to ${MAX_REPEAT} times.`;
  for (const inner of blocks) {
    if (inner.kind === 'dense' && !validDenseUnits(inner.units))
      return `Choose 1 to ${MAX_DENSE_UNITS} neurons for each Dense layer inside.`;
    if (inner.kind === 'activation' && !ACTIVATION_VALUES.includes(inner.activation!))
      return 'Choose an activation for each activation inside.';
    if (!INNER_KINDS.includes(inner.kind))
      return 'Custom blocks can hold Dense and activation blocks for now.';
  }
  return null;
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
            : 'Softmax',
    )
    .join(' → ');
}
/** Output probabilities are not a hidden nonlinearity. Look between learned layers. */
export function hasHiddenActivation(network: NetworkSpec, names: string[]): boolean {
  const first = network.steps.findIndex((s) => s.kind === 'dense');
  const last = network.steps.map((s) => s.kind).lastIndexOf('dense');
  return network.steps
    .slice(first + 1, last)
    .some((s) => s.kind === 'activation' && names.includes(s.activation));
}
export function unlockAfter(era: number, network: NetworkSpec): number {
  if (era === 0 && network.steps.some((s) => s.kind === 'dense')) return 1;
  if (era === 1 && hasHiddenActivation(network, ['sigmoid', 'tanh'])) return 2;
  return era;
}
