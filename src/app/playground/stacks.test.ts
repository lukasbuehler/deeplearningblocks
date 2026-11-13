import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { BLOCKS, FRAME, customLayout, Board, inferShapes, nodeSize, portPosition } from './graph';
import { BoardHistory } from './history';
import {
  applyStackDrop,
  attachStacks,
  layoutStacks,
  moveStack,
  stackDropTarget,
  stackSnapTarget,
} from './stacks';
import { connectorLabels, nodeConnectors } from './block-connectors';

const board = (): Board => ({
  viewport: { x: 0, y: 0, zoom: 1 },
  nodes: [
    { id: 'image', kind: 'image', x: 100, y: 60 },
    { id: 'flatten', kind: 'flatten', x: 500, y: 220 },
    { id: 'dense', kind: 'dense', units: 10, x: 600, y: 400 },
    { id: 'softmax', kind: 'softmax', x: 500, y: 600 },
    { id: 'guess', kind: 'classifier', x: 700, y: 800 },
    { id: 'loose', kind: 'dense', units: 32, x: 800, y: 40 },
  ],
  edges: [
    { from: 'image', to: 'flatten' },
    { from: 'flatten', to: 'dense' },
    { from: 'dense', to: 'softmax' },
    { from: 'softmax', to: 'guess' },
  ],
});
const node = (b: Board, id: string) => b.nodes.find((n) => n.id === id)!;
const joined = (b: Board) =>
  b.edges.forEach((e) =>
    assert.deepEqual(portPosition(node(b, e.from), 'output'), portPosition(node(b, e.to), 'input')),
  );

test('saved connections become touching stacks without moving their roots or loose blocks', () => {
  const original = board(),
    stacked = layoutStacks(original);
  joined(stacked);
  assert.deepEqual(node(stacked, 'image'), node(original, 'image'));
  assert.deepEqual(node(stacked, 'loose'), node(original, 'loose'));
  assert.deepEqual(stacked.edges, original.edges);
  assert.deepEqual(layoutStacks(stacked), stacked);
  assert.equal(node(original, 'flatten').x, 500);
});

test('dragging a root carries its entire stack; pulling a middle block detaches only the upper joint', () => {
  const stacked = layoutStacks(board());
  const moved = moveStack(stacked, 'image', { x: 180, y: 100 });
  joined(moved);
  assert.equal(node(moved, 'guess').x, node(stacked, 'guess').x + 80);
  const pulled = moveStack(stacked, 'dense', { x: 450, y: 320 });
  joined(pulled);
  assert.equal(pulled.edges.length, 3);
  assert.deepEqual(node(pulled, 'image'), node(stacked, 'image'));
  assert.deepEqual(node(pulled, 'flatten'), node(stacked, 'flatten'));
  assert.equal(node(pulled, 'guess').x, 450);
});

test('attachment resolves flexible dimensions through the whole suffix and detachment restores formulas', () => {
  const loose = moveStack(layoutStacks(board()), 'flatten', { x: 480, y: 80 });
  assert.equal(inferShapes(loose).get('flatten')?.output, undefined);
  const labels = (b: Board) => {
    const shape = inferShapes(b).get('flatten');
    const connectors = nodeConnectors(node(b, 'flatten'), shape?.input, shape?.output);
    return [connectors.input, connectors.output].flatMap((c) =>
      connectorLabels(c, 330, 0).map((l) => l.text),
    );
  };
  assert.deepEqual(labels(loose), ['N×N', 'N·N']);
  const attached = attachStacks(loose, 'image', 'flatten');
  joined(attached);
  assert.deepEqual(labels(attached), ['28×28', '784']);
  assert.equal(inferShapes(attached).get('dense')?.input, 784);
  assert.deepEqual(labels(moveStack(attached, 'flatten', { x: 480, y: 80 })), ['N×N', 'N·N']);
});

test('either free end of a carried stack snaps at a consistent screen distance', () => {
  for (const zoom of [0.5, 1, 1.6]) {
    const original = layoutStacks(board());
    original.viewport.zoom = zoom;
    const detached = moveStack(original, 'flatten', { x: 800, y: 300 });
    const at = portPosition(node(detached, 'image'), 'output');
    const head = { ...node(detached, 'flatten'), x: at.x - 165 + 30 / zoom, y: at.y };
    const snap = stackSnapTarget(detached, head)!;
    assert.deepEqual([snap.from, snap.to], ['image', 'flatten']);
    joined(attachStacks(moveStack(detached, head.id, snap.position), snap.from, snap.to));

    const upper = moveStack(original, 'image', { x: 800, y: 300 });
    // Separate the output display, then bring the tail of the carried stack near its socket.
    const separated = moveStack(upper, 'guess', { x: 1100, y: 900 });
    const tail = portPosition(node(separated, 'softmax'), 'output');
    const target = portPosition(node(separated, 'guess'), 'input');
    const root = node(separated, 'image');
    const snapBelow = stackSnapTarget(separated, {
      ...root,
      x: root.x + target.x - tail.x,
      y: root.y + target.y - tail.y - 20 / zoom,
    })!;
    assert.deepEqual([snapBelow.from, snapBelow.to], ['softmax', 'guess']);
  }
});

