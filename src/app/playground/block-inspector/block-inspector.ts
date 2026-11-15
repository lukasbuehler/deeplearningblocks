import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { DecimalPipe } from '@angular/common';
import { GameService } from '../game.service';
import { BLOCKS, BlockNode } from '../graph';
import { blockName } from '../block-catalog';
import {
  InspectionTarget,
  OperationSnapshot,
  activationValue,
  inspectionStep,
} from '../../learning/model-inspection';

@Component({
  selector: 'app-block-inspector',
  imports: [CdkTrapFocus, DecimalPipe],
  templateUrl: './block-inspector.html',
  styleUrl: './block-inspector.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockInspector {
  readonly target = input.required<InspectionTarget>();
  readonly close = output<void>();
  readonly game = inject(GameService);
  readonly snapshot = signal<OperationSnapshot | null>(null);
  readonly error = signal('');
  readonly loading = signal(false);
  readonly neuron = signal(0);
  readonly example = signal(1);
  readonly page = signal(0);
  readonly node = computed(() => {
    const target = this.target();
    const owner = this.game.board().nodes.find((n) => n.id === target.id);
    const inner = target.innerId && owner?.blocks?.find((n) => n.id === target.innerId);
    return inner ? ({ ...inner, x: 0, y: 0 } as BlockNode) : owner;
  });
  readonly title = computed(() =>
    this.node() ? blockName(this.node()!, this.game.dataset()) : 'Block inspector',
  );
  readonly help = computed(() =>
    this.node() ? BLOCKS[this.node()!.kind].help : 'This block is no longer on the board.',
  );
  readonly phase = computed(() =>
    this.game.trainer.hasUpdates()
      ? this.game.trainer.busy()
        ? 'Learning weights'
        : this.game.trainer.trained()
          ? 'Learned weights'
          : 'Weights when stopped'
      : 'Initialized weights',
  );
  readonly modelPhase = computed(() =>
    this.node()?.kind === 'dense'
      ? this.phase()
      : this.phase()
          .replace('weights', 'model')
          .replace('Weights when stopped', 'Model when stopped'),
  );
  readonly selected = computed(() =>
    Math.max(0, Math.min(this.neuron(), (this.snapshot()?.outputs.length ?? 1) - 1)),
  );
  readonly bias = computed(() => this.snapshot()?.biases?.[this.selected()] ?? 0);
  readonly connections = computed(() => {
    const s = this.snapshot();
    if (!s?.weights) return [];
    const j = this.selected(),
      width = s.outputs.length;
    return s.inputs.map((x, i) => ({
      index: i,
      input: x,
      weight: s.weights![i * width + j],
      product: x * s.weights![i * width + j],
    }));
  });
  readonly heatmap = computed(() => {
    const values = this.connections();
    const max = Math.max(1e-9, ...values.map((v) => Math.abs(v.weight)));
    return values.map((v) => ({
      ...v,
      color: `hsl(${v.weight < 0 ? 12 : 217} 80% ${96 - (51 * Math.abs(v.weight)) / max}%)`,
    }));
  });
  readonly weightScale = computed(() =>
    Math.max(0, ...this.connections().map((v) => Math.abs(v.weight))),
  );
  readonly columns = computed(() =>
    this.connections().length === 784 ? 28 : Math.ceil(Math.sqrt(this.connections().length)),
  );
  readonly min = Math.min;
  readonly connectionRows = computed(() =>
    this.connections().slice(this.page() * 16, this.page() * 16 + 16),
  );
  readonly numberRows = computed(
    () =>
      this.snapshot()
        ?.inputs.slice(this.page() * 16, this.page() * 16 + 16)
        .map((x, i) => ({
          index: this.page() * 16 + i,
          input: x,
          output: this.snapshot()!.outputs[this.page() * 16 + i],
        })) ?? [],
  );
  readonly outputTotal = computed(() => this.snapshot()?.outputs.reduce((a, b) => a + b, 0) ?? 0);
  readonly rowCount = computed(() => this.snapshot()?.inputs.length ?? 0);
  readonly sum = computed(() => this.connections().reduce((sum, v) => sum + v.product, 0));
  readonly activation = computed(() => this.node()?.activation ?? 'linear');
  readonly evaluate = (x: number) => activationValue(this.activation(), x);
  readonly formula = computed(
    () =>
      ({
        relu: 'f(x) = max(0, x)',
        sigmoid: 'f(x) = 1 / (1 + e⁻ˣ)',
        tanh: 'f(x) = (eˣ − e⁻ˣ) / (eˣ + e⁻ˣ)',
        linear: 'f(x) = x',
      })[this.activation()],
  );
  readonly curve = computed(() =>
    Array.from({ length: 161 }, (_, i) => {
      const x = -4 + i / 20;
      return `${i ? 'L' : 'M'}${this.graphX(x)},${this.graphY(this.evaluate(x))}`;
    }).join(' '),
  );
  readonly graphX = (x: number) => 30 + (x + 4) * 40;
  readonly graphY = (y: number) =>
    this.activation() === 'sigmoid'
      ? 300 - y * 240
      : this.activation() === 'tanh'
        ? 180 - y * 120
        : 180 - y * 35;
  readonly yTicks = computed(() =>
    this.activation() === 'sigmoid'
      ? [0, 0.5, 1]
      : this.activation() === 'tanh'
        ? [-1, 0, 1]
        : [-4, -2, 0, 2, 4],
  );
  readonly dot = computed(() => ({
    x: this.graphX(this.example()),
    y: this.graphY(this.evaluate(this.example())),
  }));
  setNumber(event: Event, target: 'neuron' | 'example'): void {
    const value = (event.target as HTMLInputElement).valueAsNumber;
    if (Number.isFinite(value)) {
      this[target].set(target === 'neuron' ? Math.max(0, Math.floor(value) - 1) : value);
      this.page.set(0);
    }
  }
  private snapshotKey = '';
  constructor() {
    effect((onCleanup) => {
      const target = this.target(),
        network = this.game.compilation().network;
      const dataset = this.game.dataset().id,
        pixels = this.game.pixels();
      const letters = this.game.snippet()?.letters ?? this.game.prompt();
      this.game.trainer.modelRevision();
      let current = true;
      onCleanup(() => {
        current = false;
      });
      const key = JSON.stringify([target, network?.signature, dataset]);
      if (key !== this.snapshotKey) {
        this.snapshotKey = key;
        this.snapshot.set(null);
        this.page.set(0);
        this.neuron.set(0);
      }
      this.loading.set(false);
      this.error.set('');
      if (!network) {
        this.error.set(
          'Connect this block into a complete network to see its actual weights and numbers.',
        );
        return;
      }
      const step = inspectionStep(this.game.board(), network, target);
      if (step < 0) {
        this.error.set(
          'This block is outside the connected path. Connect it to inspect its numbers.',
        );
        return;
      }
      this.loading.set(true);
      untracked(
        () =>
          void this.game.trainer
            .prepare(network, dataset)
            .then((ready) => {
              if (current && ready)
                this.snapshot.set(this.game.trainer.inspect(step, pixels, letters));
            })
            .catch(() => {
              if (current)
                this.error.set('The model could not open. Close this view and try again.');
            })
            .finally(() => {
              if (current) this.loading.set(false);
            }),
      );
    });
  }
}
