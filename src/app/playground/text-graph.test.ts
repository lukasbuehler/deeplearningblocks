import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  BlockNode,
  Board,
  Edge,
  compileBoard,
  connect,
  connectionError,
  freshBoard,
  hasTransformerBlock,
  inferShapes,
  newConnectionError,
  portPosition,
  skippedKinds,
  textStepParameters,
} from './graph';
import { transformerBoard } from './text-fixtures';

test('a transformer board compiles shortcut wires into steps that name their sources', () => {
  const network = compileBoard(transformerBoard()).network!;
  assert.equal(network.world, 'text');
  assert.deepEqual(network.steps, [
    { kind: 'embedding', units: 48, from: -1 },
    { kind: 'position', from: 0 },
    { kind: 'layernorm', from: 1 },
    { kind: 'attention', heads: 4, from: 2 },
    { kind: 'add', skip: 1, from: 3 },
    { kind: 'layernorm', from: 4 },
    { kind: 'dense', units: 96, from: 5 },
    { kind: 'activation', activation: 'relu', from: 6 },
    { kind: 'dense', units: 48, from: 7 },
    { kind: 'add', skip: 4, from: 8 },
    { kind: 'layernorm', from: 9 },
    { kind: 'dense', units: 65, from: 10 },
    { kind: 'softmax', from: 11 },
  ]);
  // Letters 65·48, seats 32·48, three norms 3·2·48, attention 4·(48² + 48),
  // feed-forward 49·96 + 97·48, letter scores 49·65.
  assert.equal(network.parameters, 3120 + 1536 + 288 + 9408 + 4704 + 4656 + 3185);
  assert.equal(textStepParameters({ kind: 'attention', heads: 4 }, 48), 9408);
  assert.deepEqual(skippedKinds(network.steps, 4), ['attention', 'layernorm']);
  assert.deepEqual(skippedKinds(network.steps, 9), ['dense', 'activation', 'dense', 'layernorm']);
  assert.equal(hasTransformerBlock(network), true);
  assert.equal(network.nodeIds[0], 'text');
  assert.equal(network.nodeIds.at(-1), 'writer');
});

test('swapped Add sockets and moved blocks compile to the same computation', () => {
  const board = transformerBoard();
  const reference = compileBoard(board).network!;
  board.nodes.reverse().forEach((node, i) => (node.x = i * 50));
  assert.equal(compileBoard(board).network!.signature, reference.signature);
  // The sublayer arrives in the shortcut socket and the shortcut in the main socket.
  board.edges = board.edges.map((e) =>
    e.to === 'add1' ? (e.port ? { from: e.from, to: 'add1' } : { ...e, port: 'skip' }) : e,
  );
  const swapped = compileBoard(board).network!;
  assert.equal(hasTransformerBlock(swapped), true);
  assert.equal(swapped.parameters, reference.parameters);
});

test('the level needs both shortcuts, a norm and position seats', () => {
  const withoutShortcut = transformerBoard();
  withoutShortcut.edges = withoutShortcut.edges.filter((e) => e.port !== 'skip' || e.to !== 'add2');
  assert.match(compileBoard(withoutShortcut).issues[0].message, /Add needs two wires/);
  assert.equal(compileBoard(withoutShortcut).issues[0].nodeId, 'add2');
  // One shortcut around both halves is a valid network, but not yet a transformer block.
  const wide = transformerBoard();
  wide.edges = wide.edges
    .filter((e) => !(e.to === 'add1' || e.from === 'add1'))
    .concat({ from: 'attn', to: 'norm2' }, { from: 'pos', to: 'add2', port: 'skip' });
  const merged = compileBoard(wide).network!;
  assert.ok(merged);
  assert.equal(hasTransformerBlock(merged), false);
  const noPosition = transformerBoard();
  noPosition.edges = noPosition.edges
    .filter((e) => e.from !== 'pos' && e.to !== 'pos')
    .concat({ from: 'embed', to: 'norm1' }, { from: 'embed', to: 'add1', port: 'skip' });
  assert.equal(hasTransformerBlock(compileBoard(noPosition).network!), false);
});

test('text wires check types, shortcut sockets, fan-out and loops', () => {
  const board = transformerBoard();
  const empty: Board = { ...board, edges: [] };
  assert.match(connectionError(empty, 'text', 'pos')!, /Letter embedding/);
  assert.match(connectionError(empty, 'embed', 'writer')!, /65 letter chances/);
  assert.match(connectionError(empty, 'embed', 'attn', 'skip')!, /Only Add/);
  // Sequences may feed several sockets; letter IDs may not.
  assert.equal(
    connectionError(board, 'pos', 'norm2'),
    'That socket is taken. Disconnect its wire first.',
  );
  const twoBranches = connect(
    { ...board, edges: board.edges.filter((e) => e.to !== 'norm2') },
    'pos',
    'norm2',
  );
  assert.equal(twoBranches.edges.filter((e) => e.from === 'pos').length, 3);
  const second = {
    ...empty,
    nodes: [...empty.nodes, { id: 'embed2', kind: 'embedding' as const, units: 8, x: 0, y: 0 }],
  };
  assert.match(connectionError(connect(second, 'text', 'embed'), 'text', 'embed2')!, /occupied/);
  // Both Add sockets from one block is a mistake, not a shortcut.
  const one = connect(empty, 'attn', 'add1');
  assert.match(connectionError(one, 'attn', 'add1', 'skip')!, /same block/);
  assert.match(connectionError(board, 'add2', 'norm1')!, /taken/);
  const loose = { ...board, edges: board.edges.filter((e) => e.to !== 'norm1') };
  assert.match(connectionError(loose, 'add2', 'norm1')!, /loop/);
});

test('Add and Softmax widths are checked while wiring', () => {
  const board = transformerBoard();
  board.nodes.find((n) => n.id === 'down')!.units = 40;
  board.edges = board.edges.filter((e) => e.to !== 'add2');
  const shapes = inferShapes(board);
  assert.equal(newConnectionError(board, 'down', 'add2', shapes), null);
  const withMain = connect(board, 'down', 'add2');
  assert.match(
    newConnectionError(withMain, 'add1', 'add2', inferShapes(withMain), 'skip')!,
    /same size.*48.*40/,
  );
  const scores = transformerBoard();
  scores.nodes.find((n) => n.id === 'scores')!.units = 64;
  assert.match(compileBoard(scores).issues[0].message, /65 letter scores/);
  scores.edges = scores.edges.filter((e) => e.to !== 'softmax');
  assert.match(newConnectionError(scores, 'scores', 'softmax')!, /65 letter scores/);
});

test('attention heads must share the width equally', () => {
  const board = transformerBoard(30);
  assert.match(compileBoard(board).issues[0].message, /4 heads must share 30/);
  board.nodes.find((n) => n.id === 'attn')!.heads = 2;
  assert.ok(compileBoard(board).network);
});

test('fresh text paper and the shortcut socket position', () => {
  const board = freshBoard('text');
  assert.equal(board.world, 'text');
  assert.deepEqual(
    board.nodes.map((n) => n.kind),
    ['text', 'writer'],
  );
  assert.match(compileBoard(board).issues[0].message, /Connect the text/);
  assert.equal(freshBoard().world, undefined);
  const add: BlockNode = { id: 'a', kind: 'add', x: 0, y: 100 };
  assert.ok(portPosition(add, 'input', 'skip').x > portPosition(add, 'input').x);
  assert.equal(portPosition(add, 'input', 'skip').y, 100);
});
