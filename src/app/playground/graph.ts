import { Activation } from '../learning/curriculum';
import { CONTEXT, VOCAB_SIZE } from '../learning/shakespeare';

export type BlockKind =
  | 'image'
  | 'flatten'
  | 'dense'
  | 'activation'
  | 'softmax'
  | 'classifier'
  | 'custom'
  | 'text'
  | 'embedding'
  | 'position'
  | 'layernorm'
  | 'attention'
  | 'add'
  | 'writer';
/**
 * What travels along a wire. `tokens` are letter IDs. A `sequence` is one list of numbers per
 * letter: a little table with CONTEXT rows.
 */
export type PortType = 'image' | 'vector' | 'probabilities' | 'tokens' | 'sequence';
/** Picture levels and text levels use different starting and output blocks. */
export type World = 'images' | 'text';
/** Add's second socket. Every other wire uses a block's one top socket. */
export type InputPort = 'skip';
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
  /** Self-attention only: how many heads share the numbers of each letter. */
  heads?: number;
}
export interface Edge {
  from: string;
  to: string;
  /** Set only for a wire into Add's shortcut socket. */
  port?: InputPort;
}
export interface Board {
  nodes: BlockNode[];
  edges: Edge[];
  viewport: Viewport;
  /** Missing on every picture board, including all saves made before text levels existed. */
  world?: 'text';
}
export const worldOf = (board: Pick<Board, 'world'>): World =>
  board.world === 'text' ? 'text' : 'images';
/** The one starting block and one output display each world needs. */
export const ENDPOINTS: Record<World, { input: BlockKind; output: BlockKind }> = {
  images: { input: 'image', output: 'classifier' },
  text: { input: 'text', output: 'writer' },
};
export const TEXT_KINDS: readonly BlockKind[] = [
  'text',
  'embedding',
  'position',
  'layernorm',
  'attention',
  'add',
  'writer',
];
/** How many classes the output display shows: 10 pictures classes, or one per letter. */
export const classCount = (world: World) => (world === 'text' ? VOCAB_SIZE : 10);
export const HEAD_CHOICES = [1, 2, 4, 8] as const;
export const validHeads = (heads: number | undefined): heads is number =>
  HEAD_CHOICES.includes(heads as (typeof HEAD_CHOICES)[number]);
