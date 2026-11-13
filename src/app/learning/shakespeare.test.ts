import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import {
  CONTEXT,
  SHAKESPEARE_ALPHABET,
  SHAKESPEARE_CHARACTERS,
  VOCAB_SIZE,
  decode,
  decodeCorpus,
  encode,
  sampleBatch,
  sampleLetter,
  seededRandom,
} from './shakespeare';

test('bundled Tiny Shakespeare matches its manifest and the declared 65-letter alphabet', () => {
  const manifest = JSON.parse(readFileSync('public/data/tiny-shakespeare-manifest.json', 'utf8'));
  const compressed = readFileSync('public/data/tiny-shakespeare.txt.gz');
  assert.equal(createHash('sha256').update(compressed).digest('hex'), manifest.sha256.gzip);
  const raw = gunzipSync(compressed);
  assert.equal(createHash('sha256').update(raw).digest('hex'), manifest.sha256.text);
  const text = raw.toString('utf8');
  assert.equal(text.length, SHAKESPEARE_CHARACTERS);
  assert.equal([...new Set(text)].sort().join(''), SHAKESPEARE_ALPHABET);
  assert.equal(manifest.alphabet, SHAKESPEARE_ALPHABET);
  assert.equal(VOCAB_SIZE, 65);
  const corpus = decodeCorpus(Uint8Array.from(raw).buffer);
  assert.equal(corpus.train.length + corpus.validation.length, SHAKESPEARE_CHARACTERS);
  assert.equal(corpus.train.length, Math.floor(SHAKESPEARE_CHARACTERS * 0.9));
  assert.equal(decode(corpus.train.subarray(0, 14)), 'First Citizen:');
});

test('letters round-trip and unknown letters are dropped and counted', () => {
  assert.equal(decode(encode('ROMEO:\nO, she doth teach!').ids), 'ROMEO:\nO, she doth teach!');
  assert.deepEqual(encode('é1A\r\n'), { ids: Uint8Array.from([13, 0]), dropped: 2 });
  assert.throws(() => decodeCorpus(new TextEncoder().encode('Too short').buffer), /incomplete/);
});

test('batches are reproducible, shifted by one letter and never leave their region', () => {
  const region = Uint8Array.from({ length: 200 }, (_, i) => i % VOCAB_SIZE);
  const a = sampleBatch(region, 8, CONTEXT, seededRandom(5)),
    b = sampleBatch(region, 8, CONTEXT, seededRandom(5));
  assert.deepEqual(a, b);
  for (let row = 0; row < 8; row++)
    for (let i = 0; i < CONTEXT; i++) {
      assert.equal(a.targets[row * CONTEXT + i], (a.inputs[row * CONTEXT + i] + 1) % VOCAB_SIZE);
    }
  // A region exactly one window long can only produce that window.
  const tight = Uint8Array.from({ length: CONTEXT + 2 }, (_, i) => i);
  const only = sampleBatch(tight, 4, CONTEXT, seededRandom(9));
  assert.ok(only.targets.every((t) => t <= CONTEXT + 1));
});

test('low temperature picks the favourite letter and high temperature spreads out', () => {
  const scores = [0, 3, 1];
  const careful = new Set(
    Array.from({ length: 50 }, (_, i) => sampleLetter(scores, 0.05, seededRandom(i))),
  );
  assert.deepEqual([...careful], [1]);
  const wild = new Set(
    Array.from({ length: 200 }, (_, i) => sampleLetter(scores, 3, seededRandom(i))),
  );
  assert.equal(wild.size, 3);
});
