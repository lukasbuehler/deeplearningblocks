import { ADAM_CONFIG, IMAGE_TRAINING } from '../../learning/training-config';
import { MatIcon } from '@angular/material/icon';
import { experimentDataset } from '../../learning/datasets';
import { ChangeDetectionStrategy, Component, computed, inject, model } from '@angular/core';
import { DecimalPipe, PercentPipe } from '@angular/common';
import { GameService } from '../game.service';
import { CONTEXT, TRAIN_FRACTION, TEXT_TRAINING, VOCAB_SIZE } from '../../learning/shakespeare';
@Component({
  selector: 'app-experiment-notebook',
  host: { '[class.expanded]': 'expanded()' },
  imports: [MatIcon, DecimalPipe, PercentPipe],
  templateUrl: './experiment-notebook.html',
  styleUrl: './experiment-notebook.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExperimentNotebook {
  readonly game = inject(GameService);
  readonly expanded = model(false);
  readonly adam = ADAM_CONFIG;
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
          recipe: `${IMAGE_TRAINING.trainExamples.toLocaleString('en-US')} examples · ${IMAGE_TRAINING.epochs} passes · ${IMAGE_TRAINING.testExamples} test images`,
          rounds: IMAGE_TRAINING.epochs,
          score: 'last test accuracy',
          chance: 'random guessing ≈ 10%',
          curve: 'LEARNING CURVE / TRAINING LOSS',
          round: 'Pass',
          accuracy: 'Test accuracy',
          loss: 'Test loss',
        },
  );
  readonly settings = computed(() => [
    { name: 'Optimizer', value: 'Adam' },
    {
      name: 'Learning rate',
      value: String(this.text() ? TEXT_TRAINING.learningRate : IMAGE_TRAINING.learningRate),
    },
    {
      name: 'Batch size',
      value: this.text() ? `${TEXT_TRAINING.batch} sequences` : `${IMAGE_TRAINING.batch} images`,
    },
    {
      name: 'Training budget',
      value: this.text()
        ? `${TEXT_TRAINING.steps} steps · ${TEXT_TRAINING.rounds} rounds`
        : `${IMAGE_TRAINING.epochs} passes (epochs)`,
    },
    {
      name: 'Loss function',
      value: this.text() ? 'Next-letter cross-entropy' : 'Categorical cross-entropy',
    },
    ...(this.text()
      ? [
          { name: 'Context window', value: `${CONTEXT} characters` },
          {
            name: 'Data split',
            value: `First ${TRAIN_FRACTION * 100}% for training · final ${Math.round((1 - TRAIN_FRACTION) * 100)}% held out`,
          },
          { name: 'Batch sampling', value: 'Random windows inside the training split' },
        ]
      : [
          {
            name: 'Training data',
            value: `${IMAGE_TRAINING.trainExamples.toLocaleString('en-US')} images`,
          },
          {
            name: 'Final evaluation',
            value: `${IMAGE_TRAINING.testExamples} separate test images`,
          },
          { name: 'Example order', value: IMAGE_TRAINING.shuffle ? 'Shuffled each pass' : 'Fixed' },
        ]),
  ]);
  readonly lossPoints = computed(() => {
    const rows = this.game.trainer.epochs(),
      max = Math.max(1, ...rows.map((r) => r.loss));
    return rows
      .map(
        (r, i) =>
          `${10 + (rows.length > 1 ? (i * 210) / (rows.length - 1) : 0)},${70 - (r.loss / max) * 55}`,
      )
      .join(' ');
  });
}
