import { Analytics } from '../analytics/analytics';
import type { LearningEventProperties } from '../analytics/analytics-policy';
import { DATASETS } from '../learning/datasets';
import { LEVELS, LevelId, meetsLevel } from './levels';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { TrainingService } from '../learning/training.service';
import { ACTIVATIONS } from '../learning/curriculum';
import { Board, BlockNode, compileBoard, describeNetwork, freshBoard } from './graph';
import { BoardHistory } from './history';
import { GameSave, Mode, Workspace, loadGame, saveGame } from './storage';

@Injectable({ providedIn: 'root' })
export class GameService {
  private readonly analytics = inject(Analytics);
  readonly trainer = inject(TrainingService);
  readonly save = signal<GameSave>(loadGame());
  readonly mode = computed(() => this.save().mode);
  readonly level = computed(() => LEVELS.find((l) => l.id === this.save().journey.activeLevel)!);
  readonly dataset = computed(
    () => DATASETS[this.mode() === 'sandbox' ? 'mnist' : this.level().dataset],
  );
  readonly workspaceKey = computed(() => (this.mode() === 'sandbox' ? 'sandbox' : this.level().id));
  readonly workspace = computed(() =>
    this.mode() === 'sandbox' ? this.save().sandbox : this.save().journey.levels[this.level().id],
  );
  readonly levelComplete = computed(
    () => this.mode() === 'journey' && this.save().journey.levels[this.level().id].completed,
  );
  readonly canCheck = computed(
    () =>
      this.mode() === 'journey' &&
      !this.levelComplete() &&
      !this.trainer.busy() &&
      meetsLevel(this.level().era, this.compilation().network),
  );
  readonly nextLevel = computed(() =>
    this.levelComplete() ? LEVELS[this.level().era + 1] : undefined,
  );
  readonly board = computed(() => this.workspace().board);
  readonly era = computed(() => (this.mode() === 'sandbox' ? 2 : this.level().era));
  readonly compilation = computed(() => compileBoard(this.board()));
  readonly unlockedEra = computed(() => (this.mode() === 'sandbox' ? 2 : this.save().era));
  readonly activations = computed(() => ACTIVATIONS.filter((a) => a.era <= this.unlockedEra()));
  readonly selected = signal<string | null>(null);
  readonly selectedNode = computed(() => this.board().nodes.find((n) => n.id === this.selected()));
  readonly message = signal('');
  readonly error = signal('');
  readonly celebration = signal('');
  readonly storageWarning = signal(false);
  readonly sample = signal(0);
  readonly probabilities = signal<number[]>([]);
  readonly drawingOpen = signal(false);
  readonly drawing = signal<Float32Array | null>(null);
  readonly pixels = computed(
    () =>
      this.drawing() ??
      this.trainer.test()?.pixels.slice(this.sample() * 784, (this.sample() + 1) * 784),
  );
  readonly historyVersion = signal(0);
  private readonly histories = new Map<string, BoardHistory>();
  private get history(): BoardHistory {
    const key = this.workspaceKey();
    if (!this.histories.has(key)) this.histories.set(key, new BoardHistory());
    return this.histories.get(key)!;
  }
  private updateWorkspace(update: (workspace: Workspace) => Workspace): void {
    this.save.update((save) =>
      save.mode === 'sandbox'
        ? { ...save, sandbox: update(save.sandbox) }
        : {
            ...save,
            journey: {
              ...save.journey,
              levels: {
                ...save.journey.levels,
                [save.journey.activeLevel]: {
                  ...save.journey.levels[save.journey.activeLevel],
                  ...update(save.journey.levels[save.journey.activeLevel]),
                },
              },
            },
          },
    );
  }
  readonly canUndo = computed(() => {
    this.historyVersion();
    return this.history.canUndo;
  });
  readonly canRedo = computed(() => {
    this.historyVersion();
    return this.history.canRedo;
  });
  constructor() {
    effect(() => this.storageWarning.set(!saveGame(this.save())));
    effect((onCleanup) => {
      if (!this.celebration()) return;
      const timer = setTimeout(() => this.celebration.set(''), 8000);
      onCleanup(() => clearTimeout(timer));
    });
    this.analytics.track('workspace_opened', this.analyticsContext());
    void this.loadPreview();
  }
  analyticsContext(): LearningEventProperties {
    return { mode: this.mode(), level_id: this.workspaceKey(), dataset_id: this.dataset().id };
  }
  async loadPreview(): Promise<void> {
    const dataset = this.dataset();
    this.error.set('');
    try {
      await this.trainer.loadPreview(dataset.id);
    } catch {
      if (this.dataset().id === dataset.id)
        this.error.set(`${dataset.name} could not load. Check your connection and retry.`);
    }
  }
  private apply(board: Board): void {
    const previous = this.compilation().network?.signature;
    this.updateWorkspace((workspace) => ({ ...workspace, board }));
    if (previous !== this.compilation().network?.signature) {
      this.trainer.invalidate();
      this.trainer.epochs.set([]);
      this.probabilities.set([]);
      this.trainer.status.set('Ready for a new experiment');
    }
    if (this.selected() && !board.nodes.some((n) => n.id === this.selected()))
      this.selected.set(null);
  }
  edit(board: Board): void {
    const before = this.board();
    // Layout edits remain available during training. Computational edits do not.
    const structure = (b: Board) =>
      JSON.stringify({ nodes: b.nodes.map(({ x, y, ...n }) => n), edges: b.edges });
    if (this.trainer.busy() && structure(before) !== structure(board)) return;
    if (JSON.stringify(before) === JSON.stringify(board)) return;
    this.history.record(before);
    this.historyVersion.update((v) => v + 1);
    this.apply(board);
    this.celebration.set('');
  }
  setViewport(viewport: Board['viewport']): void {
    this.updateWorkspace((workspace) => ({
      ...workspace,
      board: { ...workspace.board, viewport },
    }));
  }