test('expanded custom frames reflow the blocks below and undo restores the entire layout', () => {
  const original = board();
  original.nodes = original.nodes.map((n) =>
    n.id === 'dense'
      ? {
          ...n,
          kind: 'custom',
          blocks: [{ id: 'inner', kind: 'dense', units: 10 }],
          repeat: 3,
        }
      : n,
  );
  const before = layoutStacks(original);
  const history = new BoardHistory();
  history.record(before);
  const after = layoutStacks({
    ...before,
    nodes: before.nodes.map((n) => (n.id === 'dense' ? { ...n, expanded: true } : n)),
  });
  joined(after);
  assert.notEqual(nodeSize(node(before, 'dense')).height, nodeSize(node(after, 'dense')).height);
  assert.deepEqual(history.undo(after), before);
  assert.deepEqual(attachStacks(before, 'guess', 'image'), before);
});

test('repeated groups reserve space for every copy and put their output after the last one', () => {
  const group = {
    id: 'repeat',
    kind: 'custom' as const,
    x: 100,
    y: 50,
    repeat: 3,
    blocks: [
      { id: 'd', kind: 'dense' as const, units: 32 },
      { id: 'a', kind: 'activation' as const, activation: 'relu' as const },
    ],
  };
  assert.equal(nodeSize(group).height, customLayout(group).controlsTop + 44 + FRAME.foot);
  const expanded = { ...group, expanded: true };
  const layout = customLayout(expanded);
  const expected = layout.copiesTop + 2 * layout.copyHeight + FRAME.foot;
  assert.equal(nodeSize(expanded).height, expected);
  assert.equal(portPosition(expanded, 'output').y, 50 + expected);
  assert.equal(portPosition(expanded, 'input').x, portPosition(expanded, 'output').x);
  assert.equal(nodeSize(expanded).width, nodeSize(group).width);
});

test('inserting a carried recipe between blocks validates both joins and reflows the lower stack', () => {
  const original = layoutStacks(board());
  original.nodes.push({ id: 'activation', kind: 'activation', activation: 'tanh', x: 800, y: 182 });
  original.edges.push({ from: 'loose', to: 'activation' });
  // A 32-wide hidden layer fits before the existing 10-wide output layer.
  const at = portPosition(node(original, 'flatten'), 'output');
  const moved = { ...node(original, 'loose'), x: at.x - 165, y: at.y + 8 };
  const snapshot = structuredClone(original);
  const drop = stackDropTarget(original, moved)!;
  assert.equal(drop.error, null);
  assert.deepEqual(drop.split, { from: 'flatten', to: 'dense' });
  assert.equal(drop.pairs.length, 2);
  const result = applyStackDrop(original, moved, drop);
  assert.deepEqual(result.edges, [
    ...original.edges.filter((e) => !(e.from === 'flatten' && e.to === 'dense')),
    { from: 'flatten', to: 'loose' },
    { from: 'activation', to: 'dense' },
  ]);
  joined(result);
  assert.deepEqual(original, snapshot);
});

test('incompatible nearby studs remain available for red feedback and never snap', () => {
  const original = layoutStacks(board());
  original.nodes.push({ id: 'loose-softmax', kind: 'softmax', x: 800, y: 182 });
  original.edges.push({ from: 'loose', to: 'loose-softmax' });
  original.nodes = original.nodes.filter((n) => ['loose', 'loose-softmax', 'guess'].includes(n.id));
  original.edges = [{ from: 'loose', to: 'loose-softmax' }];
  const at = portPosition(node(original, 'guess'), 'input');
  const moved = {
    ...node(original, 'loose'),
    x: at.x - 165,
    y: at.y - BLOCKS.dense.height - BLOCKS.softmax.height - 8,
  };
  const drop = stackDropTarget(original, moved)!;
  assert.match(drop.error!, /10/);
  assert.ok(
    drop.pairs.some((pair) => pair.from === 'loose-softmax' && pair.to === 'guess' && pair.error),
  );
  assert.equal(stackSnapTarget(original, moved), null);
  assert.equal(applyStackDrop(original, moved, drop), original);
});

test('image and vector sockets reject each other even when their positions match', () => {
  const original = board();
  original.edges = [];
  const at = portPosition(node(original, 'image'), 'output');
  const moved = { ...node(original, 'loose'), x: at.x - 165, y: at.y + 5 };
  const drop = stackDropTarget(original, moved)!;
  assert.match(drop.pairs[0].error!, /Flatten/);
  assert.equal(stackSnapTarget(original, moved), null);
});
