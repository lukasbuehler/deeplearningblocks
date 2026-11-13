import { BlockNode, Board, Edge } from './graph';

/** The reference board: one pre-norm transformer block between embeddings and letter scores. */
export function transformerBoard(width = 48): Board {
  const n = (id: string, kind: BlockNode['kind'], extra: Partial<BlockNode> = {}): BlockNode => ({
    id,
    kind,
    x: 0,
    y: 0,
    ...extra,
  });
  const nodes = [
    n('text', 'text'),
    n('embed', 'embedding', { units: width }),
    n('pos', 'position'),
    n('norm1', 'layernorm'),
    n('attn', 'attention', { heads: 4 }),
    n('add1', 'add'),
    n('norm2', 'layernorm'),
    n('up', 'dense', { units: 2 * width }),
    n('relu', 'activation', { activation: 'relu' }),
    n('down', 'dense', { units: width }),
    n('add2', 'add'),
    n('norm3', 'layernorm'),
    n('scores', 'dense', { units: 65 }),
    n('softmax', 'softmax'),
    n('writer', 'writer'),
  ];
  const chain = nodes.slice(1).map((node, i): Edge => ({ from: nodes[i].id, to: node.id }));
  return {
    nodes,
    edges: [
      ...chain,
      { from: 'pos', to: 'add1', port: 'skip' },
      { from: 'add1', to: 'add2', port: 'skip' },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
    world: 'text',
  };
}
