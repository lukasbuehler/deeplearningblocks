import { Injectable, signal } from '@angular/core';
import type * as TF from './tensorflow';
import { NetworkSpec } from '../playground/graph';
import { buildModel } from '../playground/model-builder';
import { DATASETS, DatasetId } from './datasets';
import { DigitSet, loadDigits } from './mnist';

export interface EpochResult {
  epoch: number;
  loss: number;
  accuracy: number;
}
@Injectable({ providedIn: 'root' })
export class TrainingService {
  readonly busy = signal(false);
  readonly status = signal('Ready when you are');
  readonly epochs = signal<EpochResult[]>([]);
  readonly test = signal<DigitSet | null>(null);
  readonly trained = signal(false);
  private tf?: typeof TF;
  private model?: TF.Sequential;
  private optimizer?: TF.Optimizer;
  private readonly data = new Map<string, Promise<DigitSet>>();
  private previewDataset?: DatasetId;
  private modelDataset?: DatasetId;
  private cancelled = false;

  private load(split: 'train' | 'test', dataset: DatasetId): Promise<DigitSet> {
    const key = `${dataset}/${split}`;
    if (!this.data.has(key)) {
      this.data.set(
        key,
        loadDigits(split, dataset).catch((error) => {
          this.data.delete(key); // Failed downloads must remain retryable.
          throw error;
        }),
      );
    }
    return this.data.get(key)!;
  }
  async loadPreview(dataset: DatasetId = 'mnist'): Promise<void> {
    if (dataset !== this.previewDataset) {
      this.previewDataset = dataset;
      this.test.set(null);
      this.invalidate();
    }
    const data = await this.load('test', dataset);
    // A previous level's slower download must not replace the active preview.
    if (this.previewDataset === dataset) this.test.set(data);
  }
  invalidate(): void {
    this.trained.set(false);
    this.modelDataset = undefined;
    this.model?.dispose();
    this.model = undefined;
    this.optimizer?.dispose();
    this.optimizer = undefined;
  }
  stop(): void {
    this.cancelled = true;
    if (this.model) this.model.stopTraining = true;
    this.status.set('Stopping…');
  }
  async train(
    network: NetworkSpec,
    dataset: DatasetId = 'mnist',
  ): Promise<{ accuracy: number; loss: number } | null> {
    if (this.busy()) return null;
    this.busy.set(true);
    this.cancelled = false;
    this.epochs.set([]);
    this.invalidate();
    const tensors: TF.Tensor[] = [];
    try {
      this.status.set('Preparing your learning lab…');
      const tf = (this.tf ??= await import('./tensorflow'));
      await tf.ready();
      this.status.set(`Loading 3,000 ${DATASETS[dataset].name} examples…`);
      const [train] = await Promise.all([this.load('train', dataset), this.loadPreview(dataset)]);
      if (this.cancelled) return null;
      const test = this.test()!;
      const makeTensors = (data: DigitSet) => {
        const x = tf.tensor4d(data.pixels, [data.count, 28, 28, 1]);
        const y = tf.tidy(() => tf.oneHot(tf.tensor1d(data.labels, 'int32'), 10));
        tensors.push(x, y);
        return [x, y];
      };
      const [x, y] = makeTensors(train),
        [testX, testY] = makeTensors(test);
      const model = (this.model = buildModel(tf, network));
      this.optimizer = tf.train.adam(0.003);
      model.compile({
        optimizer: this.optimizer,
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy'],
      });
      await model.fit(x, y, {
        epochs: 5,
        batchSize: 64,
        shuffle: true,
        yieldEvery: 'batch',
        callbacks: {
          onEpochBegin: (epoch) => {
            this.status.set(`Learning · pass ${epoch + 1} of 5`);
          },
          onEpochEnd: (epoch, logs) => {
            this.epochs.update((rows) => [
              ...rows,
              { epoch: epoch + 1, loss: logs!['loss'], accuracy: logs!['acc'] },
            ]);
          },
          onBatchEnd: () => {
            if (this.cancelled) model.stopTraining = true;
          },
        },
      });
      if (this.cancelled) return null;
      this.status.set('Checking 500 unseen images…');
      const evaluation = model.evaluate(testX, testY) as TF.Tensor[];
      tensors.push(...evaluation);
      const [loss, accuracy] = await Promise.all(
        evaluation.map(async (tensor) => (await tensor.data())[0]),
      );
      if (this.cancelled) return null;
      if (!Number.isFinite(loss) || !Number.isFinite(accuracy))
        throw new Error('This network did not converge. Try fewer layers and train again.');
      this.modelDataset = dataset;
      this.trained.set(true);
      this.status.set('Experiment complete');
      return { loss, accuracy };
    } catch (error) {
      this.status.set('Could not finish this experiment');
      throw error;
    } finally {
      tensors.forEach((tensor) => tensor.dispose());
      if (!this.trained()) this.invalidate();
      if (this.cancelled) this.status.set('Stopped. You can change your blocks and try again.');
      this.busy.set(false);
    }
  }
  predict(index: number): number[] {
    const data = this.test();
    return data ? this.predictPixels(data.pixels.slice(index * 784, (index + 1) * 784)) : [];
  }
  predictPixels(pixels: Float32Array): number[] {
    const tf = this.tf,
      model = this.model;
    if (
      !tf ||
      !model ||
      !this.trained() ||
      this.modelDataset !== this.previewDataset ||
      pixels.length !== 784
    )
      return [];
    return tf.tidy(() =>
      Array.from((model.predict(tf.tensor4d(pixels, [1, 28, 28, 1])) as TF.Tensor).dataSync()),
    );
  }
}
