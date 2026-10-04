import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { DATASETS, experimentDataset } from './datasets';
import { decodeDigits } from './mnist';
import { LEVELS } from '../playground/levels';

test('bundled Fashion-MNIST records match manifests and contain all ten clothing classes', () => {
  const manifest = JSON.parse(readFileSync('public/data/fashion-mnist-manifest.json', 'utf8'));
  for (const [split, count] of [
    ['train', 3000],
    ['test', 500],
  ] as const) {
    const compressed = readFileSync(`public/data/fashion-mnist-${split}.bin.gz`);
    assert.equal(
      createHash('sha256').update(compressed).digest('hex'),
      manifest.splits[split].sha256,
    );
    const data = decodeDigits(Uint8Array.from(gunzipSync(compressed)).buffer, count);
    assert.equal(data.count, count);
    assert.equal(new Set(data.labels).size, 10);
    assert.ok(data.pixels.every((value) => value >= 0 && value <= 1));
    assert.notDeepEqual(compressed, readFileSync(`public/data/mnist-${split}.bin.gz`));
  }
  assert.equal(DATASETS['fashion-mnist'].classes[9], 'Ankle boot');
});

test('levels use explicit datasets while old experiment scores retain MNIST provenance', () => {
  assert.deepEqual(
    LEVELS.map((level) => level.dataset),
    ['mnist', 'fashion-mnist', 'fashion-mnist'],
  );
  assert.equal(experimentDataset({}).id, 'mnist');
  assert.equal(experimentDataset({ dataset: 'fashion-mnist' }).name, 'Fashion-MNIST');
});
