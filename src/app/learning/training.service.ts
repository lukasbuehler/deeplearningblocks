import { Injectable, signal } from '@angular/core';
import type * as TF from './tensorflow';
import { NetworkSpec } from '../playground/graph';
import { buildModel } from '../playground/model-builder';
import { DATASETS, DatasetId } from './datasets';
import { DigitSet, loadDigits } from './mnist';
import {
  TEXT_TRAINING,
  TextCorpus,
  CONTEXT,
  encode,
  decode,
  loadShakespeare,
  sampleBatch,
  seededRandom,
} from './shakespeare';
import { OperationSnapshot, inspectImageModel } from './model-inspection';
import { TextModel, buildTextModel, evaluateText, generateText } from './text-model';

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
  /** Tiny Shakespeare, once loaded for the text level's preview and training. */
  readonly text = signal<TextCorpus | null>(null);
  /** What the Shakespeare writer shows: the prompt, the letters written after it, and when. */
  readonly writing = signal(false);
  readonly written = signal<{ prompt: string; text: string; caption: string } | null>(null);
  private tf?: typeof TF;
  private model?: TF.Sequential;
  private textModel?: TextModel;
  private corpus?: Promise<TextCorpus>;
  private stopWriting = false;
  private optimizer?: TF.Optimizer;
  private readonly data = new Map<string, Promise<DigitSet>>();
  private previewDataset?: DatasetId;
  private modelDataset?: DatasetId;
  private cancelled = false;
  readonly modelRevision = signal(0);
  readonly hasUpdates = signal(false);
  private runtimeKey?: string;
  private generation = 0;
  private preparation?: { key: string; promise: Promise<boolean> };

  /** Inspection initializes the same model that the next training run will optimize. */
  async prepare(network: NetworkSpec, dataset: DatasetId): Promise<boolean> {
    const key = `${dataset}/${network.signature}`;
    if (this.runtimeKey === key && (this.model || this.textModel)) return true;
    if (this.preparation?.key === key) return this.preparation.promise;
    this.invalidate();
    const generation = this.generation;
    const promise = (async () => {
      const tf = (this.tf ??= await import('./tensorflow'));
      await tf.ready();
      if (generation !== this.generation) return false;
      if (network.world === 'text') this.textModel = buildTextModel(tf, network);
      else this.model = buildModel(tf, network);
      this.runtimeKey = key;
      this.modelRevision.update((n) => n + 1);
      return true;
    })().finally(() => {
      if (generation === this.generation) this.preparation = undefined;
    });
    this.preparation = { key, promise };
    return promise;
  }
  inspect(step: number, pixels?: Float32Array, letters?: string): OperationSnapshot | null {
    const tf = this.tf;
    if (!tf || step < 0) return null;
    if (this.textModel) {
      const ids = encode(letters ?? '').ids.slice(-CONTEXT);
      if (!ids.length) return null;
      const tensor = tf.tensor2d(ids, [1, ids.length], 'int32');
      try {
        return this.textModel.inspect(step, tensor);
      } finally {
        tensor.dispose();
      }
    }
    return this.model
      ? inspectImageModel(tf, this.model, step, pixels ?? new Float32Array(784))
      : null;
  }

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
  private loadText(): Promise<TextCorpus> {
    this.corpus ??= loadShakespeare().catch((error) => {
      this.corpus = undefined; // Failed downloads must remain retryable.
      throw error;
    });
    return this.corpus;
  }
  async loadPreview(dataset: DatasetId = 'mnist'): Promise<void> {
    if (dataset !== this.previewDataset) {
      this.previewDataset = dataset;
      this.test.set(null);
      const prefix = `${dataset}/`;
      if (!this.runtimeKey?.startsWith(prefix) && !this.preparation?.key.startsWith(prefix))
        this.invalidate();
    }
    if (DATASETS[dataset].kind === 'text') {
      const corpus = await this.loadText();
      if (this.previewDataset === dataset) this.text.set(corpus);
      return;
    }
    const data = await this.load('test', dataset);
    // A previous level's slower download must not replace the active preview.
    if (this.previewDataset === dataset) this.test.set(data);
  }
  invalidate(): void {
    this.generation++;
    this.hasUpdates.set(false);
    this.preparation = undefined;
    this.runtimeKey = undefined;
    this.modelRevision.update((n) => n + 1);
    this.trained.set(false);
    this.modelDataset = undefined;
    this.stopWriting = true;
    this.written.set(null);
    this.model?.dispose();
    this.model = undefined;
    this.textModel?.dispose();
    this.textModel = undefined;
    this.optimizer?.dispose();
    this.optimizer = undefined;
  }
  stop(): void {
    this.cancelled = true;
    this.status.set('Stopping…');
  }
  /**
   * Teach a text network to guess the next letter. Each round ends with a check on held-out text
   * and a short sample in the writer, so the player can watch the babble turn into words.
   */
  async trainText(
    network: NetworkSpec,
    prompt: string,
  ): Promise<{ accuracy: number; loss: number } | null> {
    if (this.busy()) return null;
    this.busy.set(true);
    this.cancelled = false;
    if (this.trained()) this.invalidate();
    this.epochs.set([]);
    const { steps, rounds, batch, learningRate } = TEXT_TRAINING;
    try {
      this.status.set('Preparing your learning lab…');
      const tf = (this.tf ??= await import('./tensorflow'));
      await tf.ready();
      this.status.set('Loading Tiny Shakespeare…');
      const corpus = await this.loadText();
      this.text.set(corpus);
      if (this.cancelled) return null;
      if (!(await this.prepare(network, 'tiny-shakespeare'))) return null;
      const model = this.textModel!;
      this.optimizer?.dispose();
      const optimizer = (this.optimizer = tf.train.adam(learningRate));
      const random = seededRandom(2017);
      await this.sample(model, prompt, 'Before practice: random letters');
      for (let round = 1; round <= rounds && !this.cancelled; round++) {
        this.status.set(`Practicing · round ${round} of ${rounds}`);
        for (let step = 0; step < steps / rounds && !this.cancelled; step++) {
          const { inputs, targets } = sampleBatch(corpus.train, batch, CONTEXT, random);
          const ids = tf.tensor2d(inputs, [batch, CONTEXT], 'int32'),
            answers = tf.tensor2d(targets, [batch, CONTEXT], 'int32');
          tf.dispose([optimizer.minimize(() => model.loss(ids, answers), true, model.variables)!]);
          tf.dispose([ids, answers]);
          this.hasUpdates.set(true);
          // Let the page breathe and the Stop button work.
          if (step % 20 === 19) this.modelRevision.update((n) => n + 1);
          if (step % 4 === 3) await tf.nextFrame();
        }
        if (this.cancelled) break;
        const check = await evaluateText(tf, model, corpus.validation, 4, seededRandom(round));
        if (!Number.isFinite(check.loss))
          throw new Error('This network did not converge. Try fewer blocks and train again.');
        this.epochs.update((rows) => [...rows, { epoch: round, ...check }]);
        await this.sample(model, prompt, `After round ${round} of ${rounds}`);
      }
      if (this.cancelled) return null;
      this.status.set('Checking text it never practiced on…');
      const result = await evaluateText(tf, model, corpus.validation, 16, seededRandom(1958));
      if (this.cancelled) return null;
      this.modelDataset = 'tiny-shakespeare';
      this.trained.set(true);
      this.status.set('Experiment complete');
      return result;
    } catch (error) {
      this.status.set('Could not finish this experiment');
      throw error;
    } finally {
      if (!this.trained() && !this.cancelled) {
        this.invalidate();
      }
      if (this.cancelled) this.status.set('Stopped. You can change your blocks and try again.');
      this.busy.set(false);
      this.modelRevision.update((n) => n + 1);
    }
  }
  private async sample(model: TextModel, prompt: string, caption: string): Promise<void> {
    const ids = await generateText(this.tf!, model, encode(prompt).ids, 80, 0.8, seededRandom(7));
    this.written.set({ prompt, text: decode(ids), caption });
  }
  /** Write with the trained text model, one letter at a time, so the text appears as typed. */
  async write(prompt: string, temperature: number, letters = 240): Promise<boolean> {
    const tf = this.tf,
      model = this.textModel;
    if (!tf || !model || !this.trained() || this.busy() || this.writing()) return false;
    this.writing.set(true);
    this.stopWriting = false;
    const caption = `Temperature ${temperature.toFixed(1)}`;
    this.written.set({ prompt, text: '', caption });
    try {
      await generateText(
        tf,
        model,
        encode(prompt).ids,
        letters,
        temperature,
        seededRandom(Date.now()),
        (id) => {
          if (this.stopWriting || this.textModel !== model) return false;
          this.written.update((w) => w && { ...w, text: w.text + decode([id]) });
          return true;
        },
      );
      return true;
    } finally {
      this.writing.set(false);
    }
  }
  stopWritingText(): void {
    this.stopWriting = true;
  }
  async train(
    network: NetworkSpec,
    dataset: DatasetId = 'mnist',
  ): Promise<{ accuracy: number; loss: number } | null> {
    if (this.busy()) return null;
    this.busy.set(true);
    this.cancelled = false;
    if (this.trained()) this.invalidate();
    this.epochs.set([]);
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
      if (!(await this.prepare(network, dataset))) return null;
      const model = this.model!;
      this.optimizer?.dispose();
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
          onBatchEnd: (batch) => {
            this.hasUpdates.set(true);
            if (batch % 10 === 0) this.modelRevision.update((n) => n + 1);
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
      if (!this.trained() && !this.cancelled) this.invalidate();
      if (this.cancelled) this.status.set('Stopped. You can change your blocks and try again.');
      this.busy.set(false);
      this.modelRevision.update((n) => n + 1);
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
