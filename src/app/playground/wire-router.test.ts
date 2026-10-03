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
