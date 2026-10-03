import { Board } from './graph';

/** V2's prediction card hid Dense(10) + Softmax. Make those operations visible. */
export function splitLegacyOutput(board: Board): Board {
  const result: Board = structuredClone(board);
  for (const display of result.nodes.filter((n) => n.kind === 'classifier')) {
    const unique = (base: string) => {
      let id = base,
        suffix = 1;
      while (result.nodes.some((n) => n.id === id)) id = `${base}-${suffix++}`;
      return id;
    };
    const dense = {
      id: unique(`${display.id}-scores`),
      kind: 'dense' as const,
      units: 10,
      x: display.x,
      y: display.y,
    };
    result.nodes.push(dense);
    const softmax = {
      id: unique(`${display.id}-softmax`),
      kind: 'softmax' as const,
      x: display.x,
      y: display.y + 220,
    };
    result.nodes.push(softmax);
    display.y += 430;
    result.edges = result.edges.map((e) => (e.to === display.id ? { ...e, to: dense.id } : e));
    result.edges.push({ from: dense.id, to: softmax.id }, { from: softmax.id, to: display.id });
  }
  return result;
}
