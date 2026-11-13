import { Dataset, DATASETS } from '../learning/datasets';
import {
  Board,
  Edge,
  InputPort,
  compileBoard,
  newConnectionError,
  hasHiddenActivation,
  worldOf,
} from './graph';
import { textHint } from './text-hints';
import { experimentHint } from './experiment-hints';
import { blockName } from './block-catalog';

export type HintTarget =
  | { kind: 'node'; id: string }
  | { kind: 'edge'; from: string; to: string; port?: InputPort }
  | { kind: 'tray' }
  | { kind: 'check' };
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
export function blockyHint(
  board: Board,
  era: number,
  mode: string,
  rejected?: Edge,
  accuracy?: number,
  completed = false,
  dataset: Dataset = DATASETS.mnist,
): BlockyHint {
  const nodeTarget = (id: string): HintTarget => ({ kind: 'node', id });
  if (rejected && board.nodes.some((n) => n.id === rejected.to)) {
    const error = newConnectionError(board, rejected.from, rejected.to, undefined, rejected.port);
    if (error)
      return {
        id: 'connection',
        text: error,
        why: 'Connector labels show the required shape. Each socket accepts one matching bundle. Disconnect occupied sockets first; loops are not allowed.',
        target: nodeTarget(rejected.to),
      };
  }
  if (worldOf(board) === 'text') return textHint(board, completed, mode, accuracy);
  const image = board.nodes.find((n) => n.kind === 'image');
  if (!image)
    return {
      id: 'image',
      text: 'Every image adventure starts with a picture. Add an Image block.',
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
    const issue = compilation.issues.find(
      (i) => i.nodeId && board.nodes.find((n) => n.id === i.nodeId)?.kind === 'softmax',
    );
    if (issue)
      return {
        id: 'output-width',
        text: issue.message,
        why: `This dataset has ten classes. A 10-neuron Dense learns one score per class. Softmax turns those scores into probabilities; ${dataset.outputTitle} only displays them.`,
        target: nodeTarget(issue.nodeId!),
      };
    if (tail.kind === 'dense' && tail.units === 10 && !board.edges.some((e) => e.from === tail.id))
      return {
        id: 'add-softmax',
        text: `Ten scores are ready. Add Softmax, then connect it to ${dataset.outputTitle}.`,
        why: 'Scores can be negative and do not add to 100%. Softmax converts them into probabilities.',
        target: nodeTarget(tail.id),
      };
    return {
      id: 'gap',
      text: `Follow the numbers from ${blockName(tail, dataset)}. Can you connect them all the way to ${dataset.outputTitle}?`,
      why:
        compilation.issues[0]?.message ??
        'Tap a bottom stud, then a matching top socket. Blocks on the paper only join the network when you connect them.',
      target: nodeTarget(tail.id),
    };
  }
  const network = compilation.network;
  if (accuracy !== undefined) return experimentHint(board, network, era, accuracy);
  const dense = network.nodeIds
    .map((id) => board.nodes.find((n) => n.id === id)!)
    .find((n) => n.kind === 'dense');
  if (mode === 'journey' && !dense)
    return {
      id: 'connect-dense',
      text: 'Put a Dense block in the connected path. Loose blocks do not run.',
      why: `Follow the wire from Flatten through Dense to ${dataset.outputTitle}.`,
      target: { kind: 'tray' },
    };
  const edge = dense && board.edges.find((e) => e.from === dense.id);
  const target: HintTarget = edge ? { kind: 'edge', ...edge } : nodeTarget(image.id);
  if (
    mode === 'journey' &&
    !completed &&
    era === 1 &&
    !hasHiddenActivation(network, ['sigmoid', 'tanh'])
  )
    return {
      id: 'nonlinear',
      text:
        network.steps.filter((s) => s.kind === 'dense').length === 1
          ? 'Add a hidden Dense, then Sigmoid or Tanh, before the 10-neuron Dense.'
          : 'Give these numbers a bend. Disconnect this wire and put Sigmoid or Tanh between Dense layers.',
      why: 'Nonlinear activations let stacked layers describe patterns that a chain of only linear layers cannot. You do not need an activation after every Dense.',
      target:
        network.steps.filter((s) => s.kind === 'dense').length === 1
          ? { kind: 'edge', ...board.edges.find((e) => e.to === dense!.id)! }
          : target,
    };
  if (
    mode === 'journey' &&
    !completed &&
    era === 2 &&
    (!hasHiddenActivation(network, ['relu']) ||
      network.steps.filter((s) => s.kind === 'dense').length < 3)
  )
    return {
      id: 'deeper',
      text: 'Try a ReLU block and a second hidden Dense before the 10-neuron Dense. What happens to the number of learnable connections?',
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
    id: completed ? 'complete' : 'ready',
    text:
      mode === 'journey'
        ? completed
          ? 'Discovery saved! Try training, or choose Next level in your guide.'
          : 'Your build is ready! Press the yellow Check build button at the top right.'
        : 'A complete path! Follow a wire and see how its shape changes.',
    why: 'Only the connected path runs. Loose blocks can stay on your paper. You can train when you want to try real image predictions.',
    target:
      mode === 'journey' && !completed
        ? { kind: 'check' }
        : nodeTarget(board.nodes.find((n) => n.kind === 'classifier')!.id),
  };
}
