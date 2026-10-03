import { ChangeDetectionStrategy, Component, computed, inject, model } from '@angular/core';
import { DecimalPipe, PercentPipe } from '@angular/common';
import { GameService } from '../game.service';
@Component({
  selector: 'app-experiment-notebook',
  imports: [DecimalPipe, PercentPipe],
  templateUrl: './experiment-notebook.html',
  styleUrl: './experiment-notebook.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExperimentNotebook {
  readonly game = inject(GameService);
  readonly expanded = model(false);
  readonly latest = computed(() => this.game.workspace().experiments.at(-1));
  readonly lossPoints = computed(() => {
    const rows = this.game.trainer.epochs(),
      max = Math.max(1, ...rows.map((r) => r.loss));
    return rows.map((r, i) => `${10 + i * 52},${70 - (r.loss / max) * 55}`).join(' ');
  });
}