export const MAX_ATTENTION_BLOCKS = 4;
export const MAX_TEXT_STEPS = 40;
export interface BlockDefinition {
  title: string;
  subtitle: string;
  icon: string;
  input?: PortType;
  output?: PortType;
  height: number;
  help: string;
  config?: 'units' | 'activation' | 'custom' | 'heads';
  /** Add only: a second top socket for the shortcut wire. */
  skip?: boolean;
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
    subtitle: 'THE STARTING POINT',
    icon: '▦',
    output: 'image',
    height: 190,
    help: 'A tiny grayscale picture. Each pixel is a number between 0 and 1. Connect it to Flatten to make a list of numbers.',
  },
  flatten: {
    inferWidth: () => 784,
    operation: () => ({ kind: 'flatten' }),
    title: 'Flatten',
    subtitle: 'UNROLL THE PICTURE',
    icon: '↳',
    input: 'image',
    output: 'vector',
    height: 148,
    help: 'Turn 28 × 28 pixels into one list of 784 numbers. Nothing is learned or thrown away here. Only the shape changes. Use it once where the picture becomes a vector. Dense layers already produce vectors.',
  },
  dense: {
    config: 'units',
    inferWidth: (node) => node.units,
    operation: (node) => ({ kind: 'dense', units: node.units! }),
    title: 'Dense layer',
    subtitle: 'MAKE CONNECTIONS',
    icon: '✳',
    input: 'vector',
    output: 'vector',
    height: 170,
    help: 'Every input connects to every neuron. Training adjusts the weights and biases. The input size comes from the block before this one.',
  },
  activation: {
    config: 'activation',
    inferWidth: (_, input) => input,
    operation: (node) => ({ kind: 'activation', activation: node.activation! }),
    title: 'Activation',
    subtitle: 'GIVE IT A LITTLE TWIST',
    icon: '∿',
    input: 'vector',
    output: 'vector',
    height: 172,
    help: 'Change each number without changing the length of the list. Nonlinear activations help stacked layers learn more than a single linear transformation.',
  },
  softmax: {
    inferWidth: (_, input) => input,
    operation: () => ({ kind: 'softmax' }),
    title: 'Softmax',
    subtitle: 'SCORES TO PROBABILITIES',
    icon: '%',
    input: 'vector',
    output: 'probabilities',
    height: 160,
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
    subtitle: 'BLOCKS INSIDE A BLOCK',
    icon: '▤',
    input: 'vector',
    output: 'vector',
    height: 236,
    help: 'A named chain of smaller blocks. Repeat stacks copies of the whole chain, and each copy learns its own weights. Take it apart to get the ordinary blocks back.',
  },
  classifier: {
    inferWidth: () => 10,
    operation: () => null,
    title: 'Digit guess',
    subtitle: 'DISPLAY THE 10 DIGITS',
    icon: '?',
    input: 'probabilities',
    height: 236,
    help: 'A display for 10 probabilities, one per class. It learns nothing and adds no layers. Connect Softmax to see the network’s guess. A confident guess can still be wrong.',
  },
  text: {
    inferWidth: () => undefined,
    operation: () => null,
    title: 'Shakespeare text',
    subtitle: 'THE STARTING POINT',
    icon: '¶',
    output: 'tokens',
    height: 236,
    help: `${CONTEXT} letters at a time from Shakespeare’s plays. Each letter becomes an ID number, like A = 13. The model practices guessing the letter that comes next.`,
  },
  embedding: {
    config: 'units',
    inferWidth: (node) => node.units,
    operation: (node) => ({ kind: 'embedding', units: node.units! }),
    title: 'Letter embedding',
    subtitle: 'LETTERS TO NUMBERS',
    icon: '⊞',
    input: 'tokens',
    output: 'sequence',
    height: 172,
    help: `Look up a list of numbers for every letter. There is one learned row for each of the ${VOCAB_SIZE} letters. Letters that behave alike can end up with similar lists.`,
  },
  position: {
    inferWidth: (_, input) => input,
    operation: () => ({ kind: 'position' }),
    title: 'Position',
    subtitle: 'WHO SITS WHERE',
    icon: '#',
    input: 'sequence',
    output: 'sequence',
    height: 160,
    help: `Add a learned list of numbers for each seat, 1 to ${CONTEXT}. Without it, attention could not tell “dog bites man” from “man bites dog”.`,
  },
  layernorm: {
    inferWidth: (_, input) => input,
    operation: () => ({ kind: 'layernorm' }),
    title: 'Layer norm',
    subtitle: 'KEEP NUMBERS STEADY',
    icon: '≡',
    input: 'sequence',
    output: 'sequence',
    height: 160,
    help: 'Rescale each letter’s list so its numbers are centered on zero and not too big or too small. Then learn a good size again. This keeps deep stacks steady while they learn.',
  },
  attention: {
    config: 'heads',
    inferWidth: (_, input) => input,
    operation: (node) => ({ kind: 'attention', heads: node.heads! }),
    title: 'Self-attention',
    subtitle: 'LOOK BACK AT EARLIER LETTERS',
    icon: '◎',
    input: 'sequence',
    output: 'sequence',
    height: 200,
    help: 'Each letter asks a question (query), every earlier letter offers a clue (key) and some information (value). Good matches get more attention. A no-peeking curtain hides later letters. Heads are separate spotters that split the numbers between them.',
  },
  add: {
    inferWidth: (_, input) => input,
    operation: () => null,
    skip: true,
    title: 'Add',
    subtitle: 'JOIN THE SHORTCUT',
    icon: '+',
    input: 'sequence',
    output: 'sequence',
    height: 160,
    help: 'Add two tables of the same size, number by number. Wire the main road into the middle socket and a shortcut that skips some blocks into the other socket. Shortcuts help deep networks learn.',
  },
  writer: {
    inferWidth: () => VOCAB_SIZE,
    operation: () => null,
    title: 'Shakespeare writer',
    subtitle: 'WRITE ONE LETTER AT A TIME',
    icon: '✎',
    input: 'probabilities',
    height: 356,
    help: `Picks the next letter from ${VOCAB_SIZE} chances, adds it to the text and repeats. It learns nothing itself. Funny words are normal for a tiny model.`,
  },
};

