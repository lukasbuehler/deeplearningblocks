import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { activationHint } from './activation-hints';
import { blockyHint, stackedDense } from './blocky-hints';
import { BlockNode, Board, compileBoard } from './graph';

function chain(parts: Partial<BlockNode>[]): Board {
  const nodes = parts.map((n, i) => ({ x: 0, y: 0, id: String(i), ...n }) as BlockNode);
  return {
    nodes,
    edges: nodes.slice(1).map((n, i) => ({ from: nodes[i].id, to: n.id })),
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}
const scores = { kind: 'dense', units: 10 } as const;
const relu = { kind: 'activation', activation: 'relu' } as const;
const softmax = { kind: 'softmax' } as const;
const hint = (b: Board) =>
  activationHint(
    b,
    b.nodes.map((n) => n.id),
  );

test('hidden activations are useful and do not trigger output advice', () => {
  assert.equal(hint(chain([{ kind: 'dense', units: 32 }, relu, scores, softmax])), null);
});

test('the final Dense may be inside a custom recipe while its output activation is outside', () => {
  const b = chain([{ kind: 'custom', blocks: [{ id: 'scores', ...scores }] }, relu, softmax]);
  assert.equal(hint(b)?.id, 'output-activation');
  assert.deepEqual(hint(b)?.target, { kind: 'node', id: '1' });
});

test('output advice targets the custom block when it contains the extra activation', () => {
  const b = chain([
    {
      kind: 'custom',
      blocks: [
        { id: 'scores', ...scores },
        { id: 'act', ...relu },
      ],
    },
    softmax,
  ]);
  assert.deepEqual(hint(b)?.target, { kind: 'node', id: '0' });
});

test('consecutive activations are found across custom and repeated-copy boundaries', () => {
  for (const b of [
    chain([relu, { kind: 'custom', blocks: [{ id: 'a', ...relu }] }, scores, softmax]),
    chain([{ kind: 'custom', repeat: 2, blocks: [{ id: 'a', ...relu }] }, scores, softmax]),
  ]) {
    assert.equal(hint(b)?.id, 'consecutive-activations');
    assert.equal(hint(b)?.target?.kind, 'node');
  }
});

test('Dense advice follows the last Dense inside a custom block across its boundary', () => {
  const b = chain([
    {
      kind: 'custom',
      blocks: [
        { id: 'd', kind: 'dense', units: 32 },
        { id: 'r', ...relu },
        { id: 'd2', kind: 'dense', units: 32 },
      ],
    },
    scores,
    softmax,
  ]);
  assert.deepEqual(
    stackedDense(
      b,
      b.nodes.map((n) => n.id),
    ),
    { kind: 'edge', from: '0', to: '1' },
  );
});

test('Blocky gives output advice for a valid build and ignores loose activations', () => {
  const b = chain([
    { kind: 'image' },
    { kind: 'flatten' },
    scores,
    relu,
    softmax,
    { kind: 'classifier' },
  ]);
  assert.ok(compileBoard(b).network);
  assert.equal(blockyHint(b, 2, 'sandbox')?.id, 'output-activation');
  b.nodes.push({ id: 'loose', ...relu, x: 0, y: 0 });
  b.edges = [
    { from: '0', to: '1' },
    { from: '1', to: '2' },
    { from: '2', to: '4' },
    { from: '4', to: '5' },
  ];
  assert.notEqual(blockyHint(b, 2, 'sandbox')?.id, 'consecutive-activations');
  assert.notEqual(blockyHint(b, 2, 'sandbox')?.id, 'output-activation');
});
