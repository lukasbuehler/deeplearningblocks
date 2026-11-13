import { MatIcon } from '@angular/material/icon';
import { experimentDataset } from '../../learning/datasets';
import { ChangeDetectionStrategy, Component, computed, inject, model } from '@angular/core';
import { DecimalPipe, PercentPipe } from '@angular/common';
import { GameService } from '../game.service';
import { TEXT_TRAINING, VOCAB_SIZE } from '../../learning/shakespeare';
@Component({
  selector: 'app-experiment-notebook',
  imports: [MatIcon, DecimalPipe, PercentPipe],
  templateUrl: './experiment-notebook.html',
  styleUrl: './experiment-notebook.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExperimentNotebook {
  readonly game = inject(GameService);
  readonly expanded = model(false);
  readonly datasetFor = experimentDataset;
  readonly latest = computed(() =>
    this.game
      .workspace()
      .experiments.filter((run) => experimentDataset(run).id === this.game.dataset().id)
      .at(-1),
  );
  readonly text = computed(() => this.game.dataset().kind === 'text');
  /** Words that change between picture and text experiments. */
  readonly words = computed(() =>
    this.text()
      ? {
          recipe: `${TEXT_TRAINING.steps} practice steps · ${TEXT_TRAINING.rounds} rounds · held-out text`,
          rounds: TEXT_TRAINING.rounds,
          score: 'next-letter accuracy',
          chance: `random guessing ≈ ${(100 / VOCAB_SIZE).toFixed(1)}%`,
          curve: 'LEARNING CURVE / HELD-OUT LOSS',
          round: 'Round',
          accuracy: 'Next-letter accuracy',
          loss: 'Held-out loss',
        }
      : {
          recipe: '3,000 examples · 5 passes · 500 test images',
          rounds: 5,
          score: 'last test accuracy',
          chance: 'random guessing ≈ 10%',
          curve: 'LEARNING CURVE / TRAINING LOSS',
          round: 'Pass',
          accuracy: 'Test accuracy',
          loss: 'Test loss',
        },
  );
  readonly lossPoints = computed(() => {
    const rows = this.game.trainer.epochs(),
      max = Math.max(1, ...rows.map((r) => r.loss));
    return rows.map((r, i) => `${10 + i * 52},${70 - (r.loss / max) * 55}`).join(' ');
  });
}
