import { VOCAB_SIZE } from '../learning/shakespeare';
import { BLOCKS, BlockKind, Board, compileBoard, hasTransformerBlock, skippedKinds } from './graph';
import type { BlockyHint, HintTarget } from './blocky-hints';

/** What the text level needs at least, in the order a player builds it. */
const RECIPE: { kind: BlockKind; count: number; id: string; text: string; why: string }[] = [
  {
    kind: 'embedding',
    count: 1,
    id: 'text-embedding',
    text: 'Letters are only ID numbers. Add Letter embedding to give each letter a list of numbers.',
    why: 'The model learns one list of numbers for every letter. Letters that behave alike can get similar lists.',
  },
  {
    kind: 'position',
    count: 1,
    id: 'text-position',
    text: 'Add Position, so every letter knows which seat it sits in.',
    why: 'Self-attention looks at all earlier letters at once. Without seat numbers, it could not tell “tab” from “bat”.',
  },
  {
    kind: 'attention',
    count: 1,
    id: 'text-attention',
    text: 'Add Self-attention. It lets every letter look back at the letters before it.',
    why: 'Each letter asks a question, earlier letters offer clues, and the best matches share their information. A curtain stops it from peeking at later letters.',
  },
  {
    kind: 'layernorm',
    count: 1,
    id: 'text-norm',
    text: 'Put a Layer norm before Self-attention. It keeps the numbers steady.',
    why: 'Layer norm rescales each letter’s numbers before a part of the block uses them. A norm before each part helps deep models learn.',
  },
  {
    kind: 'add',
    count: 2,
    id: 'text-add',
    text: 'Add blocks join the shortcuts. You need two: one after Self-attention and one after the Dense part.',
    why: 'A shortcut wire carries the numbers around a part, and Add puts them back together. The part only has to learn a small change.',
  },
  {
    kind: 'dense',
    count: 2,
    id: 'text-dense',
    text: `Add Dense blocks: a feed-forward part (for example 96, then 48 neurons) and one with ${VOCAB_SIZE} neurons for the letter scores.`,
    why: 'After attention gathers clues, Dense layers think about each letter on its own. The last Dense gives one score per letter in the alphabet.',
  },
  {
    kind: 'activation',
    count: 1,
    id: 'text-relu',
    text: 'Put ReLU between the two feed-forward Dense blocks. Give it a bend!',
    why: 'The 2017 paper used ReLU here too. Without a bend, two Dense layers act like one.',
  },
  {
    kind: 'softmax',
    count: 1,
    id: 'text-softmax',
    text: `Add Softmax after the ${VOCAB_SIZE}-neuron Dense. It turns scores into chances.`,
    why: `The writer picks the next letter from ${VOCAB_SIZE} chances that add up to 100%.`,
  },
];

/** Blocky's clues for boards that read text. Validation stays in graph.ts; this only explains. */
export function textHint(
  board: Board,
  completed: boolean,
  mode: string,
  accuracy?: number,
): BlockyHint {
  const node = (id: string): HintTarget => ({ kind: 'node', id });
  const text = board.nodes.find((n) => n.kind === 'text');
  if (!text)
    return {
      id: 'text-start',
      text: 'Every story starts with words. Add the Shakespeare text block.',
      why: 'It feeds the model 32 letters at a time from Shakespeare’s plays.',
      target: { kind: 'tray' },
    };
  const compilation = compileBoard(board);
  const network = compilation.network;
  const done = !!network && hasTransformerBlock(network);
  if (!done) {
    const missing = RECIPE.find(
      (r) => board.nodes.filter((n) => n.kind === r.kind).length < r.count,
    );
    if (missing)
      return { id: missing.id, text: missing.text, why: missing.why, target: { kind: 'tray' } };
  }
  if (!network) {
    const issue = compilation.issues[0];
    const at = board.nodes.find((n) => n.id === issue?.nodeId);
    if (at?.kind === 'add' && /two wires/.test(issue.message))
      return {
        id: 'text-shortcut',
        text: 'Now the shortcut! Drag a wire from the block before this part into Add’s orange socket.',
        why: 'A striped stud can feed two sockets. One wire goes through the part, the shortcut goes around it, and Add joins them.',
        target: node(at.id),
      };
    return {
      id: 'text-gap',
      text: at
        ? issue.message
        : 'Follow the numbers from the text. Can you connect them all the way to the writer?',
      why: 'Tap a bottom stud, then a matching top socket. Only blocks on a wired path from the text to the writer run.',
      target: node(at?.id ?? text.id),
    };
  }
  if (!done) {
    const steps = network.steps;
    const blockOf = (kind: BlockKind) =>
      network.nodeIds
        .map((id) => board.nodes.find((n) => n.id === id)!)
        .find((n) => n.kind === kind);
    const around = steps.map((_, i) => skippedKinds(steps, i));
    for (const kind of ['embedding', 'position', 'layernorm', 'softmax'] as const)
      if (!steps.some((s) => s.kind === kind))
        return {
          id: 'text-path',
          text: `Wire ${BLOCKS[kind].title} into the path. Loose blocks do not run.`,
          why: 'Follow the wires from the text to the writer. Every block on that road runs.',
          target: { kind: 'tray' },
        };
    if (!around.some((k) => k.includes('attention') && !k.includes('dense')))
      return {
        id: 'text-attention-shortcut',
        text: 'Wrap Self-attention in its own shortcut: Layer norm → Self-attention → Add, plus a shortcut wire into Add.',
        why: 'The shortcut should skip just the attention part. The Dense part gets a shortcut of its own.',
        target: node(blockOf('attention')?.id ?? text.id),
      };
    return {
      id: 'text-dense-shortcut',
      text: 'Now the thinking part: Layer norm → Dense → ReLU → Dense → Add, with its own shortcut wire.',
      why: 'In a transformer block, attention gathers clues from other letters, then Dense layers work on each letter. Each part sits inside its own shortcut.',
      target: node(blockOf('dense')?.id ?? text.id),
    };
  }
  const writer = board.nodes.find((n) => n.kind === 'writer')!;
  if (accuracy !== undefined)
    return {
      id: 'text-experiment',
      text: `It guessed ${(accuracy * 100).toFixed(0)}% of the next letters right. Type your own start in the writer and press Write!`,
      why: 'Random guessing would get about 2%. Funny words are normal for a tiny model. Try Wild and Careful, or change the heads and train again.',
      target: node(writer.id),
    };
  return {
    id: completed ? 'complete' : 'ready',
    text:
      mode === 'journey' && !completed
        ? 'Your transformer is ready! Press the yellow Check build button at the top right.'
        : 'A transformer! Press Train and watch the writer learn, round by round.',
    why: 'Training takes about a minute here in your browser. You can stop at any time.',
    target: mode === 'journey' && !completed ? { kind: 'check' } : node(writer.id),
  };
}