/** The type on a block's port. In the text world, vectors become one vector per letter. */
export function portType(kind: BlockKind, side: 'input' | 'output', world: World) {
  const type = BLOCKS[kind][side];
  return world === 'text' && type === 'vector' ? 'sequence' : type;
}
/**
 * One operation. Picture networks are a plain chain. Text steps also name the step they read
 * from (`from`, with -1 for the letter IDs) because shortcut wires make the path branch.
 */
export type Step = (
  | { kind: 'flatten' }
  | { kind: 'dense'; units: number }
  | { kind: 'activation'; activation: Activation }
  | { kind: 'softmax' }
  | { kind: 'embedding'; units: number }
  | { kind: 'position' }
  | { kind: 'layernorm' }
  | { kind: 'attention'; heads: number }
  | { kind: 'add'; skip: number }
) & { from?: number };
export interface NetworkSpec {
  world?: World;
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
export const freshBoard = (world: World = 'images'): Board =>
  world === 'text'
    ? {
        nodes: [
          { id: 'text', kind: 'text', x: 90, y: 50 },
          { id: 'writer', kind: 'writer', x: 470, y: 560 },
        ],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 },
        world: 'text',
      }
    : {
        nodes: [
          { id: 'image', kind: 'image', x: 90, y: 50 },
          { id: 'classifier', kind: 'classifier', x: 470, y: 430 },
        ],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 },
      };
/** Layout of an expanded custom block: a frame around full-size inner cards. */
export const FRAME = { pad: 22, head: 146, gap: 40, foot: 52 } as const;

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

