import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PercentPipe } from '@angular/common';
import { Activation, ACTIVATIONS } from '../../learning/curriculum';
import { DigitPreview } from '../../learning/digit-preview/digit-preview';
import { BLOCKS, BlockNode } from '../graph';
@Component({
  selector: 'app-block-card',
  imports: [FormsModule, PercentPipe, DigitPreview],
  templateUrl: './block-card.html',
  styleUrl: './block-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockCard {
  readonly node = input.required<BlockNode>();
  readonly inputSize = input<number>();
  readonly outputSize = input<number>();
  readonly selected = input(false);
  readonly busy = input(false);
  readonly pixels = input<Float32Array>();
  readonly actual = input<number>();
  readonly probabilities = input<number[]>([]);
  readonly activations = input(ACTIVATIONS);
  readonly choose = output<void>();
  readonly remove = output<void>();
  readonly nextDigit = output<void>();
  readonly configure = output<Partial<BlockNode> & { id: string }>();
  readonly definition = computed(() => BLOCKS[this.node().kind]);
  readonly prediction = computed(() =>
    this.probabilities().length
      ? this.probabilities().indexOf(Math.max(...this.probabilities()))
      : null,
  );
  readonly activationName = computed(
    () => ACTIVATIONS.find((a) => a.value === this.node().activation)?.label ?? 'Activation',
  );
  readonly sketch = computed(() => {
    const points = Array.from({ length: 41 }, (_, i) => {
      const x = (i - 20) / 5;
      const a = this.node().activation;
      const y =
        a === 'sigmoid'
          ? 1 / (1 + Math.exp(-x))
          : a === 'tanh'
            ? Math.tanh(x)
            : a === 'relu'
              ? Math.max(0, x) / 4
              : x / 4;
      return `${i * 3},${32 - y * 23}`;
    });
    return points.join(' ');
  });
  stopControls(event: Event): void {
    if ((event.target as HTMLElement).closest('button,select,input')) event.stopPropagation();
  }
  changeUnits(value: string): void {
    this.configure.emit({ id: this.node().id, units: +value });
  }
  changeActivation(value: Activation): void {
    this.configure.emit({ id: this.node().id, activation: value });
  }
}
