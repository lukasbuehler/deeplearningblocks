import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { TILES, blockName } from './block-catalog';
import { BLOCK_WIDTH, type PortType } from './graph';
import {
  blockOutline,
  connectorTeeth,
  inferConnectorShapes,
  nodeConnectors,
  type Connector,
} from './block-connectors';

test('small vectors show their exact size, with space between every stud', () => {
  for (let size = 1; size <= 6; size++) {
    const teeth = connectorTeeth({ type: 'vector', size }, 236);
    assert.equal(teeth.length, size);
    teeth.slice(1).forEach((t, i) => assert.ok(t.x > teeth[i].x + teeth[i].width));
  }
});

test('Linear is absent from the picker while saved Linear blocks remain readable', () => {
  assert.ok(!TILES.some((tile) => tile.activation === 'linear'));
  assert.equal(
    blockName({ id: 'saved', kind: 'activation', activation: 'linear', x: 0, y: 0 }),
    'Linear',
  );
});

test('matching connectors retain their footprint on expanded custom frames', () => {
  for (const connector of [
    { type: 'image' },
    { type: 'vector', size: 784 },
    { type: 'vector', size: 4 },
    { type: 'probabilities', size: 10 },
  ] satisfies Connector[]) {
    const centered = (width: number) =>
      connectorTeeth(connector, width).map((t) => ({ ...t, x: t.x - width / 2 }));
    const ordinary = centered(BLOCK_WIDTH),
      expanded = centered(BLOCK_WIDTH + 44);
    ordinary.forEach((t, i) => {
      assert.ok(Math.abs(t.x - expanded[i].x) < 1e-9);
      assert.equal(t.width, expanded[i].width);
      assert.equal(t.label, expanded[i].label);
    });
  }
});

test('large vectors label their center stud and leave wide gaps', () => {
  const teeth = connectorTeeth({ type: 'vector', size: 784 }, 236);
  assert.equal(teeth.filter((t) => t.label).length, 1);
  assert.equal(teeth.find((t) => t.label)?.label, '784');
  teeth.slice(1).forEach((t, i) => assert.ok(t.x - teeth[i].x - teeth[i].width > 5));
});

test('numbers appear only when individual studs do not fit at the actual connector width', () => {
  for (const type of ['vector', 'probabilities'] as const) {
    const roomy = connectorTeeth({ type, size: 10 }, 330);
    assert.equal(roomy.length, 10);
    assert.ok(roomy.every((t) => !t.label));
    assert.ok(connectorTeeth({ type, size: 10 }, 180).some((t) => t.label === '10'));
    assert.ok(connectorTeeth({ type, size: 13 }, 330).some((t) => t.label === '13'));
    assert.equal(connectorTeeth({ type, size: 12 }, 330).length, 12);
  }
});

test('data kinds have distinct closed outlines without extra root lines', () => {
  const outlines = (['image', 'vector', 'probabilities'] satisfies PortType[]).map((type) =>
    blockOutline(236, 142, { type, size: 10 }, { type, size: 10 }),
  );
  assert.equal(new Set(outlines).size, 3);
  for (const path of outlines) {
    assert.equal((path.match(/M/g) ?? []).length, 1);
    assert.ok(path.endsWith('Z'));
    assert.ok(!path.includes('NaN'));
  }
});

test('formulas propagate through flexible blocks and override an attached Dense placeholder', () => {
  const board = {
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [
      { id: 'f', kind: 'flatten' as const, x: 0, y: 0 },
      { id: 'a', kind: 'activation' as const, activation: 'relu' as const, x: 0, y: 0 },
      { id: 'd', kind: 'dense' as const, inputs: 50, units: 32, x: 0, y: 0 },
    ],
    edges: [
      { from: 'f', to: 'a' },
      { from: 'a', to: 'd' },
    ],
  };
  const shapes = inferConnectorShapes(board);
  assert.equal(shapes.get('a')?.input?.label, 'N·N');
  assert.equal(shapes.get('a')?.output?.label, 'N·N');
  assert.equal(shapes.get('d')?.input?.label, 'N·N');
  assert.equal(shapes.get('d')?.input?.size, undefined);
  assert.equal(shapes.get('d')?.output?.size, 32);
});

test('Softmax has symbolic connectors when loose and preserves any attached width', () => {
  const softmax = { id: 's', kind: 'softmax' as const, x: 0, y: 0 };
  const loose = nodeConnectors(softmax);
  assert.equal(loose.input?.size, undefined);
  assert.equal(loose.output?.size, undefined);
  for (const width of [3, 10, 23, 128]) {
    const ports = nodeConnectors(softmax, width, width);
    assert.equal(ports.input?.size, width);
    assert.equal(ports.output?.size, width);
    assert.equal(ports.output?.type, 'probabilities');
  }
  const symbolic = nodeConnectors(
    softmax,
    undefined,
    undefined,
    { type: 'vector', label: 'N·N' },
    true,
  );
  assert.equal(symbolic.input?.label, 'N·N');
  assert.equal(symbolic.output?.label, 'N·N');
});
