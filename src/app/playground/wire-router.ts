import { BlockNode, Point, nodeSize, portPosition } from './graph';
interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
const inside = (p: Point, r: Rect) =>
  p.x > r.left && p.x < r.right && p.y > r.top && p.y < r.bottom;
const clear = (a: Point, b: Point, boxes: Rect[]) =>
  !boxes.some((r) =>
    a.x === b.x
      ? a.x > r.left && a.x < r.right && Math.max(a.y, b.y) > r.top && Math.min(a.y, b.y) < r.bottom
      : a.y > r.top &&
        a.y < r.bottom &&
        Math.max(a.x, b.x) > r.left &&
        Math.min(a.x, b.x) < r.right,
  );

/** Segments within this distance of the previous route's segments count as "the same lane". */
const LANE = 40;
/** Staying in the previous lane costs this fraction of its length, so near-ties do not flip. */
const STICKY = 0.75;

/**
 * Orthogonal visibility-grid search. Clearance also leaves space for rounded corners.
 * Pass the route drawn last frame as `lastRoute` so a wire keeps its side while a card is dragged
 * and only switches when another path is clearly shorter.
 */
export function routeWire(
  from: BlockNode,
  to: BlockNode,
  nodes: BlockNode[],
  lastRoute?: Point[],
): Point[] {
  const start = portPosition(from, 'output'),
    end = portPosition(to, 'input');
  if (start.x === end.x && start.y === end.y) return [start, end];
  const boxes = nodes.map((n) => {
    const size = nodeSize(n);
    return {
      left: n.x - 16,
      right: n.x + size.width + 16,
      top: n.y - 16,
      bottom: n.y + size.height + 16,
    };
  });
  const others = boxes.filter((_, i) => nodes[i].id !== from.id && nodes[i].id !== to.id);
  if (start.x === end.x && end.y >= start.y && clear(start, end, others)) return [start, end];
  const a = { x: start.x, y: start.y + 24 },
    b = { x: end.x, y: end.y - 24 };
  // Overlapping cards can physically cover a port. Ignore only those impossible obstacles.
  const obstacles = boxes.filter((r) => !inside(a, r) && !inside(b, r));
  const sorted = (values: number[]) => [...new Set(values)].sort((a, b) => a - b);
  const xs = sorted([a.x, b.x, ...obstacles.flatMap((r) => [r.left, r.right])]);
  const ys = sorted([a.y, b.y, ...obstacles.flatMap((r) => [r.top, r.bottom])]);
  const key = (x: number, y: number, direction: number) => `${x},${y},${direction}`;
  const lanes = (lastRoute ?? []).slice(1).map((p, i) => [lastRoute![i], p] as const);
  const inLane = (p: Point, q: Point) =>
    lanes.some(([u, v]) =>
      p.y === q.y
        ? u.y === v.y &&
          Math.abs(u.y - p.y) <= LANE &&
          Math.min(p.x, q.x) >= Math.min(u.x, v.x) - LANE &&
          Math.max(p.x, q.x) <= Math.max(u.x, v.x) + LANE
        : u.x === v.x &&
          Math.abs(u.x - p.x) <= LANE &&
          Math.min(p.y, q.y) >= Math.min(u.y, v.y) - LANE &&
          Math.max(p.y, q.y) <= Math.max(u.y, v.y) + LANE,
    );
  // Admissible only if it never overestimates, so scale it by the cheapest per-pixel cost.
  const guess = lanes.length ? STICKY : 1;
  interface State {
    x: number;
    y: number;
    direction: number;
    cost: number;
    score: number;
    id: string;
  }
  const ax = xs.indexOf(a.x),
    ay = ys.indexOf(a.y),
    bx = xs.indexOf(b.x),
    by = ys.indexOf(b.y);
  const first = key(ax, ay, 1),
    costs = new Map([[first, 0]]),
    previous = new Map<string, string>();
  const points = new Map<string, Point>([[first, a]]);
  const open: State[] = [{ x: ax, y: ay, direction: 1, cost: 0, score: 0, id: first }];
  while (open.length) {
    open.sort((a, b) => b.score - a.score || (a.id < b.id ? 1 : -1));
    const current = open.pop()!;
    if (current.cost !== costs.get(current.id)) continue;
    if (current.x === bx && current.y === by) {
      const route: Point[] = [end];
      let id: string | undefined = current.id;
      while (id) {
        route.push(points.get(id)!);
        id = previous.get(id);
      }
      route.push(start);
      route.reverse();
      return straighten(
        route.filter(
          (p, i) =>
            !i ||
            i === route.length - 1 ||
            !(
              (route[i - 1].x === p.x && p.x === route[i + 1].x) ||
              (route[i - 1].y === p.y && p.y === route[i + 1].y)
            ),
        ),
        nodes,
      );
    }
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const x = current.x + dx,
        y = current.y + dy;
      if (x < 0 || y < 0 || x >= xs.length || y >= ys.length) continue;
      const point = { x: xs[x], y: ys[y] },
        last = { x: xs[current.x], y: ys[current.y] };
      if (!clear(last, point, obstacles)) continue;
      const direction = dx ? 0 : 1;
      const cost =
        current.cost +
        (Math.abs(point.x - last.x) + Math.abs(point.y - last.y)) *
          (inLane(last, point) ? STICKY : 1) +
        (direction !== current.direction ? 24 : 0);
      const id = key(x, y, direction);
      if (cost >= (costs.get(id) ?? Infinity)) continue;
      costs.set(id, cost);
      previous.set(id, current.id);
      points.set(id, point);
      open.push({
        x,
        y,
        direction,
        cost,
        id,
        score: cost + (Math.abs(point.x - b.x) + Math.abs(point.y - b.y)) * guess,
      });
    }
  }
  return [
    start,
    a,
    { x: Math.max(...boxes.map((r) => r.right)) + 24, y: a.y },
    { x: Math.max(...boxes.map((r) => r.right)) + 24, y: b.y },
    b,
    end,
  ];
}
/** Jogs shorter than this are snapped away: two bends a few pixels apart read as a glitch. */
const JOG = 14;
/**
 * Removes tiny jogs where two grid lines nearly coincide, such as one card's margin ending a pixel
 * past another's. The straightened segment only has to clear the cards themselves, not margins.
 */