  configure(change: Partial<BlockNode> & { id: string }): void {
    if (this.trainer.busy()) return;
    this.edit({
      ...this.board(),
      nodes: this.board().nodes.map((n) => (n.id === change.id ? { ...n, ...change } : n)),
    });
  }
  undo(): void {
    if (this.trainer.busy()) return;
    const board = this.history.undo(this.board());
    if (board) this.apply(board);
    this.historyVersion.update((v) => v + 1);
  }
  redo(): void {
    if (this.trainer.busy()) return;
    const board = this.history.redo(this.board());
    if (board) this.apply(board);
    this.historyVersion.update((v) => v + 1);
  }
  private clearRuntime(): void {
    this.trainer.invalidate();
    this.trainer.epochs.set([]);
    this.probabilities.set([]);
    this.drawing.set(null);
    this.sample.set(0);
    this.drawingOpen.set(false);
    this.selected.set(null);
    this.message.set('');
    this.celebration.set('');
    this.trainer.status.set('Ready when you are');
  }
  switchMode(mode: Mode): void {
    if (this.trainer.busy() || mode === this.mode()) return;
    this.clearRuntime();
    this.save.update((save) => ({ ...save, mode }));
    this.analytics.track('workspace_opened', this.analyticsContext());
    void this.loadPreview();
  }
  switchLevel(id: LevelId): void {
    const level = LEVELS.find((l) => l.id === id);
    if (
      this.trainer.busy() ||
      !level ||
      level.era > this.save().era ||
      (this.mode() === 'journey' && id === this.level().id)
    )
      return;
    this.clearRuntime();
    this.save.update((save) => ({
      ...save,
      mode: 'journey',
      journey: { ...save.journey, activeLevel: id },
    }));
    this.analytics.track('workspace_opened', this.analyticsContext());
    void this.loadPreview();
  }
  reset(): void {
    if (this.trainer.busy()) return;
    this.clearRuntime();
    // Fresh paper is local to this workspace. Earned discoveries remain earned.
    this.updateWorkspace(() => ({ board: freshBoard(), experiments: [] }));
    this.history.clear();
    this.historyVersion.update((v) => v + 1);
    this.message.set('Fresh paper. Your other levels and discoveries are safe.');
  }
  useDrawing(pixels: Float32Array): void {
    if (!this.dataset().drawable || this.trainer.busy()) return;
    this.drawing.set(pixels);
    this.refreshPrediction();
    this.message.set(
      this.trainer.trained()
        ? 'Your drawing, your network’s guess. Try another!'
        : 'Your drawing is ready. Train the network to see its guess.',
    );
  }
  private refreshPrediction(): void {
    this.probabilities.set(
      this.drawing()
        ? this.trainer.predictPixels(this.drawing()!)
        : this.trainer.predict(this.sample()),
    );
  }
  nextSample(): void {
    this.drawing.set(null);
    this.sample.update((i) => (i + 1) % (this.trainer.test()?.count ?? 1));
    this.refreshPrediction();
  }
  checkBuild(): void {
    if (this.trainer.busy()) return;
    const network = this.compilation().network;
    if (!network) {
      this.message.set(this.compilation().issues[0]?.message ?? 'Connect your blocks first.');
      return;
    }
    if (this.mode() === 'sandbox') {
      this.message.set('Your Sandbox path works! Journey discoveries stay in Journey.');
      return;
    }
    const era = this.level().era;
    if (this.levelComplete()) return;
    if (!meetsLevel(era, network)) {
      this.message.set(this.level().challenge);
      return;
    }
    this.save.update((save) => ({
      ...save,
      era: Math.max(save.era, Math.min(2, era + 1)),
      journey: {
        ...save.journey,
        levels: {
          ...save.journey.levels,
          [this.level().id]: { ...save.journey.levels[this.level().id], completed: true },
        },
      },
    }));
    this.celebration.set(
      era === 0
        ? 'First build discovered! Sigmoid & Tanh are in your toy box.'
        : era === 1
          ? 'Nonlinearity discovered! ReLU joins your toy box.'
          : 'A deeper network discovered! Try training and compare your guesses.',
    );
    this.analytics.track('level_completed', this.analyticsContext());
    this.message.set('Build checked. Training is an optional experiment.');
  }
  async train(): Promise<void> {
    const network = this.compilation().network;
    if (!network || this.trainer.busy()) {
      this.message.set(this.compilation().issues[0]?.message ?? '');
      return;
    }
    const era = this.era();
    const started = performance.now();
    const context = {
      ...this.analyticsContext(),
      parameter_count: network.parameters,
      dense_layers: network.steps.filter((step) => step.kind === 'dense').length,
    };
    this.analytics.track('training_started', context);
    this.error.set('');
    this.message.set('');
    this.celebration.set('');
    this.probabilities.set([]);
    try {
      const result = await this.trainer.train(network, this.dataset().id);
      if (!result) {
        this.analytics.track('training_cancelled', {
          ...context,
          duration_ms: Math.round(performance.now() - started),
        });
        return;
      }
      this.analytics.track('training_completed', {
        ...context,
        accuracy: result.accuracy,
        duration_ms: Math.round(performance.now() - started),
      });
      this.updateWorkspace((workspace) => ({
        ...workspace,
        experiments: [
          ...workspace.experiments,
          { ...result, era, dataset: this.dataset().id, layers: describeNetwork(network) },
        ].slice(-8),
      }));
      this.message.set('An experiment in the books! Change one thing and try again.');
      this.refreshPrediction();
    } catch (error) {
      this.analytics.track('training_failed', context);
      this.error.set(
        error instanceof Error ? error.message : 'That experiment could not finish. Try again.',
      );
    }
  }
}
