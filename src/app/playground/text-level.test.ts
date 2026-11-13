import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Board, compileBoard, freshBoard } from './graph';
import { blockyHint } from './blocky-hints';
import { makeCustomBlock, pickedChain, takeApart } from './custom-blocks';
import { LEVELS, meetsLevel } from './levels';
import { freshGame, loadGame, saveGame, SAVE_KEY } from './storage';
import { tilesFor } from './block-catalog';
import { DATASETS } from '../learning/datasets';
import { transformerBoard } from './text-fixtures';

function memoryStorage(): Map<string, string> {
  const memory = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => memory.set(key, value),
    },
  });
  return memory;
}

test('the 2017 level reads Tiny Shakespeare and checks for a transformer block', () => {
  const level = LEVELS.at(-1)!;
  assert.equal(level.id, 'attention');
  assert.equal(level.year, '2017');
  assert.equal(level.world, 'text');
  assert.equal(level.dataset, 'tiny-shakespeare');
  assert.equal(meetsLevel(3, compileBoard(transformerBoard()).network), true);
  // A picture network never completes the text level, and the reverse.
  assert.equal(meetsLevel(0, compileBoard(transformerBoard()).network), false);
  const kinds = tilesFor(DATASETS['tiny-shakespeare']).map((t) => t.kind);
  assert.ok(kinds.includes('attention') && kinds.includes('writer') && kinds.includes('dense'));
  assert.ok(!kinds.includes('image') && !kinds.includes('flatten'));
  assert.ok(!tilesFor(DATASETS.mnist).some((t) => t.kind === 'attention'));
});

test('Blocky walks a player from an empty text paper to Check build', () => {
  const board = freshBoard('text');
  assert.equal(blockyHint(board, 3, 'journey').id, 'text-embedding');
  const full = transformerBoard();
  assert.equal(blockyHint(full, 3, 'journey').id, 'ready');
  assert.deepEqual(blockyHint(full, 3, 'journey').target, { kind: 'check' });
  assert.equal(blockyHint(full, 3, 'journey', undefined, 0.4, true).id, 'text-experiment');
  const noShortcut: Board = {
    ...full,
    edges: full.edges.filter((e) => e.to !== 'add1' || !e.port),
  };
  const hint = blockyHint(noShortcut, 3, 'journey');
  assert.equal(hint.id, 'text-shortcut');
  assert.deepEqual(hint.target, { kind: 'node', id: 'add1' });
  const noRelu: Board = {
    ...full,
    nodes: full.nodes.filter((n) => n.id !== 'relu'),
    edges: full.edges.filter((e) => e.to !== 'relu' && e.from !== 'relu'),
  };
  assert.equal(blockyHint(noRelu, 3, 'journey').id, 'text-relu');
  // A rejected shortcut wire is explained with its socket in mind.
  const rejected = blockyHint(full, 3, 'journey', { from: 'attn', to: 'add1', port: 'skip' });
  assert.equal(rejected.id, 'connection');
});

test('text boards and the fourth level survive saving, and older saves gain a fresh text level', () => {
  const memory = memoryStorage();
  const save = freshGame();
  assert.deepEqual(save.journey.levels.attention.board, freshBoard('text'));
  save.era = 3;
  save.journey.activeLevel = 'attention';
  save.journey.levels.attention.board = transformerBoard();
  save.journey.levels.attention.experiments = [
    { era: 3, dataset: 'tiny-shakespeare', accuracy: 0.4, loss: 2.1, layers: 'Embed 48 → …' },
  ];
  saveGame(save);
  assert.deepEqual(loadGame(), save);
  // A save from before this level: no attention workspace, era 2.
  const old = JSON.parse(memory.get(SAVE_KEY)!);
  delete old.journey.levels.attention;
  old.era = 2;
  old.journey.activeLevel = 'deeper-network';
  memory.set(SAVE_KEY, JSON.stringify(old));
  const migrated = loadGame();
  assert.equal(migrated.era, 2);
  assert.deepEqual(migrated.journey.levels.attention.board, freshBoard('text'));
  // A picture board where a text board belongs is replaced, not trusted.
  const swapped = JSON.parse(memory.get(SAVE_KEY)!);
  swapped.era = 3;
  swapped.journey.levels.attention = { board: freshBoard(), experiments: [], completed: false };
  memory.set(SAVE_KEY, JSON.stringify(swapped));
  assert.equal(loadGame().journey.levels.attention.board.world, 'text');
  // Bad shortcut ports or heads make that one board fresh.
  const bad = JSON.parse(JSON.stringify(save));
  bad.journey.levels.attention.board.edges[0].port = 'side';
  memory.set(SAVE_KEY, JSON.stringify(bad));
  assert.deepEqual(loadGame().journey.levels.attention.board, freshBoard('text'));
  bad.journey.levels.attention.board = transformerBoard();
  bad.journey.levels.attention.board.nodes[4].heads = 3;
  memory.set(SAVE_KEY, JSON.stringify(bad));
  assert.deepEqual(loadGame().journey.levels.attention.board, freshBoard('text'));
});

test('custom blocks keep shortcut sockets and refuse a branch in the middle', () => {
  const board = transformerBoard();
  // up → relu → down is a clean chain; its output feeds Add's main socket.
  const made = makeCustomBlock(board, ['up', 'relu', 'down'], 'ffn');
  assert.ok(typeof made !== 'string');
  assert.equal(compileBoard(made).network!.signature, compileBoard(board).network!.signature);
  assert.ok(made.edges.some((e) => e.from === 'add1' && e.to === 'add2' && e.port === 'skip'));
  const back = takeApart(made, 'ffn', () => 'copy');
  assert.equal(compileBoard(back).network!.signature, compileBoard(board).network!.signature);
  // A shortcut leaves from the middle of these picks: collapsing them would change the math.
  const branched: Board = {
    ...board,
    edges: board.edges.map((e) => (e.to === 'add2' && e.port ? { ...e, from: 'up' } : e)),
  };
  branched.nodes.find((n) => n.id === 'down')!.units = 96;
  assert.match(pickedChain(branched, ['up', 'relu']) as string, /branches off/);
});
