import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { closestPointOnRect } from './geometry';

const rect = { x: 100, y: 100, width: 200, height: 100 };
test('helper chooses the nearest side or corner from every direction', () => {
  for (const [origin, expected] of [
    [
      { x: 50, y: 150 },
      { x: 100, y: 150 },
    ],
    [
      { x: 350, y: 150 },
      { x: 300, y: 150 },
    ],
    [
      { x: 200, y: 50 },
      { x: 200, y: 100 },
    ],
    [
      { x: 200, y: 250 },
      { x: 200, y: 200 },
    ],
    [
      { x: 50, y: 50 },
      { x: 100, y: 100 },
    ],
    [
      { x: 350, y: 50 },
      { x: 300, y: 100 },
    ],
    [
      { x: 50, y: 250 },
      { x: 100, y: 200 },
    ],
    [
      { x: 350, y: 250 },
      { x: 300, y: 200 },
    ],
  ])
    assert.deepEqual(closestPointOnRect(origin, rect), expected);
});
test('overlapping or touching the target still gives a boundary point', () => {
  assert.deepEqual(closestPointOnRect({ x: 110, y: 150 }, rect), { x: 100, y: 150 });
  assert.deepEqual(closestPointOnRect({ x: 200, y: 190 }, rect), { x: 200, y: 200 });
  assert.deepEqual(closestPointOnRect({ x: 300, y: 150 }, rect), { x: 300, y: 150 });
});
test('closest boundary is consistent through zoom and pan', () => {
  const origin = { x: 400, y: 50 };
  for (const zoom of [0.1, 0.5, 1, 1.6]) {
    const transform = (p: { x: number; y: number }) => ({ x: p.x * zoom + 75, y: p.y * zoom - 20 });
    assert.deepEqual(
      closestPointOnRect(transform(origin), {
        ...transform(rect),
        width: rect.width * zoom,
        height: rect.height * zoom,
      }),
      transform(closestPointOnRect(origin, rect)),
    );
  }
});
