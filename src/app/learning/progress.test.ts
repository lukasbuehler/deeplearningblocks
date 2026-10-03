import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readProgress, saveProgress, EMPTY_PROGRESS } from './progress';

function storage(value: string | null, fails = false): void {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: () => {
        if (fails) throw new Error('blocked');
        return value;
      },
      setItem: () => {
        if (fails) throw new Error('blocked');
      },
    },
  });
}
test('corrupt, locked or oversized saved networks safely start fresh', () => {
  for (const value of [
    '{broken',
    JSON.stringify({ era: 0, blocks: [{ id: 1, units: 32, activation: 'relu' }] }),
    JSON.stringify({ era: 2, blocks: [{ id: 1, units: 1000000, activation: 'relu' }] }),
    JSON.stringify({ era: 9, blocks: [] }),
    JSON.stringify({ era: 1, blocks: [null] }),
  ]) {
    storage(value);
    assert.deepEqual(readProgress(), EMPTY_PROGRESS);
  }
});
test('valid progress survives and unavailable storage remains nonblocking', () => {
  const progress = {
    era: 1,
    blocks: [{ id: 1, units: 32, activation: 'sigmoid' }],
    experiments: [],
  };
  storage(JSON.stringify(progress));
  assert.deepEqual(readProgress(), progress);
  storage(null, true);
  assert.deepEqual(readProgress(), EMPTY_PROGRESS);
  assert.equal(saveProgress(EMPTY_PROGRESS), false);
});
