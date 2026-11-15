import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { LEVELS, meetsLevel } from './levels';
import { freshBoard, NetworkSpec } from './graph';
import { freshGame, loadGame, PREVIOUS_SAVE_KEY, SAVE_KEY, saveGame } from './storage';

test('v3 migration preserves the current canvas, earned progress and each notebook without touching recovery', () => {
  const board = freshBoard();
  board.viewport = { x: 83, y: 27, zoom: 0.8 };
  const experiments = [0, 1, 2].map((era) => ({
    era,
    accuracy: 0.8,
    loss: 0.5,
    layers: 'saved experiment',
  }));
  const old = {
    version: 3,
    mode: 'journey',
    era: 2,
    checkedChapters: [0, 1, 2],
    journey: { board, experiments },
    sandbox: { board: freshBoard(), experiments: [] },
  };
  const recovery = JSON.stringify(old);
  const memory = new Map([[PREVIOUS_SAVE_KEY, recovery]]);
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => memory.set(key, value),
    },
  });
  const save = loadGame();
  assert.equal(save.journey.activeLevel, 'deeper-network');
  assert.deepEqual(save.journey.levels['deeper-network'].board, board);
  assert.deepEqual(save.journey.levels['first-network'].board, freshBoard());
  // The three picture levels existed in v3; the 2017 text level starts fresh and incomplete.
  Object.values(save.journey.levels)
    .slice(0, 3)
    .forEach((level, i) => {
      assert.equal(level.completed, true);
      assert.deepEqual(level.experiments, [experiments[i]]);
    });
  assert.equal(save.journey.levels.attention.completed, false);
  assert.equal(save.journey.levels.attention.board.world, 'text');
  saveGame(save);
  assert.equal(memory.get(PREVIOUS_SAVE_KEY), recovery);
  assert.deepEqual(loadGame(), save);
  // Recover only the damaged canvas, preserving discoveries and the other levels.
  const damaged = JSON.parse(memory.get(SAVE_KEY)!);
  damaged.journey.levels['first-network'].board.nodes[0].x = 'bad';
  memory.set(SAVE_KEY, JSON.stringify(damaged));
  assert.deepEqual(
    loadGame().journey.levels['deeper-network'],
    save.journey.levels['deeper-network'],
  );
  assert.equal(loadGame().journey.levels['first-network'].completed, true);
});

test('fresh levels have independent loose endpoints and notebooks', () => {
  const save = freshGame();
  save.journey.levels['first-network'].board.nodes[0].x = 999;
  assert.notEqual(save.journey.levels['hidden-layers'].board.nodes[0].x, 999);
  assert.equal(save.journey.levels['hidden-layers'].board.edges.length, 0);
});

test('the two clothing levels require different depths and activations', () => {
  const network = (hidden: number, activation: 'sigmoid' | 'relu'): NetworkSpec => ({
    signature: 'test',
    parameters: 0,
    nodeIds: [],
    steps: [
      ...Array.from({ length: hidden }, () => [
        { kind: 'dense' as const, units: 32 },
        { kind: 'activation' as const, activation },
      ]).flat(),
      { kind: 'dense', units: 10 },
      { kind: 'softmax' },
    ],
  });
  assert.equal(LEVELS[1].dataset, LEVELS[2].dataset);
  assert.notEqual(LEVELS[1].buildLabel, LEVELS[2].buildLabel);
  assert.equal(meetsLevel(1, network(1, 'sigmoid')), true);
  assert.equal(meetsLevel(2, network(1, 'sigmoid')), false);
  assert.equal(meetsLevel(2, network(1, 'relu')), false);
  assert.equal(meetsLevel(2, network(2, 'relu')), true);
});
