import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Board, compileBoard, connectionError, removeNode } from './graph';
import { splitLegacyOutput } from './board-migration';
import { freshGame, loadGame, PREVIOUS_SAVE_KEY, SAVE_KEY, saveGame } from './storage';
import { blockyHint } from './blocky-hints';
import { experimentHint } from './experiment-hints';
function board(): Board {
  const nodes: Board['nodes'] = [
    { id: 'i', kind: 'image', x: 0, y: 0 },
    { id: 'f', kind: 'flatten', x: 0, y: 240 },
    { id: 'd', kind: 'dense', units: 10, x: 0, y: 420 },
    { id: 's', kind: 'softmax', x: 0, y: 640 },
    { id: 'c', kind: 'classifier', x: 0, y: 840 },
  ];
  return {
    nodes,
    edges: nodes.slice(1).map((n, i) => ({ from: nodes[i].id, to: n.id })),
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}
test('display cannot hide learning; explicit linear classifier has exactly 7850 parameters', () => {
  const b = board(),
    compiled = compileBoard(b).network!;
  assert.deepEqual(compiled.steps, [
    { kind: 'flatten' },
    { kind: 'dense', units: 10 },
    { kind: 'softmax' },
  ]);
  assert.equal(compiled.parameters, 7850);
  assert.match(connectionError({ ...b, edges: [] }, 'f', 'c')!, /probabilities/);
  assert.match(connectionError({ ...b, edges: [] }, 'd', 'c')!, /Softmax/);
  assert.match(connectionError({ ...b, edges: [] }, 's', 'd')!, /before Softmax/);
  assert.equal(compileBoard(removeNode(b, 'd')).network, null);
  assert.equal(compileBoard(removeNode(b, 's')).network, null);
  b.nodes.find((n) => n.id === 'd')!.units = 32;
  assert.match(compileBoard(b).issues[0].message, /gets 32/);
  assert.equal(blockyHint(b, 0, 'journey').id, 'output-width');
});
test('v2 migration preserves both notebooks, unlocks, unique IDs and the recovery copy', () => {
  const legacy = board();
  legacy.nodes = legacy.nodes.filter((n) => !['d', 's'].includes(n.id));
  legacy.edges = [
    { from: 'i', to: 'f' },
    { from: 'f', to: 'c' },
  ];
  legacy.nodes.push({ id: 'c-scores', kind: 'dense', units: 16, x: 700, y: 0 });
  const old = {
    ...freshGame(),
    version: 2,
    era: 2,
    checkedChapters: [0, 1],
    journey: {
      board: legacy,
      experiments: [{ era: 0, accuracy: 0.898, loss: 0.3, layers: 'Flatten → 10-way guess' }],
    },
    sandbox: { board: legacy, experiments: [] },
  };
  const recovery = JSON.stringify(old),
    memory = new Map([['dlb-playground-v2', recovery]]);
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => memory.get(k) ?? null,
      setItem: (k: string, v: string) => memory.set(k, v),
    },
  });
  const migrated = loadGame();
  assert.equal(migrated.version, 4);
  assert.equal(migrated.era, 2);
  assert.equal(migrated.journey.levels['first-network'].completed, true);
  assert.equal(migrated.journey.levels['hidden-layers'].completed, true);
  assert.deepEqual(migrated.journey.levels['first-network'].experiments, old.journey.experiments);
  for (const workspace of [migrated.journey.levels['deeper-network'], migrated.sandbox]) {
    assert.equal(compileBoard(workspace.board).network?.parameters, 7850);
    assert.equal(
      new Set(workspace.board.nodes.map((n) => n.id)).size,
      workspace.board.nodes.length,
    );
  }
  saveGame(migrated);
  assert.equal(memory.get('dlb-playground-v2'), recovery);
  assert.deepEqual(loadGame(), migrated);
  // An invalid-width experiment remains editable across reload rather than losing the board.
  migrated.journey.levels['deeper-network'].board.nodes.find((n) => n.id === 'c-scores-1')!.units =
    32;
  saveGame(migrated);
  assert.equal(
    loadGame().journey.levels['deeper-network'].board.nodes.find((n) => n.id === 'c-scores-1')!
      .units,
    32,
  );
  assert.ok(memory.has(SAVE_KEY));
});
test('migration also exposes a disconnected output without connecting the image for the player', () => {
  const b = board();
  b.nodes = b.nodes.filter((n) => ['i', 'c'].includes(n.id));
  b.edges = [];
  const migrated = splitLegacyOutput(b);
  assert.equal(migrated.edges.length, 2);
  assert.equal(compileBoard(migrated).network, null);
  assert.equal(b.nodes.length, 2);
});
test('post-experiment advice targets real operations and does not call a linear classifier broken', () => {
  const b = board();
  let hint = experimentHint(b, compileBoard(b).network!, 1, 0.898);
  assert.match(hint.text, /89.8%.*linear classifier/);
  assert.equal(hint.id, 'experiment-hidden');
  assert.deepEqual(hint.target, { kind: 'edge', from: 'f', to: 'd' });
  b.nodes.push({ id: 'h', kind: 'dense', units: 32, x: 300, y: 0 });
  b.edges = b.edges.filter((e) => e.from !== 'f');
  b.edges.push({ from: 'f', to: 'h' }, { from: 'h', to: 'd' });
  hint = experimentHint(b, compileBoard(b).network!, 2, 0.9);
  assert.equal(hint.id, 'experiment-bend');
  b.nodes.push({ id: 'r', kind: 'activation', activation: 'relu', x: 400, y: 0 });
  b.edges = b.edges.filter((e) => e.from !== 'h');
  b.edges.push({ from: 'h', to: 'r' }, { from: 'r', to: 'd' });
  hint = experimentHint(b, compileBoard(b).network!, 2, 0.91);
  assert.equal(hint.id, 'experiment-width');
  assert.match(hint.why, /not guaranteed/);
  assert.equal(blockyHint(b, 2, 'journey', undefined, 0.91).id, 'experiment-width');
});

test('lesson clues place hidden nonlinearities before the score layer', () => {
  const b = board();
  const clue = blockyHint(b, 1, 'journey');
  assert.deepEqual(clue.target, { kind: 'edge', from: 'f', to: 'd' });
  assert.match(clue.text, /before Dense/);
  // A sigmoid applied only after the final score layer is not a hidden activation.
  b.nodes.push({ id: 'a', kind: 'activation', activation: 'sigmoid', x: 500, y: 0 });
  b.edges = b.edges.filter((e) => e.from !== 'd');
  b.edges.push({ from: 'd', to: 'a' }, { from: 'a', to: 's' });
  assert.equal(blockyHint(b, 1, 'journey').id, 'nonlinear');
});
