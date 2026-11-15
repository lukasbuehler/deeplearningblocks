import { LEVEL_IDS, LevelId } from './levels';
import { splitLegacyOutput } from './board-migration';
import { MIN_ZOOM, MAX_ZOOM } from './geometry';
import { Experiment } from '../learning/curriculum';
import { readProgress } from '../learning/progress';
import { ACTIVATIONS } from '../learning/curriculum';
import {
  BLOCKS,
  BlockNode,
  Board,
  MAX_NAME_LENGTH,
  connectionError,
  customBlockIssue,
  freshBoard,
  validDenseInputs,
  validDenseUnits,
} from './graph';
export type Mode = 'journey' | 'sandbox';
export interface Workspace {
  board: Board;
  experiments: Experiment[];
}
export interface LevelWorkspace extends Workspace {
  completed: boolean;
}
export interface GameSave {
  version: 4;
  mode: Mode;
  /** Highest unlocked block era, independent of the selected level. */
  era: number;
  journey: { activeLevel: LevelId; levels: Record<LevelId, LevelWorkspace> };
  sandbox: Workspace;
}
export const PREVIOUS_SAVE_KEY = 'dlb-playground-v3';
export const SAVE_KEY = 'dlb-playground-v4';
export function freshGame(): GameSave {
  return {
    version: 4,
    mode: 'journey',
    era: 0,
    journey: {
      activeLevel: LEVEL_IDS[0],
      levels: Object.fromEntries<LevelWorkspace>(
        LEVEL_IDS.map((id) => [
          id,
          {
            board: freshBoard(),
            experiments: [],
            completed: false,
          },
        ]),
      ) as Record<LevelId, LevelWorkspace>,
    },
    sandbox: { board: freshBoard(), experiments: [] },
  };
}
const unlocked = (activation: unknown, era: number) =>
  ACTIVATIONS.some((a) => a.value === activation && a.era <= era);
function validCustom(n: BlockNode, era: number): boolean {
  return (
    (n.name === undefined || (typeof n.name === 'string' && n.name.length <= MAX_NAME_LENGTH)) &&
    (n.expanded === undefined || typeof n.expanded === 'boolean') &&
    Array.isArray(n.blocks) &&
    n.blocks.every(
      (b) =>
        b &&
        typeof b.id === 'string' &&
        b.id.length < 100 &&
        (b.kind !== 'activation' || unlocked(b.activation, era)),
    ) &&
    customBlockIssue(n, true) === null
  );
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
        (n.kind !== 'dense' ||
          (validDenseUnits(n.units) && (n.inputs === undefined || validDenseInputs(n.inputs)))) &&
        (n.kind !== 'activation' || unlocked(n.activation, era)) &&
        (n.kind !== 'custom' || validCustom(n, era)),
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
  save.journey.activeLevel = LEVEL_IDS[legacy.era];
  const workspace = save.journey.levels[save.journey.activeLevel];
  for (const [i, id] of LEVEL_IDS.entries()) {
    save.journey.levels[id].completed = i < legacy.era;
    save.journey.levels[id].experiments = legacy.experiments.filter((e) => e.era === i);
  }
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
  workspace.board = {
    nodes,
    edges: nodes.slice(1).map((n, i) => ({ from: nodes[i].id, to: n.id })),
    viewport: { x: 0, y: 0, zoom: 0.65 },
  };
  workspace.board = splitLegacyOutput(workspace.board);
  return save;
}
/** Read older formats without overwriting their recovery keys. */
export function loadGame(): GameSave {
  try {
    const raw =
      localStorage.getItem(SAVE_KEY) ??
      localStorage.getItem(PREVIOUS_SAVE_KEY) ??
      localStorage.getItem('dlb-playground-v2');
    if (!raw) return migrateLegacy();
    let save = JSON.parse(raw);
    if (
      !save ||
      !['journey', 'sandbox'].includes(save.mode) ||
      !Number.isInteger(save.era) ||
      save.era < 0 ||
      save.era > 2
    )
      return freshGame();
    if (save.version === 2 || save.version === 3) {
      if (save.version === 2) {
        save.journey.board = splitLegacyOutput(save.journey.board);
        save.sandbox.board = splitLegacyOutput(save.sandbox.board);
      }
      if (!validBoard(save.journey?.board, save.era) || !validBoard(save.sandbox?.board, 2))
        return freshGame();
      const migrated = freshGame();
      migrated.mode = save.mode;
      migrated.era = save.era;
      migrated.journey.activeLevel = LEVEL_IDS[save.era];
      migrated.journey.levels[migrated.journey.activeLevel].board = save.journey.board;
      const experiments = validExperiments(save.journey.experiments);
      LEVEL_IDS.forEach((id, i) => {
        migrated.journey.levels[id].completed =
          i < save.era || save.checkedChapters?.includes(i) === true;
        migrated.journey.levels[id].experiments = experiments.filter((e) => e.era === i);
      });
      migrated.sandbox = {
        board: save.sandbox.board,
        experiments: validExperiments(save.sandbox.experiments),
      };
      save = migrated;
    }
    if (
      save.version !== 4 ||
      !LEVEL_IDS.includes(save.journey?.activeLevel) ||
      LEVEL_IDS.indexOf(save.journey.activeLevel) > save.era ||
      !validBoard(save.sandbox?.board, 2)
    )
      return freshGame();
    const result = freshGame();
    result.mode = save.mode;
    result.era = save.era;
    result.journey.activeLevel = save.journey.activeLevel;
    for (const id of LEVEL_IDS) {
      const level = save.journey.levels?.[id];
      // One damaged level must not erase other boards or earned discoveries.
      result.journey.levels[id] = {
        board: validBoard(level?.board, save.era) ? level.board : freshBoard(),
        experiments: validExperiments(level?.experiments),
        completed: level?.completed === true,
      };
    }
    result.sandbox = {
      board: save.sandbox.board,
      experiments: validExperiments(save.sandbox.experiments),
    };
    return result;
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
