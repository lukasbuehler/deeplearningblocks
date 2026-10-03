import {
  Component,
  signal,
  ChangeDetectionStrategy,
  computed,
  effect,
  inject,
} from '@angular/core';
import { DecimalPipe, PercentPipe } from '@angular/common';
import { NetworkEditor } from './learning/network-editor/network-editor';
import { DenseBlock, ERAS, Experiment, nextEra } from './learning/curriculum';
import { DigitPreview } from './learning/digit-preview/digit-preview';
import { readProgress, saveProgress } from './learning/progress';
import { TrainingService } from './learning/training.service';

@Component({
  selector: 'app-root',
  imports: [DecimalPipe, PercentPipe, NetworkEditor, DigitPreview],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  readonly trainer = inject(TrainingService);
  private readonly saved = readProgress();
  readonly era = signal(this.saved.era);
  readonly viewedEra = signal(this.saved.era);
  readonly blocks = signal<DenseBlock[]>(this.saved.blocks);
  readonly experiments = signal<Experiment[]>(this.saved.experiments);
  readonly eras = ERAS;
  readonly chapter = computed(() => ERAS[this.viewedEra()]);
  readonly tips = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly storageWarning = signal(false);
  readonly resetRequested = signal(false);
  readonly sample = signal(0);
  readonly probabilities = signal<number[]>([]);
  readonly pixels = computed(() =>
    this.trainer.test()?.pixels.slice(this.sample() * 784, (this.sample() + 1) * 784),
  );
  readonly prediction = computed(() =>
    this.probabilities().length
      ? this.probabilities().indexOf(Math.max(...this.probabilities()))
      : null,
  );
  readonly latest = computed(() => this.experiments().at(-1));
  readonly lossPoints = computed(() => {
    const rows = this.trainer.epochs(),
      max = Math.max(1, ...rows.map((row) => row.loss));
    return rows.map((row, i) => `${10 + i * 65},${80 - (row.loss / max) * 65}`).join(' ');
  });
  constructor() {
    effect(() =>
      this.storageWarning.set(
        !saveProgress({ era: this.era(), blocks: this.blocks(), experiments: this.experiments() }),
      ),
    );
    void this.loadPreview();
  }
  async loadPreview(): Promise<void> {
    this.error.set('');
    try {
      await this.trainer.loadPreview();
    } catch {
      this.error.set('The example digits could not load. Check your connection, then retry.');
    }
  }
  change(blocks: DenseBlock[]): void {
    if (this.trainer.busy()) return;
    this.blocks.set(blocks);
    this.trainer.invalidate();
    this.trainer.epochs.set([]);
    this.trainer.status.set('Ready to train this network');
    this.probabilities.set([]);
    this.notice.set(
      this.experiments().length ? 'Network changed. Train again to test these blocks.' : '',
    );
  }
  resetLab(): void {
    if (this.trainer.busy()) return;
    this.trainer.invalidate();
    this.trainer.epochs.set([]);
    this.trainer.status.set('Ready when you are');
    this.blocks.set([]);
    this.experiments.set([]);
    this.era.set(0);
    this.viewedEra.set(0);
    this.sample.set(0);
    this.probabilities.set([]);
    this.notice.set('A fresh start. Add your first dense block.');
    this.error.set('');
    this.resetRequested.set(false);
  }
  nextSample(): void {
    const count = this.trainer.test()?.count ?? 1;
    this.sample.update((value) => (value + 1) % count);
    this.probabilities.set(this.trainer.predict(this.sample()));
  }
  async train(): Promise<void> {
    this.error.set('');
    this.notice.set('');
    this.probabilities.set([]);
    const blocks = this.blocks().map((block) => ({ ...block })),
      era = this.era();
    try {
      const result = await this.trainer.train(blocks);
      if (!result) return;
      this.experiments.update((rows) =>
        [
          ...rows,
          {
            ...result,
            era,
            layers:
              blocks.map((b) => `${b.units} ${b.activation}`).join(' → ') || 'Direct to output',
          },
        ].slice(-8),
      );
      const unlocked = nextEra(era, blocks);
      if (unlocked > era) {
        this.era.set(unlocked);
        this.viewedEra.set(unlocked);
        this.notice.set(
          `Unlocked ${ERAS[unlocked].year}: ${ERAS[unlocked].title}. ${unlocked === 1 ? 'Try sigmoid or tanh in your dense block.' : 'ReLU is now in your block library.'}`,
        );
      } else
        this.notice.set(
          era === 2
            ? 'Nice experiment. Change one thing and compare your next result.'
            : 'Try the chapter challenge to unlock the next milestone.',
        );
      this.probabilities.set(this.trainer.predict(this.sample()));
    } catch (error) {
      this.error.set(
        error instanceof Error ? error.message : 'Something went wrong. Try training again.',
      );
    }
  }
}
