import { Activation } from '../learning/curriculum';
import {
  BLOCKS,
  BlockNode,
  Board,
  FRAME,
  INNER_KINDS,
  InnerBlock,
  MAX_INNER_BLOCKS,
  expandCustom,
} from './graph';

/**
 * Order the picked blocks along their wires. They must form one unbroken chain of blocks a
 * custom block can hold; anything else returns a message for the player instead.
 */
export function pickedChain(board: Board, ids: string[]): string[] | string {
  const picked = new Set(ids);
  const nodes = board.nodes.filter((n) => picked.has(n.id));
  if (!nodes.length) return 'Pick a Dense or activation block first.';
  if (nodes.some((n) => n.kind === 'custom'))
    return 'Custom blocks cannot go inside custom blocks yet. Take it apart first.';
  if (nodes.some((n) => !INNER_KINDS.includes(n.kind)))
    return 'Custom blocks hold Dense and activation blocks for now.';
  // Text outputs can feed several sockets: follow only the wire that stays inside the picks.
  const next = new Map(
    board.edges.filter((e) => picked.has(e.from) && picked.has(e.to)).map((e) => [e.from, e.to]),
  );
  const hasPickedParent = new Set(
    board.edges.filter((e) => picked.has(e.from) && picked.has(e.to)).map((e) => e.to),
  );
  const starts = nodes.filter((n) => !hasPickedParent.has(n.id));
  if (starts.length !== 1) return 'Pick blocks attached together in one stack.';
  const chain = [starts[0].id];
  for (let id = next.get(chain[0]); id && picked.has(id); id = next.get(id)) chain.push(id);
  if (chain.length !== picked.size) return 'Pick blocks attached together in one stack.';
  if (board.edges.some((e) => chain.slice(0, -1).includes(e.from) && !picked.has(e.to)))
    return 'A wire branches off in the middle of these blocks. Pick blocks without a branch inside.';
  if (chain.length > MAX_INNER_BLOCKS)
    return `A custom block holds up to ${MAX_INNER_BLOCKS} blocks.`;
  return chain;
}

/** The picked block's downstream neighbour, when it could join the same custom block. */
export function nextPickable(board: Board, ids: string[]): string | null {
  const chain = pickedChain(board, ids);
  if (typeof chain === 'string') return null;
  const out = board.edges.filter((e) => e.from === chain.at(-1));
  const after = out.length === 1 ? out[0].to : undefined;
  const node = board.nodes.find((n) => n.id === after);
  return node && INNER_KINDS.includes(node.kind) && chain.length < MAX_INNER_BLOCKS
    ? node.id
    : null;
}

const toInner = (node: BlockNode): InnerBlock =>
  node.kind === 'dense'
    ? { id: node.id, kind: 'dense', units: node.units }
    : { id: node.id, kind: 'activation', activation: node.activation };

/** Replace a picked chain with one custom block wired in its place. */
export function makeCustomBlock(
  board: Board,
  ids: string[],
  id: string,
  name?: string,
): Board | string {
  const chain = pickedChain(board, ids);
  if (typeof chain === 'string') return chain;
  if (chain.length < 2) return 'Pick at least two blocks to make a custom block.';
  const nodes = new Map(board.nodes.map((n) => [n.id, n]));
  const first = nodes.get(chain[0])!;
  const inside = new Set(chain);
  const custom: BlockNode = {
    id,
    kind: 'custom',
    ...(name ? { name } : {}),
    repeat: 1,
    blocks: chain.map((c) => toInner(nodes.get(c)!)),
    x: first.x,
    y: first.y,
  };
  return {
    ...board,
    nodes: [...board.nodes.filter((n) => !inside.has(n.id)), custom],
    edges: board.edges
      .filter((e) => !(inside.has(e.from) && inside.has(e.to)))
      .map((e) => ({
        ...e,
        from: inside.has(e.from) ? id : e.from,
        to: inside.has(e.to) ? id : e.to,
      })),
  };
}

/**
 * Turn a custom block back into ordinary blocks, one per inner block and copy, stacked where it
 * stood and wired in order. The computation is unchanged.
 */
export function takeApart(board: Board, id: string, newId: () => string): Board {
  const custom = board.nodes.find((n) => n.id === id);
  if (!custom || custom.kind !== 'custom') return board;
  const used = new Set(board.nodes.map((n) => n.id));
  // An expanded block already shows its parts: leave the first copy exactly where it is drawn.
  const x = custom.x + FRAME.pad;
  const gap = FRAME.gap;
  let y = custom.y + FRAME.head;
  const parts: BlockNode[] = expandCustom(custom).map((inner) => {
    // Keep inner ids for the first copy so a make/take-apart round trip restores identity.
    const partId = used.has(inner.id) ? newId() : inner.id;
    used.add(partId);
    const node: BlockNode = { ...inner, id: partId, x, y };
    y += BLOCKS[inner.kind].height + gap;
    return node;
  });
  const chainEdges = parts.slice(1).map((p, i) => ({ from: parts[i].id, to: p.id }));
  return {
    ...board,
    nodes: [...board.nodes.filter((n) => n.id !== id), ...parts],
    edges: [
      ...board.edges.map((e) => ({
        ...e,
        from: e.from === id ? parts.at(-1)!.id : e.from,
        to: e.to === id ? parts[0].id : e.to,
      })),
      ...chainEdges,
    ],
  };
}

/** The toy-box custom block: one hidden layer and the strongest activation unlocked so far. */
export function starterRecipe(activation: Activation, newId: () => string): InnerBlock[] {
  return [
    { id: newId(), kind: 'dense', units: 32 },
    { id: newId(), kind: 'activation', activation },
  ];
}

/** Move a loose chain into the shared recipe, preserving order and block configuration. */
export function insertIntoRecipe(
  board: Board,
  parentId: string,
  ids: string[],
  index: number,
): Board | string {
  const parent = board.nodes.find((n) => n.id === parentId);
  const moving = ids.map((id) => board.nodes.find((n) => n.id === id));
  if (
    !parent ||
    parent.kind !== 'custom' ||
    moving.some((n) => !n || !INNER_KINDS.includes(n.kind))
  )
    return 'Only Dense and activation blocks go inside a custom block.';
  const blocks = [...(parent.blocks ?? [])];
  if (blocks.length + moving.length > MAX_INNER_BLOCKS)
    return `A recipe holds up to ${MAX_INNER_BLOCKS} blocks.`;
  blocks.splice(index, 0, ...moving.map((n) => toInner(n!)));
  const removed = new Set(ids);
  return {
    ...board,
    nodes: board.nodes
      .filter((n) => !removed.has(n.id))
      .map((n) => (n.id === parentId ? { ...n, blocks } : n)),
    edges: board.edges.filter((e) => !removed.has(e.from) && !removed.has(e.to)),
  };
}

/** Editing the setup changes every repetition; extracted pieces become ordinary loose blocks. */
export function extractFromRecipe(
  board: Board,
  parentId: string,
  innerId: string,
  position: { x: number; y: number },
  newId: () => string,
): Board {
  const parent = board.nodes.find((n) => n.id === parentId);
  const inner = parent?.blocks?.find((n) => n.id === innerId);
  if (!parent || !inner) return board;
  const id = board.nodes.some((n) => n.id === inner.id) ? newId() : inner.id;
  return {
    ...board,
    nodes: [
      ...board.nodes.map((n) =>
        n.id === parentId ? { ...n, blocks: n.blocks!.filter((b) => b.id !== innerId) } : n,
      ),
      { ...inner, id, ...position },
    ],
  };
}
