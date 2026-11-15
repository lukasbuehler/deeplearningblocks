import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { BLOCKS, BLOCK_WIDTH, BlockNode, portPosition } from './graph';
import { routeWire, roundedWire } from './wire-router';

test('routed wires avoid source, destination and intervening card interiors', () => {
  const source: BlockNode = { id: 'a', kind: 'dense', units: 32, x: 0, y: 400 };
  const target: BlockNode = { id: 'b', kind: 'activation', activation: 'relu', x: 500, y: 0 };
  const obstacle: BlockNode = { id: 'c', kind: 'flatten', x: 250, y: 230 };
  for (const destination of [target, { ...target, x: 0, y: 900 }, { ...target, x: 350, y: 470 }]) {
    const nodes = [source, destination, obstacle],
      route = routeWire(source, destination, nodes);
    assert.deepEqual(route[0], portPosition(source, 'output'));
    assert.deepEqual(route.at(-1), portPosition(destination, 'input'));
    for (let i = 1; i < route.length; i++) {
      const a = route[i - 1],
        b = route[i];
      assert.ok(a.x === b.x || a.y === b.y);
      for (const n of nodes) {
        const intersects =
          a.x === b.x
            ? a.x > n.x &&
              a.x < n.x + BLOCK_WIDTH &&
              Math.max(a.y, b.y) > n.y &&
              Math.min(a.y, b.y) < n.y + BLOCKS[n.kind].height
            : a.y > n.y &&
              a.y < n.y + BLOCKS[n.kind].height &&
              Math.max(a.x, b.x) > n.x &&
              Math.min(a.x, b.x) < n.x + BLOCK_WIDTH;
        assert.equal(intersects, false, `segment crosses ${n.id}: ${JSON.stringify([a, b])}`);
      }
    }
    assert.ok(!roundedWire(route).includes('NaN'));
  }
});
test('snapped blocks retain their shared port without a loop', () => {
  const a: BlockNode = { id: 'a', kind: 'flatten', x: 30, y: 40 },
    b: BlockNode = { id: 'b', kind: 'dense', units: 32, x: 30, y: 188 };
  assert.deepEqual(routeWire(a, b, [a, b]), [portPosition(a, 'output'), portPosition(b, 'input')]);
});
test('a dragged card does not make a near-tied wire flip back and forth', () => {
  const flatten: BlockNode = { id: 'f', kind: 'flatten', x: 380, y: 100 };
  const dense: BlockNode = { id: 'd', kind: 'dense', units: 32, x: 520, y: 330 };
  const side = (route: { x: number }[], image: BlockNode) =>
    route[2].x < image.x + BLOCK_WIDTH / 2 ? 'left' : 'right';
  // Sweep the image card right and back; count how often its wire changes side.
  let previous: ReturnType<typeof routeWire> | undefined;
  let last = '',
    flips = 0;
  const positions = [
    ...Array.from({ length: 300 }, (_, i) => 100 + i),
    ...Array.from({ length: 300 }, (_, i) => 399 - i),
  ];
  for (const x of positions) {
    const image: BlockNode = { id: 'i', kind: 'image', x, y: 300 };
    previous = routeWire(image, flatten, [image, flatten, dense], previous);
    const now = side(previous, image);
    if (last && now !== last) flips++;
    last = now;
  }
  // Exactly one switch each way; a tie would flicker many times around the crossover.
  assert.ok(flips <= 2, `flipped ${flips} times`);
});
test('routes never contain jogs of only a few pixels', () => {
  const flatten: BlockNode = { id: 'f', kind: 'flatten', x: 380, y: 100 };
  for (let x = 0; x < 400; x++) {
    const image: BlockNode = { id: 'i', kind: 'image', x, y: 280 };
    const route = routeWire(image, flatten, [image, flatten]);
    for (let i = 2; i < route.length - 1; i++) {
      const length = Math.abs(route[i].x - route[i - 1].x) + Math.abs(route[i].y - route[i - 1].y);
      assert.ok(length >= 14, `jog of ${length}px at x=${x}: ${JSON.stringify(route)}`);
    }
  }
});

test('shortcut wires leave touching text stacks sideways and reach the side socket', async () => {
  const { transformerBoard } = await import('./text-fixtures');
  const { layoutStacks } = await import('./stacks');
  const { nodeSize } = await import('./graph');
  const board = layoutStacks(transformerBoard());
  for (const edge of board.edges.filter((e) => e.port)) {
    const source = board.nodes.find((n) => n.id === edge.from)!;
    const target = board.nodes.find((n) => n.id === edge.to)!;
    const route = routeWire(source, target, board.nodes, undefined, edge.port);
    assert.deepEqual(route.at(-1), portPosition(target, 'input', 'skip'));
    for (let i = 1; i < route.length; i++) {
      const a = route[i - 1],
        b = route[i];
      assert.ok(a.x === b.x || a.y === b.y);
      for (const node of board.nodes) {
        const size = nodeSize(node);
        const crosses =
          a.x === b.x
            ? a.x > node.x &&
              a.x < node.x + size.width &&
              Math.max(a.y, b.y) > node.y &&
              Math.min(a.y, b.y) < node.y + size.height
            : a.y > node.y &&
              a.y < node.y + size.height &&
              Math.max(a.x, b.x) > node.x &&
              Math.min(a.x, b.x) < node.x + size.width;
        assert.equal(crosses, false, `shortcut crosses ${node.id}`);
      }
    }
  }
});
