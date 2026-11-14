import {
  BlockNode,
  Board,
  MAX_PARKED,
  PLATE_HEIGHT,
  Point,
  connect,
  newConnectionError,
  portPosition,
  shortcutStart,
  portType,
  worldOf,
} from './graph';

/**
 * A shortcut is a wire from a block's corner knob to a thin plug plate. The plate either sits in
 * an Add's shortcut socket (a real `skip` edge) or is parked on the paper to show its shape.
 */
export type ShortcutOrigin = { to: string } | { parked: number };
export interface ShortcutView {
  key: string;
  from: string;
  /** Set when the plate sits in this Add's shortcut socket. */
  to?: string;
  origin: ShortcutOrigin;
  /** The bottom middle of the plate, where its studs meet a socket. */
  plate: Point;
  points: Point[];
}

/** Right from the knob, then straight down the shortcut lane into the top of the plate. */
export function shortcutPoints(source: BlockNode, plate: Point): Point[] {
  const start = shortcutStart(source),
    top = { x: plate.x, y: plate.y - PLATE_HEIGHT };
  if (top.x > start.x + 12 && top.y > start.y + 12) return [start, { x: top.x, y: start.y }, top];
  if (top.y > start.y + 12) {
    const lane = Math.max(start.x, top.x) + 28;
    return [
      start,
      { x: lane, y: start.y },
      { x: lane, y: top.y - 24 },
      { x: top.x, y: top.y - 24 },
      top,
    ];
  }
  // The plate is behind or above the knob: step out to the right, then come in from above.
  const lane = Math.max(start.x, top.x) + 28,
    above = Math.min(start.y, top.y) - 28;
  return [start, { x: lane, y: start.y }, { x: lane, y: above }, { x: top.x, y: above }, top];
}

export function shortcutViews(board: Board): ShortcutView[] {
  const nodes = new Map(board.nodes.map((n) => [n.id, n]));
  const views: ShortcutView[] = [];
  for (const edge of board.edges) {
    const source = nodes.get(edge.from),
      target = nodes.get(edge.to);
    if (!edge.port || !source || !target) continue;
    const plate = portPosition(target, 'input', 'skip');
    views.push({
      key: `${edge.from}>${edge.to}`,
      from: edge.from,
      to: edge.to,
      origin: { to: edge.to },
      plate,
      points: shortcutPoints(source, plate),
    });
  }
  (board.parked ?? []).forEach((parked, index) => {
    const source = nodes.get(parked.from);
    if (!source) return;
    const plate = { x: parked.x, y: parked.y };
    views.push({
      key: `${parked.from}>parked>${index}`,
      from: parked.from,
      origin: { parked: index },
      plate,
      points: shortcutPoints(source, plate),
    });
  });
  return views;
}

/** Take a plate out of its socket or off its parking spot, ready to be dropped again. */
export function liftShortcut(board: Board, from: string, origin?: ShortcutOrigin): Board {
  if (!origin) return board;
  if ('to' in origin)
    return {
      ...board,
      edges: board.edges.filter((e) => !(e.port && e.from === from && e.to === origin.to)),
    };
  return { ...board, parked: (board.parked ?? []).filter((_, i) => i !== origin.parked) };
}

/** The nearest Add shortcut socket within reach of a plate, and whether it fits there. */
export function shortcutTarget(
  board: Board,
  from: string,
  plate: Point,
  reach: number,
): { to: string; error: string | null } | null {
  let best: { to: string; error: string | null } | null = null,
    distance = reach;
  for (const node of board.nodes) {
    if (node.kind !== 'add' || node.id === from) continue;
    const socket = portPosition(node, 'input', 'skip');
    const d = Math.hypot(socket.x - plate.x, socket.y - plate.y);
    if (d > distance) continue;
    distance = d;
    best = { to: node.id, error: newConnectionError(board, from, node.id, undefined, 'skip') };
  }
  return best;
}

/**
 * Drop a lifted plate: into a socket within reach when it fits, otherwise park it where it was
 * let go. A plate that does not fit is parked too, with the reason, so nothing is lost.
 */
export function dropShortcut(
  board: Board,
  from: string,
  plate: Point,
  reach: number,
): { board: Board; connected?: string; error?: string } {
  const source = board.nodes.find((n) => n.id === from);
  if (
    !source ||
    worldOf(board) !== 'text' ||
    portType(source.kind, 'output', 'text') !== 'sequence'
  )
    return {
      board,
      error: 'Shortcuts carry a table of numbers. Start at a block with a sequence output.',
    };
  const target = shortcutTarget(board, from, plate, reach);
  if (target && !target.error)
    return { board: connect(board, from, target.to, 'skip'), connected: target.to };
  if ((board.parked?.length ?? 0) >= MAX_PARKED)
    return {
      board,
      error: `Keep up to ${MAX_PARKED} parked shortcuts. Remove one or fit it to Add before parking another.`,
    };
  const parked = [...(board.parked ?? []), { from, x: plate.x, y: plate.y }];
  return { board: { ...board, parked }, ...(target?.error ? { error: target.error } : {}) };
}
