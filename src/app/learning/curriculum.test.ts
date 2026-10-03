import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { parameterCount, nextEra, DenseBlock } from './curriculum';
import { decodeDigits } from './mnist';
import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';

test('network dimensions include every bias and the fixed ten-way output', () => {
  assert.equal(parameterCount([]), 7850);
  assert.equal(parameterCount([{ id: 1, units: 32, activation: 'linear' }]), 25450);
  assert.equal(parameterCount([{ id: 1, units: 32, activation: 'relu' }, { id: 2, units: 16, activation: 'tanh' }]), 25818);
});
test('unlocking requires completing each chapter experiment, not an accuracy threshold', () => {
  const linear: DenseBlock[] = [{ id: 1, units: 32, activation: 'linear' }];
  assert.equal(nextEra(0, []), 0);
  assert.equal(nextEra(0, linear), 1);
  assert.equal(nextEra(1, linear), 1);
  assert.equal(nextEra(1, [{ ...linear[0], activation: 'tanh' }]), 2);
  assert.equal(nextEra(2, linear), 2);
});
test('MNIST records preserve labels and normalize the complete local dataset', () => {
  for (const [split, count] of [['train', 3000], ['test', 500]] as const) {
    const buffer = gunzipSync(readFileSync(`public/data/mnist-${split}.bin.gz`));
    const data = decodeDigits(Uint8Array.from(buffer).buffer, count);
    assert.equal(data.count, count);
    assert.equal(data.pixels.length, count * 784);
    assert.equal(new Set(data.labels).size, 10);
    assert.ok(data.pixels.every(value => value >= 0 && value <= 1));
    assert.equal(data.labels[0], buffer[0]);
    assert.ok(Math.abs(data.pixels[100] - buffer[101] / 255) < 1e-7);
  }
});
test('truncated and invalid digit data fail explicitly', () => {
  assert.throws(() => decodeDigits(new ArrayBuffer(4), 1), /incomplete/);
  const record = new Uint8Array(785); record[0] = 10;
  assert.throws(() => decodeDigits(record.buffer, 1), /invalid label/);
});
