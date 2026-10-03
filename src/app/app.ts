import { ChangeDetectionStrategy, Component, computed, signal, viewChild } from '@angular/core';
import { inject } from '@angular/core';
import { GameService } from './playground/game.service';
import { PaperCanvas } from './playground/paper-canvas/paper-canvas';
import { BLOCKS } from './playground/graph';
import { ERAS, ACTIVATIONS } from './learning/curriculum';
import { ExperimentNotebook } from './playground/experiment-notebook/experiment-notebook';
import { DigitPad } from './playground/digit-pad/digit-pad';
import { Mode } from './playground/storage';
@Component({
  selector: 'app-root',
  imports: [PaperCanvas, ExperimentNotebook, DigitPad],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  readonly game = inject(GameService);
  readonly canvas = viewChild(PaperCanvas);
  readonly sidebar = signal(window.innerWidth >= 900);
  readonly notebook = signal(false);
  readonly tips = signal(false);
  readonly resetRequested = signal(false);
  readonly eras = ERAS;
  readonly viewedEra = signal<number | null>(null);
  readonly chapter = computed(() => ERAS[this.viewedEra() ?? this.game.era()]);
  readonly definitions = BLOCKS;
  readonly selectedHint = computed(() => {
    const node = this.game.selectedNode();
    if (!node) return '';
    return node.kind === 'activation'
      ? (ACTIVATIONS.find((a) => a.value === node.activation)?.explanation ?? '')
      : BLOCKS[node.kind].help;
  });
  readonly challenge = computed(() =>
    (this.viewedEra() ?? this.game.era()) === 0
      ? 'Add Flatten and Dense. Connect the image all the way to the digit guess, then train.'
      : (this.viewedEra() ?? this.game.era()) === 1
        ? 'Unplug one wire. Add Sigmoid or Tanh after a Dense block. Reconnect and train to discover ReLU.'
        : 'Try ReLU and another Dense block. Does a bigger network make a better guess?',
  );
  switchMode(mode: Mode): void {
    this.game.switchMode(mode);
    this.viewedEra.set(null);
    this.canvas()?.clearSelection();
    this.resetRequested.set(false);
    requestAnimationFrame(() => {
      const v = this.game.board().viewport;
      if (v.x === 0 && v.y === 0) this.canvas()?.fit();
    });
  }
  train(): void {
    this.viewedEra.set(null);
    this.notebook.set(true);
    void this.game.train();
  }
  reset(): void {
    this.game.reset();
    this.resetRequested.set(false);
    this.canvas()?.clearSelection();
    requestAnimationFrame(() => this.canvas()?.fit());
  }
}
