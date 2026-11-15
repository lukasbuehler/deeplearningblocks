import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  BLOCKS,
  Board,
  FRAME,
  customLayout,
  compileBoard,
  customBlockName,
  describeNetwork,
  inferShapes,
  nodeSize,
  portPosition,
} from './graph';
import {
  extractFromRecipe,
  insertIntoRecipe,
  makeCustomBlock,
  nextPickable,
  pickedChain,
  takeApart,
} from './custom-blocks';
import { freshGame, loadGame, saveGame } from './storage';
import { pytorchModel } from './pytorch-export';
import { blockName } from './block-catalog';

const board: Board = {
  viewport: { x: 0, y: 0, zoom: 1 },
  nodes: [
    { id: 'image', kind: 'image', x: 0, y: 0 },
    { id: 'flatten', kind: 'flatten', x: 0, y: 0 },
    { id: 'hidden', kind: 'dense', units: 32, x: 0, y: 0 },
    { id: 'relu', kind: 'activation', activation: 'relu', x: 0, y: 0 },
    { id: 'scores', kind: 'dense', units: 10, x: 0, y: 0 },
    { id: 'softmax', kind: 'softmax', x: 0, y: 0 },
    { id: 'classifier', kind: 'classifier', x: 0, y: 0 },
  ],
  edges: [
    { from: 'image', to: 'flatten' },
    { from: 'flatten', to: 'hidden' },
    { from: 'hidden', to: 'relu' },
    { from: 'relu', to: 'scores' },
    { from: 'scores', to: 'softmax' },
    { from: 'softmax', to: 'classifier' },
  ],
};
let counter = 0;
const newId = () => `copy-${counter++}`;

test('picked blocks must be one wired chain of Dense and activation blocks', () => {
  assert.deepEqual(pickedChain(board, ['relu', 'hidden']), ['hidden', 'relu']);
  assert.match(pickedChain(board, ['hidden', 'scores']) as string, /attached together/);
  assert.match(pickedChain(board, ['flatten', 'hidden']) as string, /Dense and activation/);
  assert.equal(nextPickable(board, ['hidden']), 'relu');
  assert.equal(nextPickable(board, ['scores']), null);
});

test('making a custom block requires at least two selected pieces', () => {
  assert.match(makeCustomBlock(board, ['hidden'], 'single') as string, /at least two/);
});

test('making a custom block keeps the computation and taking it apart restores the blocks', () => {
  const before = compileBoard(board).network!;
  const made = makeCustomBlock(board, ['hidden', 'relu'], 'mine') as Board;
  assert.equal(made.nodes.length, board.nodes.length - 1);
  assert.deepEqual(
    made.edges.filter((e) => e.from === 'mine' || e.to === 'mine'),
    [
      { from: 'flatten', to: 'mine' },
      { from: 'mine', to: 'scores' },
    ],
  );
  const grouped = compileBoard(made).network!;
  assert.equal(grouped.signature, before.signature);
  assert.equal(grouped.parameters, before.parameters);
  assert.equal(inferShapes(made).get('mine')?.output, 32);

  const apart = takeApart(made, 'mine', newId);
  assert.equal(compileBoard(apart).network!.signature, before.signature);
  assert.ok(apart.nodes.some((n) => n.id === 'hidden') && apart.nodes.some((n) => n.id === 'relu'));
});

test('repeat stacks copies that each learn their own weights', () => {
  const made = makeCustomBlock(board, ['hidden', 'relu'], 'mine') as Board;
  const repeated: Board = {
    ...made,
    nodes: made.nodes.map((n) => (n.id === 'mine' ? { ...n, repeat: 3 } : n)),
  };
  const network = compileBoard(repeated).network!;
  assert.equal(
    describeNetwork(network),
    'Flatten → Dense 32 → relu → Dense 32 → relu → Dense 32 → relu → Dense 10 → Softmax',
  );
  assert.equal(network.parameters, 785 * 32 + 33 * 32 * 2 + 33 * 10);
  assert.match(
    pytorchModel(network),
    /nn\.Linear\(32, 32\),\n {4}nn\.ReLU\(\),\n {4}nn\.Linear\(32, 32\)/,
  );

  const apart = takeApart(repeated, 'mine', newId);
  assert.equal(apart.nodes.filter((n) => n.kind === 'dense').length, 4);
  assert.equal(new Set(apart.nodes.map((n) => n.id)).size, apart.nodes.length);
  assert.equal(compileBoard(apart).network!.signature, network.signature);

  const tooDeep = {
    ...made,
    nodes: made.nodes.map((n) =>
      n.id === 'mine' ? { ...n, repeat: 6, blocks: [...n.blocks!, ...n.blocks!] } : n,
    ),
  };
  assert.match(compileBoard(tooDeep).issues[0].message, /Repeats count every copy/);
  const tooMany = {
    ...made,
    nodes: made.nodes.map((n) => (n.id === 'mine' ? { ...n, repeat: 7 } : n)),
  };
  assert.match(compileBoard(tooMany).issues[0].message, /Repeat a custom block 1 to 6/);
});