/** Add's shortcut socket sits on the top edge, to the right of the main socket. */
export const SKIP_PORT_OFFSET = 78;
export function portPosition(node: BlockNode, side: 'input' | 'output', port?: InputPort): Point {
  const size = nodeSize(node);
  return {
    x: node.x + size.width / 2 + (side === 'input' && port === 'skip' ? SKIP_PORT_OFFSET : 0),
    y: node.y + (side === 'output' ? size.height : 0),
  };
}
const samePort = (edge: Edge, port?: InputPort) => (edge.port ?? null) === (port ?? null);
/** Text mistakes get text-specific advice. */
function textTypeError(output: PortType, input: PortType): string {
  if (output === 'tokens')
    return 'These are letter ID numbers. Send them into Letter embedding first.';
  if (input === 'tokens') return 'Letter embedding reads the Shakespeare text block directly.';
  if (input === 'probabilities')
    return `The writer needs ${VOCAB_SIZE} letter chances. Add Dense with ${VOCAB_SIZE} neurons, then Softmax.`;
  if (output === 'probabilities') return 'Softmax chances belong in the Shakespeare writer.';
  return 'These blocks do not fit together.';
}
export function connectionError(
  board: Board,
  from: string,
  to: string,
  port?: InputPort,
): string | null {
  const source = board.nodes.find((n) => n.id === from),
    target = board.nodes.find((n) => n.id === to);
  if (!source || !target) return 'That block is no longer on the paper.';
  if (from === to) return 'A block cannot connect to itself.';
  const world = worldOf(board);
  const output = portType(source.kind, 'output', world),
    input = portType(target.kind, 'input', world);
  if (!output || !input) return 'Connect a bottom stud to a top socket.';
  if (port && (port !== 'skip' || !BLOCKS[target.kind].skip))
    return 'Only Add has a shortcut socket.';
  if (world === 'text') return textConnectionError(board, from, to, output, input, port);
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
/**
 * Text wires follow the same rules, with two additions for shortcuts: a sequence output may
 * feed several sockets, and Add's two sockets must be fed by different blocks.
 */
function textConnectionError(
  board: Board,
  from: string,
  to: string,
  output: PortType,
  input: PortType,
  port?: InputPort,
): string | null {
  if (output !== input) return textTypeError(output, input);
  if (board.edges.some((e) => e.from === from && e.to === to && samePort(e, port)))
    return 'These blocks are already connected.';
  if (board.edges.some((e) => e.to === to && samePort(e, port)))
    return 'That socket is taken. Disconnect its wire first.';
  if (output !== 'sequence' && board.edges.some((e) => e.from === from))
    return 'That port is occupied. Disconnect its wire first.';
  if (board.edges.some((e) => e.from === from && e.to === to))
    return 'Both of Add’s wires come from the same block. Let the shortcut skip over some blocks.';
  const seen = new Set<string>(),
    stack = [to];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === from) return 'That would make a loop. Keep your numbers flowing toward the writer.';
    if (seen.has(id)) continue;
    seen.add(id);
    for (const edge of board.edges) if (edge.from === id) stack.push(edge.to);
  }
  return null;
}
export function connect(board: Board, from: string, to: string, port?: InputPort): Board {
  return newConnectionError(board, from, to, undefined, port)
    ? board
    : { ...board, edges: [...board.edges, port ? { from, to, port } : { from, to }] };
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
  // Add reads its size from the main socket; the shortcut must match it.
  const incoming = new Map(
    board.edges.filter((edge) => !edge.port).map((edge) => [edge.to, edge.from]),
  );
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
  port?: InputPort,
): string | null {
  const error = connectionError(board, from, to, port);
  if (error) return error;
  const width = shapes.get(from)?.output;
  const target = board.nodes.find((n) => n.id === to);
  const classes = classCount(worldOf(board));
  if (width !== undefined && width !== classes && target?.kind === 'softmax')
    return worldOf(board) === 'text'
      ? `Softmax needs ${classes} letter scores. This output has ${width}. Set the last Dense layer to ${classes} neurons.`
      : `Softmax needs Vector · 10. This output is Vector · ${width}. Set the last Dense layer to 10 neurons.`;
  if (target?.kind === 'add' && width !== undefined) {
    const other = board.edges.find((e) => e.to === to && !samePort(e, port));
    const otherWidth = other && shapes.get(other.from)?.output;
    if (otherWidth !== undefined && otherWidth !== width)
      return `Add needs two tables of the same size. This one has ${width} numbers per letter, the other ${otherWidth}.`;
  }
  return null;
}
export function compileBoard(board: Board): Compilation {
  const issues: GraphIssue[] = [],
    checked: Board = { ...board, edges: [] };
  if (new Set(board.nodes.map((n) => n.id)).size !== board.nodes.length)
    issues.push({ message: 'Each block needs its own identity.' });
  const world = worldOf(board);
  for (const kind of Object.values(ENDPOINTS[world])) {
    if (board.nodes.filter((n) => n.kind === kind).length !== 1)
      issues.push({ message: `Add exactly one ${BLOCKS[kind].title.toLowerCase()} block.` });
  }
  for (const edge of board.edges) {
    const message = connectionError(checked, edge.from, edge.to, edge.port);
    if (message) issues.push({ nodeId: edge.to, port: 'input', message });
    else checked.edges.push(edge);
  }
  if (issues.length) return { network: null, issues };
  if (world === 'text') return compileText(board);
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
    .map((s) => {
      switch (s.kind) {
        case 'dense':
          return `Dense ${s.units}`;
        case 'activation':
          return s.activation;
        case 'flatten':
          return 'Flatten';
        case 'softmax':
          return 'Softmax';
        case 'embedding':
          return `Embed ${s.units}`;
        case 'position':
          return 'Position';
        case 'layernorm':
          return 'Norm';
        case 'attention':
          return `Attention ×${s.heads}`;
        case 'add':
          return 'Add';
      }
    })
    .join(' → ');
}

