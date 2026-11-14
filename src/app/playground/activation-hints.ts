import { Board, networkParts } from './graph';
import type { BlockyHint } from './blocky-hints';

/** Advice about the executed image path, including recipe and repeat boundaries. */
export function activationHint(board: Board, path: string[]): BlockyHint | null {
  const parts = networkParts(board, path);
  const consecutive = parts.find(
    ({ node }, i) => node.kind === 'activation' && parts[i - 1]?.node.kind === 'activation',
  );
  if (consecutive)
    return {
      id: 'consecutive-activations',
      text: 'Two activations touch here. Try keeping just one, then compare your guesses.',
      why: 'Each activation changes the same numbers again. This can be intentional, but a hidden Dense followed by one activation is a useful starting recipe. Your build is still valid.',
      target: { kind: 'node', id: consecutive.owner.id },
    };
  const lastDense = parts.map(({ node }) => node.kind).lastIndexOf('dense');
  const outputActivation = parts
    .slice(lastDense + 1)
    .find(({ node }) => node.kind === 'activation');
  if (lastDense >= 0 && outputActivation)
    return {
      id: 'output-activation',
      text: 'Softmax can use the last Dense scores directly. Try removing this extra activation.',
      why: 'Hidden activations help a network learn patterns. After the final score layer, another activation changes the scores before Softmax turns them into chances. Try both versions and compare; this is advice, not a broken build.',
      target: { kind: 'node', id: outputActivation.owner.id },
    };
  return null;
}
