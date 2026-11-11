import { Board, inferShapes } from './graph';

export function layerDiagram(board: Board, selectedId: string) {
  const nodes = new Map(board.nodes.map((node) => [node.id, node]));
  const incoming = new Map(board.edges.map(({ from, to }) => [to, from]));
  const outgoing = new Map(board.edges.map(({ from, to }) => [from, to]));
  const seen = new Set([selectedId]);
  const chain = [selectedId];
  for (const [links, insert] of [
    [incoming, (id: string) => chain.unshift(id)],
    [outgoing, (id: string) => chain.push(id)],
  ] as const) {
    let next = links.get(selectedId);
    while (next && !seen.has(next)) {
      seen.add(next);
      insert(next);
      next = links.get(next);
    }
  }

  const dense = chain.filter((id) => nodes.get(id)?.kind === 'dense');
  if (!dense.length) return [];
  const hasOutput = chain.some((id) => nodes.get(id)?.kind === 'softmax');
  const shapes = inferShapes(board);
  return [
    { id: 'input', label: 'Input', width: shapes.get(dense[0])?.input },
    ...dense.map((id, index) => ({
      id,
      label:
        index < dense.length - 1 ? `Hidden ${index + 1}` : hasOutput ? 'Output scores' : 'Dense',
      width: nodes.get(id)?.units,
    })),
  ].map((stage) => ({
    ...stage,
    selected: stage.id === selectedId,
    dots: Array.from({ length: Math.min(stage.width ?? 0, 5) }, (_, index) => index),
  }));
}
