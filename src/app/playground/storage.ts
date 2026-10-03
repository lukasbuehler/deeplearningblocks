import { MIN_ZOOM, MAX_ZOOM } from './geometry';
import { Experiment } from '../learning/curriculum';
import { readProgress } from '../learning/progress';
import { ACTIVATIONS } from '../learning/curriculum';
import { BLOCKS, BlockNode, Board, connectionError, freshBoard } from './graph';
export type Mode = 'journey' | 'sandbox';
export interface Workspace {
  board: Board;
  experiments: Experiment[];
}
export interface GameSave {
  version: 2;
  mode: Mode;
  era: number;
  checkedChapters?: number[];
  journey: Workspace;
  sandbox: Workspace;
}
export const SAVE_KEY = 'dlb-playground-v2';
export function freshGame(): GameSave {
  return {
    version: 2,
    mode: 'journey',
    era: 0,
    checkedChapters: [],
    journey: { board: freshBoard(), experiments: [] },
    sandbox: { board: freshBoard(), experiments: [] },
  };
}
function validBoard(value: unknown, era: number): value is Board {
  const b = value as Board;
  if (
    !b ||
    !Array.isArray(b.nodes) ||
    !Array.isArray(b.edges) ||
    b.nodes.length > 1000 ||
    b.edges.length > b.nodes.length
  )
    return false;
  if (
    !b.viewport ||
    ![b.viewport.x, b.viewport.y, b.viewport.zoom].every(Number.isFinite) ||
    b.viewport.zoom < MIN_ZOOM ||
    b.viewport.zoom > MAX_ZOOM
  )
    return false;
  if (
    !b.nodes.every(
      (n) =>
        n &&
        typeof n.id === 'string' &&
        n.id.length < 100 &&
        Object.hasOwn(BLOCKS, n.kind) &&
        [n.x, n.y].every((v) => Number.isFinite(v) && Math.abs(v) < 100000) &&
        (n.kind !== 'dense' || [16, 32, 64, 128].includes(n.units!)) &&
        (n.kind !== 'activation' ||
          ACTIVATIONS.some((a) => a.value === n.activation && a.era <= era)),
    )
  )
    return false;
  if (new Set(b.nodes.map((n) => n.id)).size !== b.nodes.length) return false;
  if (['image', 'classifier'].some((kind) => b.nodes.filter((n) => n.kind === kind).length > 1))
    return false;
  const checked: Board = { ...b, edges: [] };
  for (const e of b.edges) {
    if (
      !e ||
      typeof e.from !== 'string' ||
      typeof e.to !== 'string' ||
      connectionError(checked, e.from, e.to)
    )
      return false;
    checked.edges.push(e);
  }
  return true;
}
function validExperiments(value: unknown): Experiment[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (e) =>
        e &&
        Number.isFinite(e.accuracy) &&
        e.accuracy >= 0 &&
        e.accuracy <= 1 &&
        Number.isFinite(e.loss) &&
        typeof e.layers === 'string' &&
        e.layers.length <= 1000 &&
        Number.isInteger(e.era) &&
        e.era >= 0 &&
        e.era <= 2,
    )
    .slice(-8);
}
export function migrateLegacy(): GameSave {
  const legacy = readProgress(),
    save = freshGame();
  save.era = legacy.era;
  save.journey.experiments = legacy.experiments;
  if (!legacy.blocks.length && !legacy.experiments.length) return save;
  const nodes: BlockNode[] = [
    { id: 'image', kind: 'image', x: 160, y: 40 },
    { id: 'flatten', kind: 'flatten', x: 160, y: 290 },
  ];
  let y = 500;
  for (const block of legacy.blocks) {
    nodes.push({ id: `dense-${block.id}`, kind: 'dense', units: block.units, x: 160, y });
    y += 230;
    nodes.push({
      id: `activation-${block.id}`,
      kind: 'activation',
      activation: block.activation,
      x: 160,
      y,
    });
    y += 230;
  }
  nodes.push({ id: 'classifier', kind: 'classifier', x: 160, y });
  save.journey.board = {
    nodes,
    edges: nodes.slice(1).map((n, i) => ({ from: nodes[i].id, to: n.id })),
    viewport: { x: 0, y: 0, zoom: 0.65 },
  };
  return save;
}
export function loadGame(): GameSave {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return migrateLegacy();
    const save = JSON.parse(raw) as GameSave;
    if (
      save.version !== 2 ||
      !['journey', 'sandbox'].includes(save.mode) ||
      !Number.isInteger(save.era) ||
      save.era < 0 ||
      save.era > 2
    )
      return freshGame();
    if (!validBoard(save.journey?.board, save.era) || !validBoard(save.sandbox?.board, 2))
      return freshGame();
    return {
      ...save,
      checkedChapters: Array.isArray(save.checkedChapters)
        ? [...new Set(save.checkedChapters.filter((n) => Number.isInteger(n) && n >= 0 && n <= 2))]
        : [],
      journey: {
        board: save.journey.board,
        experiments: validExperiments(save.journey.experiments),
      },
      sandbox: {
        board: save.sandbox.board,
        experiments: validExperiments(save.sandbox.experiments),
      },
    };
  } catch {
    return freshGame();
  }
}
export function saveGame(save: GameSave): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}