/** Learnable numbers in one text step, given the width of the table flowing into it. */
export function textStepParameters(step: Step, width: number): number {
  switch (step.kind) {
    case 'embedding':
      return VOCAB_SIZE * step.units;
    case 'position':
      return CONTEXT * width;
    case 'layernorm':
      return 2 * width;
    case 'attention':
      // Query, key, value and output projections, each with a bias.
      return 4 * (width * width + width);
    case 'dense':
      return (width + 1) * step.units;
    default:
      return 0;
  }
}

/**
 * Compile a text board. Only blocks on a wired path from the Shakespeare text to the writer run.
 * Steps are listed so that every step comes after the steps it reads from.
 */
function compileText(board: Board): Compilation {
  const nodes = new Map(board.nodes.map((n) => [n.id, n]));
  const start = board.nodes.find((n) => n.kind === 'text')!,
    end = board.nodes.find((n) => n.kind === 'writer')!;
  const fail = (issue: GraphIssue): Compilation => ({ network: null, issues: [issue] });
  // Walk forward from the text. If the writer is out of reach, point at the last block reached.
  const order: string[] = [];
  const queue = [start.id];
  while (queue.length) {
    const id = queue.shift()!;
    if (order.includes(id)) continue;
    order.push(id);
    queue.push(...board.edges.filter((e) => e.from === id).map((e) => e.to));
  }
  if (!order.includes(end.id)) {
    const tail = nodes.get(
      [...order].reverse().find((id) => !board.edges.some((e) => e.from === id)) ?? start.id,
    )!;
    return fail({
      nodeId: tail.id,
      port: 'output',
      message: `Connect ${tail.kind === 'text' ? 'the text' : BLOCKS[tail.kind].title.toLowerCase()} to the next block. Follow the studs to the writer.`,
    });
  }
  const steps: Step[] = [],
    widths: (number | undefined)[] = [],
    index = new Map<string, number>([[start.id, -1]]),
    nodeIds = [start.id];
  let parameters = 0;
  const widthAt = (i: number) => (i < 0 ? undefined : widths[i]);
  const push = (step: Step, width: number | undefined): number => {
    parameters += textStepParameters(step, widthAt(step.from!) ?? 0);
    steps.push(step);
    widths.push(width);
    return steps.length - 1;
  };
  // Emit the shortcut's source first and the main road last, so the main road reads like a chain.
  function emit(id: string): number | GraphIssue {
    if (index.has(id)) return index.get(id)!;
    const node = nodes.get(id)!;
    const main = board.edges.find((e) => e.to === id && !e.port);
    const skip = BLOCKS[node.kind].skip ? board.edges.find((e) => e.to === id && e.port) : null;
    if (!main)
      return {
        nodeId: id,
        port: 'input',
        message: `${BLOCKS[node.kind].title} needs a wire into its top socket.`,
      };
    if (skip === undefined)
      return {
        nodeId: id,
        port: 'input',
        message:
          'Add needs two wires. Connect a shortcut from before the blocks it skips into its second socket.',
      };
    const shortcut = skip ? emit(skip.from) : undefined;
    if (typeof shortcut === 'object') return shortcut;
    const from = emit(main.from);
    if (typeof from === 'object') return from;
    const width = widthAt(from);
    const at = (message: string): GraphIssue => ({ nodeId: id, message });
    let last: number;
    switch (node.kind) {
      case 'embedding':
        if (!validDenseUnits(node.units)) return at(`Choose 1 to ${MAX_DENSE_UNITS} numbers.`);
        last = push({ kind: 'embedding', units: node.units, from }, node.units);
        break;
      case 'attention':
        if (!validHeads(node.heads)) return at('Choose 1, 2, 4 or 8 heads.');
        if (width! % node.heads)
          return at(
            `${node.heads} heads must share ${width} numbers equally. Try a width that ${node.heads} divides, such as ${node.heads * 8}.`,
          );
        last = push({ kind: 'attention', heads: node.heads, from }, width);
        break;
      case 'add':
        if (widthAt(shortcut!) !== width)
          return at(
            `Add needs two tables of the same size. One has ${width} numbers per letter, the other ${widthAt(shortcut!)}.`,
          );
        last = push({ kind: 'add', skip: shortcut!, from }, width);
        break;
      case 'dense':
        if (!validDenseUnits(node.units)) return at(`Choose 1 to ${MAX_DENSE_UNITS} neurons.`);
        last = push({ kind: 'dense', units: node.units, from }, node.units);
        break;
      case 'activation':
        if (!ACTIVATION_VALUES.includes(node.activation!)) return at('Choose an activation.');
        last = push({ kind: 'activation', activation: node.activation!, from }, width);
        break;
      case 'custom': {
        const issue = customBlockIssue(node);
        if (issue) return at(issue);
        last = from;
        let inner = width;
        for (const block of expandCustom(node)) {
          if (block.kind === 'dense') inner = block.units;
          last = push(
            block.kind === 'dense'
              ? { kind: 'dense', units: block.units!, from: last }
              : { kind: 'activation', activation: block.activation!, from: last },
            inner,
          );
        }
        break;
      }
      case 'softmax':
        if (width !== VOCAB_SIZE)
          return {
            nodeId: id,
            port: 'input',
            message: `Softmax needs ${VOCAB_SIZE} letter scores, but gets ${width}. Set the last Dense layer to ${VOCAB_SIZE} neurons.`,
          };
        last = push({ kind: 'softmax', from }, width);
        break;
      case 'position':
      case 'layernorm':
        last = push({ kind: node.kind, from }, width);
        break;
      case 'writer':
        last = from;
        break;
      default:
        return at(`${BLOCKS[node.kind].title} belongs in a picture level.`);
    }
    index.set(id, last);
    nodeIds.push(id);
    return last;
  }
  const result = emit(end.id);
  if (typeof result === 'object') return fail(result);
  if (steps.filter((s) => s.kind === 'attention').length > MAX_ATTENTION_BLOCKS)
    return fail({
      message: `Try up to ${MAX_ATTENTION_BLOCKS} self-attention blocks. Bigger models need a bigger computer.`,
    });
  if (steps.length > MAX_TEXT_STEPS)
    return fail({
      message: `Try up to ${MAX_TEXT_STEPS} blocks in the path. Repeats count every copy.`,
    });
  return {
    network: { world: 'text', steps, signature: JSON.stringify(steps), parameters, nodeIds },
    issues: [],
  };
}

