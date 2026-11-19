import {
  BLOCKS,
  BlockNode,
  Board,
  Edge,
  Point,
  connect,
  newConnectionError,
  portPosition,
} from './graph';

/** A block and everything it carries below, in data order. */
export function stackIds(board: Board, id: string): string[] {
  const next = new Map(board.edges.filter((e) => !e.port).map((e) => [e.from, e.to]));
  const ids: string[] = [];
  while (id && !ids.includes(id)) {
    ids.push(id);
    id = next.get(id)!;
  }
  return ids;
}

/** Align each chain under its first block. Saved wire-based networks become stacks as well. */
export function layoutStacks(board: Board): Board {
  const nodes = new Map(board.nodes.map((n) => [n.id, n]));
  const incoming = new Set(board.edges.filter((e) => !e.port).map((e) => e.to));
  const placed = new Set<string>();
  for (const root of board.nodes.filter((n) => !incoming.has(n.id))) {
    let previous: BlockNode | undefined;
    for (const id of stackIds(board, root.id)) {
      const node = nodes.get(id);
      if (!node || placed.has(id)) break;
      const input = portPosition({ ...node, x: 0, y: 0 }, 'input');
      const output = previous ? portPosition(previous, 'output') : undefined;
      const aligned = previous
        ? {
            ...node,
            x: output!.x - input.x,
            y: output!.y - input.y,
          }
        : node;
      nodes.set(id, aligned);
      placed.add(id);
      previous = aligned;
    }
  }
  return { ...board, nodes: board.nodes.map((n) => nodes.get(n.id)!) };
}

/** Pull off a suffix and carry it as one piece, leaving the upper stack in place. */
export function moveStack(board: Board, id: string, position: Point): Board {
  const node = board.nodes.find((n) => n.id === id);
  if (!node) return board;
  const moving = new Set(stackIds(board, id));
  return {
    ...board,
    edges: board.edges.filter((e) => e.to !== id || !!e.port),
    nodes: board.nodes.map((n) =>
      moving.has(n.id)
        ? {
            ...n,
            x: n.x + position.x - node.x,
            y: n.y + position.y - node.y,
          }
        : n,
    ),
  };
}

export function attachStacks(board: Board, from: string, to: string): Board {
  return newConnectionError(board, from, to) ? board : layoutStacks(connect(board, from, to));
}

export interface StackDrop {
  from: string;
  to: string;
  position: Point;
  split?: Edge;
  error: string | null;
  pairs: { from: string; to: string; error: string | null }[];
}

/** Find the nearest physical join, including a splice into an existing stack. */
export function stackDropTarget(board: Board, moved: BlockNode): StackDrop | null {
  const draft = moveStack(board, moved.id, moved);
  const ids = stackIds(draft, moved.id);
  const head = draft.nodes.find((n) => n.id === moved.id)!;
  const tail = draft.nodes.find((n) => n.id === ids.at(-1))!;
  let best: StackDrop | null = null;
  let distance = 40;
  for (const other of draft.nodes.filter((n) => !ids.includes(n.id))) {
    for (const [source, target, direction] of [
      [tail, other, -1],
      [other, head, 1],
    ] as const) {
      if (!BLOCKS[source.kind].output || !BLOCKS[target.kind].input) continue;
      const out = portPosition(source, 'output'),
        input = portPosition(target, 'input');
      const d = Math.hypot(out.x - input.x, out.y - input.y) * board.viewport.zoom;
      if (d > distance) continue;
      distance = d;
      const split = draft.edges.find(
        (e) => !e.port && (e.from === source.id || e.to === target.id),
      );
      if (split) {
        const base = { ...draft, edges: draft.edges.filter((e) => e !== split) };
        const firstError = newConnectionError(base, split.from, head.id);
        const joined = firstError ? base : connect(base, split.from, head.id);
        const lastError = newConnectionError(joined, tail.id, split.to);
        const parent = draft.nodes.find((n) => n.id === split.from)!;
        const edge = portPosition(parent, 'output'),
          socket = portPosition(head, 'input');
        best = {
          from: split.from,
          to: head.id,
          split,
          position: { x: moved.x + edge.x - socket.x, y: moved.y + edge.y - socket.y },
          error: firstError ?? lastError,
          pairs: [
            { from: split.from, to: head.id, error: firstError },
            { from: tail.id, to: split.to, error: lastError },
          ],
        };
      } else {
        const error = newConnectionError(draft, source.id, target.id);
        best = {
          from: source.id,
          to: target.id,
          position: {
            x: moved.x + (out.x - input.x) * direction,
            y: moved.y + (out.y - input.y) * direction,
          },
          error,
          pairs: [{ from: source.id, to: target.id, error }],
        };
      }
    }
  }
  return best;
}
export function stackSnapTarget(board: Board, moved: BlockNode): StackDrop | null {
  const drop = stackDropTarget(board, moved);
  return drop?.error ? null : drop;
}
export function applyStackDrop(board: Board, moved: BlockNode, drop: StackDrop): Board {
  if (drop.error) return board;
  let result = moveStack(board, moved.id, drop.position);
  if (drop.split)
    result = {
      ...result,
      edges: result.edges.filter(
        (e) => e.from !== drop.split!.from || e.to !== drop.split!.to || !!e.port,
      ),
    };
  result = connect(result, drop.from, drop.to);
  if (drop.split) result = connect(result, stackIds(board, moved.id).at(-1)!, drop.split.to);
  return layoutStacks(result);
}
