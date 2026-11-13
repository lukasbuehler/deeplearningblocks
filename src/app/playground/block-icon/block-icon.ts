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
    } @else if (sketch()) {
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" aria-hidden="true">
        <path
          [attr.d]="sketch()"
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
        softmax: 'percent',
        classifier: 'bar_chart',
        custom: 'stacks',
      })[this.kind() as string] ?? '',
  );
  /** Text blocks are drawn as small line sketches; the icon font holds only picture-level icons. */
  readonly sketch = computed(
    () =>
      ({
        // Lines of a page.
        text: 'M8 11H40M8 19H40M8 27H40M8 35H28',
        // One letter becomes a row of numbers.
        embedding: 'M8 10V22M4 10H12M24 6H44V42H24ZM24 18H44M24 30H44M8 30V38H18',
        // Rising seat numbers.
        position: 'M8 40V32M18 40V26M28 40V20M38 40V12',
        // Bars of different heights evened out.
        layernorm: 'M5 30V18M12 30V8M19 30V24M26 18H44M30 30V18M37 30V18M44 30V18',
        // The last letter looks back at earlier letters.
        attention:
          'M8 38H8.01M18 38H18.01M28 38H28.01M40 38H40.01M40 34C40 16 8 16 8 34M40 34C40 22 18 22 18 34',
        // Two roads meet in a plus.
        add: 'M24 12V36M12 24H36M6 6L13 13M42 6L35 13',
        // A pencil writing a line.
        writer: 'M12 36L33 15L38 20L17 41H12ZM29 19L34 24M6 44H42',
      })[this.kind() as string] ?? '',
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
