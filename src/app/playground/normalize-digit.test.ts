import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { normalizeDigit } from './digit-pad/normalize-digit';
test('blank drawings cannot be submitted and ink is normalized, centered and padded', () => {
  const image = new Uint8ClampedArray(280 * 280 * 4);
  assert.equal(normalizeDigit(image, 280, 280), null);
  for (let y = 40; y < 240; y++) for (let x = 30; x < 50; x++) image[(y * 280 + x) * 4] = 255;
  const digit = normalizeDigit(image, 280, 280)!;
  assert.equal(digit.length, 784);
  assert.ok(digit.every((v) => v >= 0 && v <= 1));
  let mass = 0,
    cx = 0,
    cy = 0;
  digit.forEach((v, i) => {
    mass += v;
    cx += (i % 28) * v;
    cy += Math.floor(i / 28) * v;
  });
  assert.ok(Math.abs(cx / mass - 13.5) <= 0.5);
  assert.ok(Math.abs(cy / mass - 13.5) <= 0.5);
  assert.equal(
    digit.slice(0, 28 * 3).reduce((a, b) => a + b),
    0,
  );
  assert.ok(mass > 0);
});
