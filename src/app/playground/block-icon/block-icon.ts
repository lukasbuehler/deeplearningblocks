import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BlockKind } from '../graph';
import { Activation } from '../../learning/curriculum';
@Component({
  selector: 'app-block-icon',
  template: `<svg
    viewBox="0 0 48 48"
    fill="none"
    stroke="currentColor"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    @switch (kind()) {
      @case ('image') {
        <rect x="6" y="6" width="36" height="36" rx="4" />
        <path d="M6 18H42M6 30H42M18 6V42M30 6V42" />
        <path d="M19 19H29V29H19Z" fill="currentColor" />
      }
      @case ('flatten') {
        <path
          d="M5 7H25V27H5ZM5 17H25M15 7V27M30 15L38 23L30 31M37 23H28M5 36H43V43H5ZM14 36V43M24 36V43M34 36V43"
        />
      }
      @case ('dense') {
        <path d="M10 10L38 24L10 38M38 10L10 24L38 38M10 10L38 38M38 10L10 38" opacity=".6" />
        @for (y of [10, 24, 38]; track y) {
          <circle cx="10" [attr.cy]="y" r="4" fill="currentColor" />
          <circle cx="38" [attr.cy]="y" r="4" fill="currentColor" />
        }
      }
      @case ('activation') {
        <path d="M3 26H45M24 3V45" stroke-width="1" opacity=".35" />
        <path [attr.d]="curve()" stroke-width="3.5" />
      }
      @case ('softmax') {
        <path d="M8 10H18M8 23H24M8 36H14M29 10L36 23L29 36" />
        <path d="M39 8V38" />
        <circle cx="39" cy="8" r="3" />
      }
      @case ('classifier') {
        <rect x="5" y="7" width="38" height="34" rx="4" />
        <path d="M13 33V26M24 33V15M35 33V22" stroke-width="5" />
        <path d="M20 8L24 4L28 8" />
      }
    }
  </svg>`,
  styleUrl: './block-icon.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockIcon {
  readonly kind = input.required<BlockKind>();
  readonly activation = input<Activation>();
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