test('an expanded custom block grows around full-size inner blocks without changing the network', () => {
  const made = makeCustomBlock(board, ['hidden', 'relu'], 'mine') as Board;
  const custom = made.nodes.find((n) => n.id === 'mine')!;
  const open = { ...custom, expanded: true };
  const size = nodeSize(open);
  assert.equal(size.height, customLayout(open).controlsTop + 44 + FRAME.foot);
  assert.equal(portPosition(open, 'output').y, open.y + size.height);
  assert.equal(size.width, nodeSize(custom).width);

  const expanded: Board = { ...made, nodes: made.nodes.map((n) => (n.id === 'mine' ? open : n)) };
  assert.equal(compileBoard(expanded).network!.signature, compileBoard(made).network!.signature);
  // Taking apart an expanded block leaves the parts exactly where they were drawn.
  const apart = takeApart(expanded, 'mine', newId);
  const hidden = apart.nodes.find((n) => n.id === 'hidden')!;
  const relu = apart.nodes.find((n) => n.id === 'relu')!;
  assert.deepEqual([hidden.x, hidden.y], [open.x + FRAME.pad, open.y + FRAME.head]);
  assert.equal(relu.y, hidden.y + BLOCKS.dense.height + FRAME.gap);
});

test('custom blocks are named by the part before "block"', () => {
  assert.equal(customBlockName('Transformer block'), 'Transformer');
  assert.equal(customBlockName(' Building blocks '), 'Building');
  assert.equal(customBlockName(undefined), '');
  const made = makeCustomBlock(board, ['hidden', 'relu'], 'mine') as Board;
  const custom = made.nodes.find((n) => n.id === 'mine')!;
  assert.equal(blockName(custom), 'Custom block');
  assert.equal(blockName({ ...custom, name: 'Transformer' }), 'Transformer block');
});

test('blocks move out of and back into the shared recipe without losing configuration', () => {
  const made = makeCustomBlock(board, ['hidden', 'relu'], 'mine') as Board;
  const pulled = extractFromRecipe(made, 'mine', 'hidden', { x: 800, y: 50 }, newId);
  assert.deepEqual(
    pulled.nodes.find((n) => n.id === 'mine')!.blocks!.map((n) => n.id),
    ['relu'],
  );
  const loose = pulled.nodes.find((n) => n.id === 'hidden')!;
  assert.equal(loose.units, 32);
  const restored = insertIntoRecipe(pulled, 'mine', ['hidden'], 0) as Board;
  assert.deepEqual(
    restored.nodes.find((n) => n.id === 'mine')!.blocks,
    made.nodes.find((n) => n.id === 'mine')!.blocks,
  );
  assert.equal(restored.nodes.filter((n) => n.id === 'hidden').length, 0);
  assert.equal(compileBoard(restored).network!.signature, compileBoard(made).network!.signature);
});

test('repeat counts and empty editable recipes survive a save and reload', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
  try {
    const save = freshGame();
    save.mode = 'sandbox';
    save.sandbox.board = {
      ...save.sandbox.board,
      nodes: [{ id: 'empty', kind: 'custom', x: 0, y: 0, repeat: 3, blocks: [], expanded: true }],
      edges: [],
    };
    assert.ok(saveGame(save));
    assert.deepEqual(loadGame().sandbox.board.nodes[0], save.sandbox.board.nodes[0]);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
