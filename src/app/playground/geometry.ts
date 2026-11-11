import {
  BlockNode,
  Board,
  Point,
  Viewport,
  inferShapes,
  newConnectionError,
  portPosition,
} from './graph';
export const MIN_ZOOM = 0.1,
  MAX_ZOOM = 1.6;
export function toWorld(point: Point, viewport: Viewport): Point {
  return { x: (point.x - viewport.x) / viewport.zoom, y: (point.y - viewport.y) / viewport.zoom };
}
/** Nearest boundary point, including corners and a deterministic edge when inside. */
export function closestPointOnRect(
  point: Point,
  rect: Point & { width: number; height: number },
): Point {
  const right = rect.x + rect.width,
    bottom = rect.y + rect.height;
  const x = Math.max(rect.x, Math.min(right, point.x));
  const y = Math.max(rect.y, Math.min(bottom, point.y));
  if (x !== point.x || y !== point.y) return { x, y };
  return [
    { x: rect.x, y },
    { x: right, y },
    { x, y: rect.y },
    { x, y: bottom },
  ].reduce((best, candidate) =>
    Math.hypot(candidate.x - x, candidate.y - y) < Math.hypot(best.x - x, best.y - y)
      ? candidate
      : best,
  );
}
export function zoomAt(view: Viewport, point: Point, zoom: number): Viewport {
  const world = toWorld(point, view),
    next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
  return { x: point.x - world.x * next, y: point.y - world.y * next, zoom: next };
}
export function wirePath(start: Point, end: Point): string {
  const bend = Math.max(65, Math.abs(end.y - start.y) * 0.45);
  return `M ${start.x} ${start.y} C ${start.x} ${start.y + bend}, ${end.x} ${end.y - bend}, ${end.x} ${end.y}`;
}
export function snapTarget(
  board: Board,
  moved: BlockNode,
): { from: string; to: string; position: Point } | null {
  let best: ReturnType<typeof snapTarget> = null,
    distance = 24;
  const shapes = inferShapes(board);
  for (const other of board.nodes) {
    for (const [source, target] of [
      [moved, other],
      [other, moved],
    ]) {
      if (newConnectionError(board, source.id, target.id, shapes)) continue;
      const out = portPosition(source, 'output'),
        input = portPosition(target, 'input');
      const d = Math.hypot(out.x - input.x, out.y - input.y) * board.viewport.zoom;
      if (d <= distance) {
        const direction = source.id === moved.id ? -1 : 1;
        best = {
          from: source.id,
          to: target.id,
          position: {
            x: moved.x + (out.x - input.x) * direction,
            y: moved.y + (out.y - input.y) * direction,
          },
        };
        distance = d;
      }
    }
  }
  return best;
}
