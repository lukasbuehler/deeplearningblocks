import { Dataset, DATASETS } from '../../learning/datasets';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PercentPipe } from '@angular/common';
import { DigitPreview } from '../../learning/digit-preview/digit-preview';
import { BlockIcon } from '../block-icon/block-icon';
import { blockName } from '../block-catalog';
import { BLOCKS, BlockNode } from '../graph';
@Component({
  selector: 'app-block-card',
  imports: [FormsModule, PercentPipe, DigitPreview, BlockIcon],
  templateUrl: './block-card.html',
  styleUrl: './block-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockCard {
  readonly dataset = input<Dataset>(DATASETS.mnist);
  readonly node = input.required<BlockNode>();
  readonly inputSize = input<number>();
  readonly outputSize = input<number>();
  readonly selected = input(false);
  readonly busy = input(false);
  readonly pixels = input<Float32Array>();
  readonly actual = input<number>();
  readonly custom = input(false);
  readonly draw = output<void>();
  readonly probabilities = input<number[]>([]);
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
  readonly name = computed(() => blockName(this.node(), this.dataset()));
  readonly activationDetail = computed(
    () =>
      ({
        linear: 'Keep every value',
        sigmoid: 'Between 0 and 1',
        tanh: 'Between −1 and 1',
        relu: 'Keep positives. Zero negatives.',
      })[this.node().activation ?? 'linear'],
  );
  stopControls(event: Event): void {
    if ((event.target as HTMLElement).closest('button,select,input')) event.stopPropagation();
  }
  changeUnits(value: string): void {
    this.configure.emit({ id: this.node().id, units: +value });
  }
}
