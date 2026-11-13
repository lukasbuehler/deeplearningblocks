import type * as TF from './tensorflow';
import type { NetworkSpec } from '../playground/graph';
import { CONTEXT, VOCAB_SIZE, sampleBatch, sampleLetter } from './shakespeare';

/**
 * A small character-level transformer written with TensorFlow.js core operations. Each compiled
 * step becomes one function, so the shortcut wires on the board are the additions here.
 */
export interface TextModel {
  readonly variables: TF.Variable[];
  /** Letter IDs [batch, letters ≤ CONTEXT] → letter scores [batch, letters, VOCAB_SIZE]. */
  logits(ids: TF.Tensor2D): TF.Tensor3D;
  /** Average cross-entropy of the next-letter guesses. Softmax happens inside the loss. */
  loss(ids: TF.Tensor2D, targets: TF.Tensor2D): TF.Scalar;
  countParams(): number;
  dispose(): void;
}

type Forward = (outputs: TF.Tensor[], ids: TF.Tensor2D) => TF.Tensor;

export function buildTextModel(tf: typeof TF, network: NetworkSpec, seed = 2017): TextModel {
  if (network.world !== 'text') throw new Error('This network does not read text.');
  const variables: TF.Variable[] = [];
  let nextSeed = seed;
  // Match PyTorch's defaults: embeddings ~ N(0, 1), linear layers ~ U(±1/√inputs).
  const variable = (initial: TF.Tensor) => {
    const v = tf.variable(initial);
    variables.push(v);
    return v;
  };
  const uniform = (shape: number[], inputs: number) =>
    variable(
      tf.randomUniform(shape, -1 / Math.sqrt(inputs), 1 / Math.sqrt(inputs), 'float32', nextSeed++),
    );
  const normal = (shape: number[]) => variable(tf.randomNormal(shape, 0, 1, 'float32', nextSeed++));
  const linear = (inputs: number, units: number) => {
    const w = uniform([inputs, units], inputs),
      b = uniform([units], inputs);
    return (x: TF.Tensor) => {
      const [batch, letters] = x.shape;
      return tf.reshape(tf.add(tf.matMul(tf.reshape(x, [-1, inputs]), w), b), [
        batch,
        letters,
        units,
      ]);
    };
  };
  const widths: number[] = [];
  const width = (from: number) => (from < 0 ? 0 : widths[from]);
  const layers: Forward[] = [];
  let logitsFrom = network.steps.length - 1;
  network.steps.forEach((step, i) => {
    const from = step.from ?? i - 1;
    const read = (outputs: TF.Tensor[], ids: TF.Tensor2D) => (from < 0 ? ids : outputs[from]);
    const inputWidth = width(from);
    switch (step.kind) {
      case 'embedding': {
        const table = normal([VOCAB_SIZE, step.units]);
        layers.push((outputs, ids) => tf.gather(table, read(outputs, ids) as TF.Tensor2D));
        widths.push(step.units);
        return;
      }
      case 'position': {
        const seats = normal([CONTEXT, inputWidth]);
        layers.push((outputs, ids) => {
          const x = read(outputs, ids);
          return tf.add(x, tf.slice(seats, [0, 0], [x.shape[1]!, inputWidth]));
        });
        break;
      }
      case 'layernorm': {
        const gain = variable(tf.ones([inputWidth])),
          bias = variable(tf.zeros([inputWidth]));
        layers.push((outputs, ids) => {
          const x = read(outputs, ids);
          const { mean, variance } = tf.moments(x, -1, true);
          return tf.add(
            tf.mul(tf.mul(tf.sub(x, mean), tf.rsqrt(tf.add(variance, 1e-5))), gain),
            bias,
          );
        });
        break;
      }
      case 'attention': {
        const heads = step.heads,
          size = inputWidth / heads;
        const [query, key, value, project] = [0, 1, 2, 3].map(() => linear(inputWidth, inputWidth));
        layers.push((outputs, ids) => {
          const x = read(outputs, ids);
          const [batch, letters] = x.shape as number[];
          // [batch, letters, width] → [batch, heads, letters, head size]
          const split = (t: TF.Tensor) =>
            tf.transpose(tf.reshape(t, [batch, letters, heads, size]), [0, 2, 1, 3]);
          const q = split(query(x)),
            k = split(key(x)),
            v = split(value(x));
          // The no-peeking curtain: a letter may only look at itself and earlier letters.
          const curtain = tf.mul(
            tf.sub(1, tf.linalg.bandPart(tf.ones([letters, letters]), -1, 0)),
            -1e9,
          );
          const scores = tf.add(tf.mul(tf.matMul(q, k, false, true), 1 / Math.sqrt(size)), curtain);
          const mixed = tf.matMul(tf.softmax(scores), v);
          return project(
            tf.reshape(tf.transpose(mixed, [0, 2, 1, 3]), [batch, letters, inputWidth]),
          );
        });
        break;
      }
      case 'dense': {
        const layer = linear(inputWidth, step.units);
        layers.push((outputs, ids) => layer(read(outputs, ids)));
        widths.push(step.units);
        return;
      }
      case 'activation': {
        const name = step.activation;
        layers.push((outputs, ids) => {
          const x = read(outputs, ids);
          return name === 'relu'
            ? tf.relu(x)
            : name === 'sigmoid'
              ? tf.sigmoid(x)
              : name === 'tanh'
                ? tf.tanh(x)
                : x;
        });
        break;
      }
      case 'add': {
        const skip = step.skip;
        layers.push((outputs, ids) => tf.add(read(outputs, ids), outputs[skip]));
        break;
      }
      case 'softmax':
        // Training and sampling use the scores before softmax. The writer applies it.
        logitsFrom = from;
        layers.push((outputs, ids) => read(outputs, ids));
        break;
      default:
        throw new Error(`${step.kind} belongs in a picture network.`);
    }
    widths.push(inputWidth);
  });
  if (width(logitsFrom) !== VOCAB_SIZE)
    throw new Error(`The last layer needs ${VOCAB_SIZE} letter scores.`);
  const logits = (ids: TF.Tensor2D) =>
    tf.tidy(() => {
      const outputs: TF.Tensor[] = [];
      for (const layer of layers) outputs.push(layer(outputs, ids));
      return outputs[logitsFrom] as TF.Tensor3D;
    });
  return {
    variables,
    logits,
    loss: (ids, targets) =>
      tf.tidy(() =>
        tf.losses.softmaxCrossEntropy(
          tf.oneHot(tf.reshape(targets, [-1]) as TF.Tensor1D, VOCAB_SIZE),
          tf.reshape(logits(ids), [-1, VOCAB_SIZE]),
        ),
      ) as TF.Scalar,
    countParams: () => variables.reduce((sum, v) => sum + v.size, 0),
    dispose: () => variables.forEach((v) => v.dispose()),
  };
}

