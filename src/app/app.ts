import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  signal,
  viewChild,
} from '@angular/core';
import { inject } from '@angular/core';
import { GameService } from './playground/game.service';
import { PaperCanvas } from './playground/paper-canvas/paper-canvas';
import { BLOCKS } from './playground/graph';
import { ACTIVATIONS } from './learning/curriculum';
import { ExperimentNotebook } from './playground/experiment-notebook/experiment-notebook';
import { DigitPad } from './playground/digit-pad/digit-pad';
import { Brand } from './playground/brand/brand';
import { CodeExport } from './playground/code-export/code-export';
import { blockName } from './playground/block-catalog';
import { Mode } from './playground/storage';
import { LEVELS, LevelId } from './playground/levels';
@Component({
  selector: 'app-root',
  imports: [PaperCanvas, ExperimentNotebook, DigitPad, CodeExport, Brand],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  readonly game = inject(GameService);
  readonly canvas = viewChild(PaperCanvas);
  readonly sidebar = signal(window.innerWidth >= 900);
  readonly notebook = signal(false);
  readonly codeOpen = signal(false);
  readonly tips = signal(false);
  readonly resetRequested = signal(false);
  readonly levels = LEVELS;
  readonly checkButton = viewChild<ElementRef<HTMLButtonElement>>('checkButton');
  readonly chapter = this.game.level;
  readonly definitions = BLOCKS;
  readonly blockName = blockName;
  readonly selectedHint = computed(() => {
    const node = this.game.selectedNode();
    if (!node) return '';
    return node.kind === 'activation'
      ? (ACTIVATIONS.find((a) => a.value === node.activation)?.explanation ?? '')
      : BLOCKS[node.kind].help;
  });
  readonly challenge = computed(() => this.game.level().challenge);
  switchLevel(id: LevelId): void {
    this.game.switchLevel(id);
    this.prepareCanvas();
  }
  private prepareCanvas(): void {
    this.canvas()?.clearSelection();
    this.canvas()?.tray.set(false);
    this.resetRequested.set(false);
    requestAnimationFrame(() => {
      const v = this.game.board().viewport;
      if (v.x === 0 && v.y === 0) this.canvas()?.fit();
    });
  }
  switchMode(mode: Mode): void {
    this.game.switchMode(mode);
    this.prepareCanvas();
  }

  train(): void {
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
