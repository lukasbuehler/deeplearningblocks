import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { TrainingService } from '../learning/training.service';
import { ACTIVATIONS, ERAS } from '../learning/curriculum';
import {
  Board,
  BlockNode,
  compileBoard,
  describeNetwork,
  freshBoard,
  unlockAfter,
  hasHiddenActivation,
} from './graph';
import { BoardHistory } from './history';
import { GameSave, Mode, loadGame, saveGame } from './storage';

@Injectable({ providedIn: 'root' })
export class GameService {
  readonly trainer = inject(TrainingService);
  readonly save = signal<GameSave>(loadGame());
  readonly mode = computed(() => this.save().mode);
  readonly workspace = computed(() => this.save()[this.mode()]);
  readonly board = computed(() => this.workspace().board);
  readonly era = computed(() => (this.mode() === 'sandbox' ? 2 : this.save().era));
  readonly compilation = computed(() => compileBoard(this.board()));
  readonly activations = computed(() => ACTIVATIONS.filter((a) => a.era <= this.era()));
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
  private readonly histories = { journey: new BoardHistory(), sandbox: new BoardHistory() };
  readonly canUndo = computed(() => {
    this.historyVersion();
    return this.histories[this.mode()].canUndo;
  });
  readonly canRedo = computed(() => {
    this.historyVersion();
    return this.histories[this.mode()].canRedo;
  });
  constructor() {
    effect(() => this.storageWarning.set(!saveGame(this.save())));
    effect((onCleanup) => {
      if (!this.celebration()) return;
      const timer = setTimeout(() => this.celebration.set(''), 8000);
      onCleanup(() => clearTimeout(timer));
    });
    void this.loadPreview();
  }
  async loadPreview(): Promise<void> {
    this.error.set('');
    try {
      await this.trainer.loadPreview();
    } catch {
      this.error.set('The digits could not load. Check your connection and retry.');
    }
  }
  private apply(board: Board): void {
    const previous = this.compilation().network?.signature;
    this.save.update((save) => ({ ...save, [save.mode]: { ...save[save.mode], board } }));
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
    this.histories[this.mode()].record(before);
    this.historyVersion.update((v) => v + 1);
    this.apply(board);
    this.celebration.set('');
  }
  setViewport(viewport: Board['viewport']): void {
    this.save.update((save) => ({
      ...save,
      [save.mode]: { ...save[save.mode], board: { ...save[save.mode].board, viewport } },
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
    const board = this.histories[this.mode()].undo(this.board());
    if (board) this.apply(board);
    this.historyVersion.update((v) => v + 1);
  }
  redo(): void {
    if (this.trainer.busy()) return;
    const board = this.histories[this.mode()].redo(this.board());
    if (board) this.apply(board);
    this.historyVersion.update((v) => v + 1);
  }
  switchMode(mode: Mode): void {
    if (this.trainer.busy() || mode === this.mode()) return;
    this.trainer.invalidate();
    this.trainer.epochs.set([]);
    this.probabilities.set([]);
    this.selected.set(null);
    this.message.set('');
    this.celebration.set('');
    this.save.update((save) => ({ ...save, mode }));
    this.trainer.status.set('Ready when you are');
  }
  reset(): void {
    if (this.trainer.busy()) return;
    this.trainer.invalidate();
    this.trainer.epochs.set([]);
    this.probabilities.set([]);
    this.save.update((save) => ({
      ...save,
      ...(save.mode === 'journey' ? { era: 0, checkedChapters: [] } : {}),
      [save.mode]: { board: freshBoard(), experiments: [] },
    }));
    this.histories[this.mode()].clear();
    this.historyVersion.update((v) => v + 1);
    this.selected.set(null);
    this.celebration.set('');
    this.message.set('Fresh paper. A new little adventure.');
    this.trainer.status.set('Ready when you are');
  }
  useDrawing(pixels: Float32Array): void {
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
    const era = this.era(),
      dense = network.steps.filter((s) => s.kind === 'dense').length;
    const has = (name: string) => hasHiddenActivation(network, [name]);
    const complete =
      era === 0
        ? dense > 0
        : era === 1
          ? dense > 0 && (has('sigmoid') || has('tanh'))
          : dense >= 3 && has('relu');
    if (!complete) {
      this.message.set(
        era === 0
          ? 'Connect a Dense block in your path.'
          : era === 1
            ? 'Try Sigmoid or Tanh in your connected path.'
            : 'Try two hidden Dense layers and ReLU before Dense · 10 and Softmax.',
      );
      return;
    }
    this.save.update((save) => ({
      ...save,
      era: Math.min(2, era + 1),
      checkedChapters: [...new Set([...(save.checkedChapters ?? []), era])],
    }));
    this.celebration.set(
      era === 0
        ? 'First build discovered! Sigmoid & Tanh are in your toy box.'
        : era === 1
          ? 'Nonlinearity discovered! ReLU joins your toy box.'
          : 'A deeper network discovered! Try training and compare your guesses.',
    );
    this.message.set('Build checked. Training is an optional experiment.');
  }
  async train(): Promise<void> {
    const network = this.compilation().network;
    if (!network || this.trainer.busy()) {
      this.message.set(this.compilation().issues[0]?.message ?? '');
      return;
    }
    const mode = this.mode(),
      era = this.era();
    this.error.set('');
    this.message.set('');
    this.celebration.set('');
    this.probabilities.set([]);
    try {
      const result = await this.trainer.train(network);
      if (!result) return;
      const unlocked = mode === 'journey' ? unlockAfter(era, network) : this.save().era;
      this.save.update((save) => ({
        ...save,
        era: unlocked,
        [mode]: {
          ...save[mode],
          experiments: [
            ...save[mode].experiments,
            { ...result, era, layers: describeNetwork(network) },
          ].slice(-8),
        },
      }));
      if (mode === 'journey' && unlocked > era)
        this.celebration.set(
          `${ERAS[unlocked].year} unlocked! ${unlocked === 1 ? 'Meet Sigmoid & Tanh.' : 'ReLU joins your toy box.'}`,
        );
      else this.message.set('An experiment in the books! Change one thing and try again.');
      this.refreshPrediction();
    } catch (error) {
      this.error.set(
        error instanceof Error ? error.message : 'That experiment could not finish. Try again.',
      );
    }
  }
}
