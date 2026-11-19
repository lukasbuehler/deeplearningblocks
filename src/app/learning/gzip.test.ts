import { strict as assert } from 'node:assert';
import { gzipSync } from 'node:zlib';
import { test } from 'node:test';
import { readGzipResponse } from './gzip';

test('dataset responses decode both static gzip bytes and browser-decoded transport bytes', async () => {
  const source = 'First Citizen:\nBefore we proceed any further, hear me speak.\n';
  for (const response of [
    new Response(gzipSync(source)),
    new Response(source, { headers: { 'Content-Encoding': 'gzip' } }),
  ]) {
    assert.equal(new TextDecoder().decode(await readGzipResponse(response)), source);
  }
});