function straighten(route: Point[], nodes: BlockNode[]): Point[] {
  const cards = nodes.map((n) => {
    const size = nodeSize(n);
    return {
      left: n.x - 4,
      right: n.x + size.width + 4,
      top: n.y - 4,
      bottom: n.y + size.height + 4,
    };
  });
  const points = [...route];
  // Points 0, 1 and their mirrors at the end hold the port stubs and never move.
  const movable = (i: number) => i >= 2 && i <= points.length - 3;
  for (let i = 1; i + 3 < points.length; i++) {
    const [a, p, q, b] = points.slice(i, i + 4);
    const run = p.y === q.y ? 'x' : 'y';
    if (Math.abs(p[run] - q[run]) >= JOG) continue;
    // Prefer either existing line; the midpoint fits when each line grazes a different card.
    for (const c of [q[run], p[run], Math.round((p[run] + q[run]) / 2)]) {
      if ((c !== a[run] && !movable(i)) || (c !== b[run] && !movable(i + 3))) continue;
      const a2 = { ...a, [run]: c },
        b2 = { ...b, [run]: c };
      if (
        !clear(a2, b2, cards) ||
        (i > 0 && !clear(points[i - 1], a2, cards)) ||
        !clear(b2, points[i + 4], cards)
      )
        continue;
      points.splice(i, 4, a2, b2);
      i = 0;
      break;
    }
  }
  return points;
}
export function roundedWire(points: Point[]): string {
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const before = points[i - 1],
      p = points[i],
      after = points[i + 1];
    const length = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
    const radius = Math.min(8, length(before, p) / 2, length(p, after) / 2);
    const approach = (q: Point) => {
      const d = length(q, p) || 1;
      return `${p.x + ((q.x - p.x) * radius) / d} ${p.y + ((q.y - p.y) * radius) / d}`;
    };
    path += ` L ${approach(before)} Q ${p.x} ${p.y} ${approach(after)}`;
  }
  return path + ` L ${points.at(-1)!.x} ${points.at(-1)!.y}`;
}
