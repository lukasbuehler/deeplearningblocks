import { Injectable, signal } from '@angular/core';
import type * as TF from './tensorflow';
import { DenseBlock } from './curriculum';
import { DigitSet, loadDigits } from './mnist';

export interface EpochResult { epoch: number; loss: number; accuracy: number }
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
  private trainingData?: DigitSet;
  private cancelled = false;

  async loadPreview(): Promise<void> {
    if (!this.test()) this.test.set(await loadDigits('test'));
  }
  invalidate(): void {
    this.trained.set(false);
    this.model?.dispose(); this.model = undefined;
    this.optimizer?.dispose(); this.optimizer = undefined;
  }
  stop(): void {
    this.cancelled = true;
    if (this.model) this.model.stopTraining = true;
    this.status.set('Stopping…');
  }
  async train(blocks: readonly DenseBlock[]): Promise<{ accuracy: number; loss: number } | null> {
    if (this.busy()) return null;
    this.busy.set(true); this.cancelled = false; this.epochs.set([]); this.invalidate();
    const tensors: TF.Tensor[] = [];
    try {
      this.status.set('Preparing your learning lab…');
      const tf = this.tf ??= await import('./tensorflow');
      await tf.ready();
      this.status.set('Loading 3,000 training digits…');
      await Promise.all([
        this.loadPreview(),
        this.trainingData ? Promise.resolve() : loadDigits('train').then(data => this.trainingData = data),
      ]);
      if (this.cancelled) return null;
      const train = this.trainingData!, test = this.test()!;
      const makeTensors = (data: DigitSet) => {
        const x = tf.tensor2d(data.pixels, [data.count, 784]);
        const y = tf.tidy(() => tf.oneHot(tf.tensor1d(data.labels, 'int32'), 10));
        tensors.push(x, y);
        return [x, y];
      };
      const [x, y] = makeTensors(train), [testX, testY] = makeTensors(test);
      const model = this.model = tf.sequential();
      blocks.forEach((block, index) => model.add(tf.layers.dense({
        units: block.units, activation: block.activation,
        ...(index === 0 ? { inputShape: [784] } : {}),
        kernelInitializer: tf.initializers.glorotUniform({ seed: 1958 + index }),
      })));
      model.add(tf.layers.dense({ units: 10, activation: 'softmax',
        ...(!blocks.length ? { inputShape: [784] } : {}),
        kernelInitializer: tf.initializers.glorotUniform({ seed: 1998 }),
      }));
      this.optimizer = tf.train.adam(0.003);
      model.compile({ optimizer: this.optimizer, loss: 'categoricalCrossentropy', metrics: ['accuracy'] });
      await model.fit(x, y, {
        epochs: 5, batchSize: 64, shuffle: true, yieldEvery: 'batch',
        callbacks: {
          onEpochBegin: epoch => { this.status.set(`Learning · pass ${epoch + 1} of 5`); },
          onEpochEnd: (epoch, logs) => {
            this.epochs.update(rows => [...rows, { epoch: epoch + 1, loss: logs!['loss'], accuracy: logs!['acc'] }]);
          },
          onBatchEnd: () => { if (this.cancelled) model.stopTraining = true; },
        },
      });
      if (this.cancelled) return null;
      this.status.set('Checking 500 unseen digits…');
      const evaluation = model.evaluate(testX, testY) as TF.Tensor[];
      tensors.push(...evaluation);
      const [loss, accuracy] = await Promise.all(evaluation.map(async tensor => (await tensor.data())[0]));
      if (this.cancelled) return null;
      if (!Number.isFinite(loss) || !Number.isFinite(accuracy)) throw new Error('This network did not converge. Try fewer layers and train again.');
      this.trained.set(true); this.status.set('Experiment complete');
      return { loss, accuracy };
    } catch (error) {
      this.status.set('Could not finish this experiment');
      throw error;
    } finally {
      tensors.forEach(tensor => tensor.dispose());
      if (!this.trained()) this.invalidate();
      if (this.cancelled) this.status.set('Stopped. You can change your blocks and try again.');
      this.busy.set(false);
    }
  }
  predict(index: number): number[] {
    const tf = this.tf, model = this.model, data = this.test();
    if (!tf || !model || !data || !this.trained()) return [];
    return tf.tidy(() => Array.from((model.predict(tf.tensor2d(
      data.pixels.slice(index * 784, (index + 1) * 784), [1, 784],
    )) as TF.Tensor).dataSync()));
  }
}
