import { Board, NetworkSpec, networkParts } from './graph';
import { BlockyHint } from './blocky-hints';

/** Suggestions are experiments, not diagnoses or guaranteed accuracy improvements. */
export function experimentHint(
  board: Board,
  network: NetworkSpec,
  era: number,
  accuracy: number,
): BlockyHint {
  const path = networkParts(board, network.nodeIds);
  const dense = path.filter((part) => part.node.kind === 'dense');
  const first = dense[0],
    last = dense.at(-1)!;
  const bends = path
    .slice(path.indexOf(first) + 1, path.indexOf(last))
    .filter(({ node }) => node.kind === 'activation' && node.activation !== 'linear');
  const prefix = `Your experiment scored ${(accuracy * 100).toFixed(1)}%. `;
  const caveat =
    'Change one thing and compare notebook results. A higher score is not guaranteed; repeatedly tuning on these test images can overfit the test set.';
  const before = (part: (typeof path)[number]): BlockyHint['target'] => {
    const edge = board.edges.find((e) => e.to === part.owner.id);
    return edge ? { kind: 'edge', ...edge } : { kind: 'node', id: part.owner.id };
  };
  if (dense.length === 1)
    return {
      id: 'experiment-hidden',
      text:
        prefix +
        'You made a linear classifier! Try a hidden Dense and ' +
        (era >= 2 ? 'ReLU' : era >= 1 ? 'Sigmoid' : 'an unlocked activation') +
        ' before the 10-neuron Dense.',
      why:
        'A linear classifier can already recognize images. A hidden layer with a nonlinear activation can learn different patterns. ' +
        caveat,
      target: before(last),
    };
  if (!bends.length && era >= 1)
    return {
      id: 'experiment-bend',
      text:
        prefix + 'Try ' + (era >= 2 ? 'ReLU' : 'Sigmoid or Tanh') + ' between two Dense layers.',
      why:
        'Without a nonlinear activation between layers, stacked Dense layers still form a linear transformation. ' +
        caveat,
      target:
        first.owner.kind === 'custom'
          ? { kind: 'node', id: first.owner.id }
          : { kind: 'edge', ...board.edges.find((e) => e.from === first.owner.id)! },
    };
  const saturating = bends.find(
    ({ node }) => node.activation === 'sigmoid' || node.activation === 'tanh',
  );
  if (saturating && era >= 2)
    return {
      id: 'experiment-relu',
      text: prefix + 'What if this activation were ReLU? Swap just this block and compare.',
      why:
        'Sigmoid and Tanh can have very small gradients at extreme inputs. ReLU behaves differently, but can also leave neurons inactive. ' +
        caveat,
      target: { kind: 'node', id: saturating.owner.id },
    };
  const narrow = dense.slice(0, -1).find(({ node }) => node.units! < 64);
  if (narrow)
    return {
      id: 'experiment-width',
      text: prefix + 'Try 64 neurons in this hidden Dense. Does the extra capacity help?',
      why: 'More neurons add learnable parameters and computation, and can also overfit. ' + caveat,
      target: { kind: 'node', id: narrow.owner.id },
    };
  return {
    id: 'experiment-inspect',
    text:
      prefix + 'Look at a few wrong guesses, then change one thing. Which classes get mixed up?',
    why:
      'Accuracy alone hides the kinds of mistakes a network makes. Try Next image and compare the actual class with the guess. ' +
      caveat,
    target: { kind: 'node', id: path.at(-1)!.owner.id },
  };
}