/**
 * The kinds of the steps a shortcut skips over: the road from one of Add's inputs back to the
 * other. Empty when this step is not an Add or its two roads do not meet that way.
 */
export function skippedKinds(steps: readonly Step[], at: number): Step['kind'][] {
  const add = steps[at];
  if (add?.kind !== 'add') return [];
  // Steps only read from earlier steps, so following `from` always ends.
  const road = (from: number, to: number): Step['kind'][] | null => {
    const kinds: Step['kind'][] = [];
    let i = from;
    for (; i > to; i = steps[i].from ?? i - 1) kinds.push(steps[i].kind);
    return i === to ? kinds : null;
  };
  const main = add.from ?? at - 1;
  return road(main, add.skip) ?? road(add.skip, main) ?? [];
}
/** A transformer block: attention and a feed-forward bend, each inside its own shortcut. */
export function hasTransformerBlock(network: NetworkSpec): boolean {
  const kinds = network.steps.map((s) => s.kind);
  const around = network.steps.map((_, i) => skippedKinds(network.steps, i));
  return (
    ['embedding', 'position', 'layernorm', 'softmax'].every((k) =>
      kinds.includes(k as Step['kind']),
    ) &&
    around.some((k) => k.includes('attention') && !k.includes('dense')) &&
    around.some((k) => k.includes('dense') && k.includes('activation') && !k.includes('attention'))
  );
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
