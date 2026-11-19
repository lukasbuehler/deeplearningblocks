import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { BLOCK_WIDTH, MAX_PARKED, compileBoard, nodeSize, portPosition, removeNode } from './graph';
import { layoutStacks } from './stacks';
import { transformerBoard } from './text-fixtures';
import { dropShortcut, liftShortcut, shortcutTarget, shortcutViews } from './shortcuts';
import { makeCustomBlock, takeApart } from './custom-blocks';
import { freshGame, loadGame, saveGame, SAVE_KEY } from './storage';
import { BoardHistory } from './history';

test('wide Add keeps main input/output aligned and has a full-size second socket', () => {
  const board = layoutStacks(transformerBoard()),
    add = board.nodes.find((n) => n.id === 'add1')!;
  assert.equal(nodeSize(add).width, BLOCK_WIDTH * 2);
  assert.equal(portPosition(add, 'input').x, add.x + BLOCK_WIDTH / 2);
  assert.equal(portPosition(add, 'output').x, portPosition(add, 'input').x);
  assert.equal(portPosition(add, 'input', 'skip').y, add.y);
  assert.equal(portPosition(add, 'input', 'skip').x, add.x + 1.5 * BLOCK_WIDTH);
  assert.equal(
    compileBoard(board).network!.signature,
    compileBoard(transformerBoard()).network!.signature,
  );
});

test('lift, park, move and reconnect a shortcut without changing the main road', () => {
  const board = layoutStacks(transformerBoard()),
    signature = compileBoard(board).network!.signature;
  const lifted = liftShortcut(board, 'pos', { to: 'add1' });
  assert.equal(lifted.edges.filter((e) => e.port).length, 1);
  const parked = dropShortcut(lifted, 'pos', { x: 1000, y: 500 }, 40).board;
  assert.deepEqual(parked.parked, [{ from: 'pos', x: 1000, y: 500 }]);
  assert.equal(compileBoard(parked).network, null);
  const moved = liftShortcut(parked, 'pos', { parked: 0 });
  const socket = portPosition(
    board.nodes.find((n) => n.id === 'add1')!,
    'input',
    'skip',
  );
  const result = dropShortcut(moved, 'pos', socket, 40);
  assert.equal(result.connected, 'add1');
  assert.equal(result.board.parked!.length, 0);
  assert.equal(compileBoard(result.board).network!.signature, signature);
  assert.deepEqual(
    result.board.edges.filter((e) => !e.port),
    board.edges.filter((e) => !e.port),
  );
});

test('wrong-width and occupied sockets explain the problem while keeping a parked plate', () => {
  const board = layoutStacks(transformerBoard());
  const add = board.nodes.find((n) => n.id === 'add2')!;
  const socket = portPosition(add, 'input', 'skip');
  assert.match(shortcutTarget(board, 'pos', socket, 40)!.error!, /taken/);
  const lifted = liftShortcut(board, 'add1', { to: 'add2' });
  const wrong = dropShortcut(lifted, 'up', socket, 40);
  assert.match(wrong.error!, /same size/);
  assert.equal(wrong.board.parked![0].from, 'up');
  assert.equal(dropShortcut(board, 'text', socket, 40).board, board);
  const maxed = {
    ...board,
    parked: Array.from({ length: MAX_PARKED }, () => ({ from: 'pos', x: 1000, y: 400 })),
  };
  const full = dropShortcut(maxed, 'pos', { x: 2000, y: 500 }, 0);
  assert.equal(full.board, maxed);
  assert.match(full.error!, /20 parked/);
});

test('parking is computationally inert, survives saves, and participates in undo and source deletion', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => values.set(k, v),
    },
  });
  try {
    const board = transformerBoard();
    const parked = dropShortcut(board, 'pos', { x: 1000, y: 400 }, 0).board;
    assert.equal(compileBoard(parked).network!.signature, compileBoard(board).network!.signature);
    const history = new BoardHistory();
    history.record(board);
    assert.deepEqual(history.undo(parked), board);
    const save = freshGame();
    save.era = 3;
    save.journey.activeLevel = 'attention';
    save.journey.levels.attention.board = parked;
    assert.ok(saveGame(save));
    assert.deepEqual(loadGame().journey.levels.attention.board.parked, parked.parked);
    assert.deepEqual(removeNode(parked, 'pos').parked, []);
    const invalid = JSON.parse(values.get(SAVE_KEY)!);
    invalid.journey.levels.attention.board.parked[0].from = 'text';
    values.set(SAVE_KEY, JSON.stringify(invalid));
    assert.equal(loadGame().journey.levels.attention.board.parked, undefined);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

test('shortcut plates follow attached sockets and retain their sources through grouping', () => {
  const board = layoutStacks(transformerBoard());
  const views = shortcutViews(board);
  assert.equal(views.length, 2);
  for (const view of views)
    assert.deepEqual(
      view.plate,
      portPosition(
        board.nodes.find((n) => n.id === view.to)!,
        'input',
        'skip',
      ),
    );
  const parked = dropShortcut(board, 'down', { x: 1000, y: 400 }, 0).board;
  const grouped = makeCustomBlock(parked, ['up', 'relu', 'down'], 'ff');
  assert.notEqual(typeof grouped, 'string');
  if (typeof grouped === 'string') return;
  assert.equal(grouped.parked![0].from, 'ff');
  const restored = takeApart(grouped, 'ff', () => 'new-id');
  assert.equal(restored.parked![0].from, 'down');
});