/** Loss and next-letter accuracy on fixed windows of held-out text. */
export async function evaluateText(
  tf: typeof TF,
  model: TextModel,
  region: Uint8Array,
  batches: number,
  random: () => number,
  batchSize = 32,
): Promise<{ loss: number; accuracy: number }> {
  let loss = 0,
    correct = 0;
  for (let b = 0; b < batches; b++) {
    const { inputs, targets } = sampleBatch(region, batchSize, CONTEXT, random);
    const [batchLoss, hits] = tf.tidy(() => {
      const ids = tf.tensor2d(inputs, [batchSize, CONTEXT], 'int32'),
        answers = tf.tensor2d(targets, [batchSize, CONTEXT], 'int32');
      const scores = model.logits(ids);
      return [
        model.loss(ids, answers),
        tf.sum(tf.equal(tf.argMax(scores, -1), answers)),
      ] as TF.Tensor[];
    });
    loss += (await batchLoss.data())[0];
    correct += (await hits.data())[0];
    batchLoss.dispose();
    hits.dispose();
  }
  return { loss: loss / batches, accuracy: correct / (batches * batchSize * CONTEXT) };
}

/** Write one letter at a time. Each new letter becomes part of the next letter's context. */
export async function generateText(
  tf: typeof TF,
  model: TextModel,
  prompt: Uint8Array,
  count: number,
  temperature: number,
  random: () => number,
  onLetter?: (id: number) => boolean | void,
): Promise<number[]> {
  const ids = Array.from(prompt.length ? prompt : [0]);
  const written: number[] = [];
  for (let n = 0; n < count; n++) {
    const context = ids.slice(-CONTEXT);
    const last = tf.tidy(() =>
      tf.reshape(
        tf.slice(
          model.logits(tf.tensor2d(context, [1, context.length], 'int32')),
          [0, context.length - 1, 0],
          [1, 1, VOCAB_SIZE],
        ),
        [VOCAB_SIZE],
      ),
    );
    const scores = await last.data();
    last.dispose();
    const id = sampleLetter(scores, temperature, random);
    ids.push(id);
    written.push(id);
    if (onLetter?.(id) === false) break;
  }
  return written;
}
