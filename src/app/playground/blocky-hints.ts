import { Board, Edge, compileBoard, connectionError } from './graph';
import { blockName } from './block-catalog';

export type HintTarget =
  { kind: 'node'; id: string } | { kind: 'edge'; from: string; to: string } | { kind: 'tray' };
export interface BlockyHint {
  id: string;
  text: string;
  why: string;
  target: HintTarget;
}
/** Position-independent context keeps dismissals stable through pan, zoom and dragging. */
export function hintContext(board: Board, era: number, mode: string): string {
  return JSON.stringify([mode, era, board.nodes.map(({ x, y, ...node }) => node), board.edges]);
}
export function blockyHint(board: Board, era: number, mode: string, rejected?: Edge): BlockyHint {
  const nodeTarget = (id: string): HintTarget => ({ kind: 'node', id });
  if (rejected && board.nodes.some((n) => n.id === rejected.to)) {
    const error = connectionError(board, rejected.from, rejected.to);
    if (error)
      return {
        id: 'connection',
        text: error,
        why: 'Connector labels show the required shape. Each socket accepts one matching bundle. Disconnect occupied sockets first; loops are not allowed.',
        target: nodeTarget(rejected.to),
      };
  }
  const image = board.nodes.find((n) => n.kind === 'image');
  if (!image)
    return {
      id: 'image',
      text: 'Every digit adventure starts with a picture. Add an Image block.',
      why: 'The image supplies the 28 × 28 pixel values for this network.',
      target: { kind: 'tray' },
    };
  if (!board.nodes.some((n) => n.kind === 'flatten'))
    return {
      id: 'flatten',
      text: 'This picture needs unfolding. Find Flatten in the toy box!',
      why: 'Flatten turns 28 × 28 × 1 pixels into 784 numbers. You only need it where a picture becomes a vector.',
      target: nodeTarget(image.id),
    };
  if (mode === 'journey' && !board.nodes.some((n) => n.kind === 'dense'))
    return {
      id: 'dense',
      text: 'Add a Dense block. Its little connections can learn from the pixels.',
      why: 'Dense learns weights and biases. Flatten only changes the shape.',
      target: { kind: 'tray' },
    };
  const compilation = compileBoard(board);
  if (!compilation.network) {
    let tail = image;
    const seen = new Set<string>();
    while (!seen.has(tail.id)) {
      seen.add(tail.id);
      const next = board.nodes.find(
        (n) => n.id === board.edges.find((e) => e.from === tail.id)?.to,
      );
      if (!next) break;
      tail = next;
    }
    return {
      id: 'gap',
      text: `Follow the numbers from ${blockName(tail)}. Can you connect them all the way to Digit guess?`,
      why:
        compilation.issues[0]?.message ??
        'Tap a bottom stud, then a matching top socket. Blocks on the paper only join the network when you connect them.',
      target: nodeTarget(tail.id),
    };
  }
  const network = compilation.network;
  const dense = network.nodeIds
    .map((id) => board.nodes.find((n) => n.id === id)!)
    .find((n) => n.kind === 'dense');
  if (mode === 'journey' && !dense)
    return {
      id: 'connect-dense',
      text: 'Put a Dense block in the connected path. Loose blocks do not run.',
      why: 'Follow the wire from Flatten through Dense to Digit guess.',
      target: { kind: 'tray' },
    };
  const edge = dense && board.edges.find((e) => e.from === dense.id);
  const target: HintTarget = edge ? { kind: 'edge', ...edge } : nodeTarget(image.id);
  if (
    mode === 'journey' &&
    era === 1 &&
    !network.steps.some(
      (s) => s.kind === 'activation' && ['sigmoid', 'tanh'].includes(s.activation),
    )
  )
    return {
      id: 'nonlinear',
      text: 'Give these numbers a bend. Disconnect this wire and put Sigmoid or Tanh in the gap.',
      why: 'Nonlinear activations let stacked layers describe patterns that a chain of only linear layers cannot. You do not need an activation after every Dense.',
      target,
    };
  if (
    mode === 'journey' &&
    era === 2 &&
    (!network.steps.some((s) => s.kind === 'activation' && s.activation === 'relu') ||
      network.steps.filter((s) => s.kind === 'dense').length < 2)
  )
    return {
      id: 'deeper',
      text: 'Try a ReLU block and a second Dense. What happens to the number of learnable connections?',
      why: 'More layers add capacity, but do not guarantee better guesses. Build first; training is an optional experiment.',
      target,
    };
  if (
    mode === 'sandbox' &&
    network.steps.filter((s) => s.kind === 'dense').length > 1 &&
    !network.steps.some((s) => s.kind === 'activation' && s.activation !== 'linear')
  ) {
    return {
      id: 'linear-stack',
      text: 'Want to try a bend between these Dense layers?',
      why: 'Stacking linear layers still gives a linear transformation. A nonlinear activation between layers can express different patterns. Your current design is valid too.',
      target,
    };
  }
  return {
    id: 'ready',
    text:
      mode === 'journey'
        ? 'Your path is ready! Check your build to collect this discovery.'
        : 'A complete path! Follow a wire and see how its shape changes.',
    why: 'Only the connected path runs. Loose blocks can stay on your paper. You can train when you want to try real digit predictions.',
    target: nodeTarget(board.nodes.find((n) => n.kind === 'classifier')!.id),
  };
}
