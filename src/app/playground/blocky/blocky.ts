import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { BlockyHint } from '../blocky-hints';
const KEY = 'dlb-blocky-v1';
function preferences(): { muted: boolean; dismissed: string[] } {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return {
      muted: value.muted === true,
      dismissed: Array.isArray(value.dismissed)
        ? value.dismissed.filter((v: unknown) => typeof v === 'string').slice(-50)
        : [],
    };
  } catch {
    return { muted: false, dismissed: [] };
  }
}
@Component({
  selector: 'app-blocky',
  templateUrl: './blocky.html',
  styleUrl: './blocky.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Blocky {
  readonly hint = input.required<BlockyHint>();
  readonly context = input.required<string>();
  readonly suppressed = input(false);
  readonly angle = input(0);
  readonly show = output<void>();
  readonly highlight = output<boolean>();
  readonly prefs = signal(preferences());
  private readonly revealed = signal('');
  readonly open = computed(() => this.revealed() === this.key() && !this.prefs().muted);
  readonly details = signal(false);
  readonly key = computed(() => this.context() + ':' + this.hint().id);
  constructor() {
    effect((cleanup) => {
      const key = this.key(),
        suppressed = this.suppressed(),
        muted = this.prefs().muted;
      this.details.set(false);
      if (suppressed || muted || this.prefs().dismissed.includes(key)) return;
      const timer = setTimeout(() => this.revealed.set(key), 1800);
      cleanup(() => clearTimeout(timer));
    });
    effect(() => this.highlight.emit(this.open() && !this.suppressed() && !this.prefs().muted));
    effect(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(this.prefs()));
      } catch {
        /* Help remains usable without storage. */
      }
    });
  }
  ask(): void {
    if (this.prefs().muted) this.prefs.update((p) => ({ ...p, muted: false }));
    // A manual request is immediate, even for a previously dismissed clue.
    this.revealed.set(this.key());
  }
  dismiss(): void {
    this.prefs.update((p) => ({
      ...p,
      dismissed: [...p.dismissed.filter((k) => k !== this.key()), this.key()].slice(-50),
    }));
    this.revealed.set('');
  }
  mute(): void {
    this.prefs.update((p) => ({ ...p, muted: true }));
    this.revealed.set('');
  }
}
