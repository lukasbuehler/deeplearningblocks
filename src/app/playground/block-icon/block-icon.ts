import { MatIcon } from '@angular/material/icon';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BlockKind } from '../graph';
import { Activation } from '../../learning/curriculum';
@Component({
  selector: 'app-block-icon',
  imports: [MatIcon],
  template: `@if (kind() === 'activation') {
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" aria-hidden="true">
        <path d="M3 26H45M24 3V45" stroke-width="1" opacity=".35" />
        <path
          [attr.d]="curve()"
          stroke-width="3.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    } @else {
      <mat-icon>{{ symbol() }}</mat-icon>
    }`,
  styleUrl: './block-icon.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockIcon {
  readonly kind = input.required<BlockKind>();
  readonly activation = input<Activation>();
  readonly symbol = computed(
    () =>
      ({
        image: 'grid_on',
        flatten: 'view_stream',
        dense: 'hub',
        activation: '',
        softmax: 'percent',
        classifier: 'bar_chart',
        custom: 'stacks',
      })[this.kind()],
  );
  readonly curve = computed(
    () =>
      ({
        linear: 'M5 43L43 5',
        sigmoid: 'M4 26C16 26 17 26 24 17S32 8 44 8',
        tanh: 'M4 42C17 42 17 39 24 25S32 8 44 8',
        relu: 'M4 26H24L44 6',
      })[this.activation() ?? 'linear'],
  );
}
