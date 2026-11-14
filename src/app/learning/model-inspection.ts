import type * as TF from './tensorflow';
import { Activation } from './curriculum';
import { BLOCKS, Board, NetworkSpec, networkParts } from '../playground/graph';

export interface InspectionTarget {
  id: string;
  innerId?: string;
  copy?: number;
}
export interface OperationSnapshot {
  inputs: number[];
  outputs: number[];
  /** Row-major [inputs, outputs], matching the actual runtime kernel. */
  weights?: number[];
  biases?: number[];
}
/** Resolve a visible card to its executed operation, retaining independent repeat copies. */
export function inspectionStep(board: Board, network: NetworkSpec, target: InspectionTarget) {
  const copies = new Map<string, number>();
  return networkParts(board, network.nodeIds)
    .filter(
      ({ node }) =>
        node.kind === 'add' ||
        (node.kind !== 'custom' && BLOCKS[node.kind].operation({ ...node, x: 0, y: 0 })),
    )
    .findIndex(({ node, owner }) => {
      const key = `${owner.id}/${node.id}`;
      const copy = (copies.get(key) ?? 0) + 1;
      copies.set(key, copy);
      return (
        owner.id === target.id &&
        (!target.innerId || (node.id === target.innerId && copy === (target.copy ?? 1)))
      );
    });
}
export function activationValue(name: Activation, x: number): number {
  return name === 'relu'
    ? Math.max(0, x)
    : name === 'sigmoid'
      ? 1 / (1 + Math.exp(-x))
      : name === 'tanh'
        ? Math.tanh(x)
        : x;
}
/** Read the last row: one image, or the last character in the context window. */
export function tensorRow(tf: typeof TF, tensor: TF.Tensor): number[] {
  const width = tensor.shape.at(-1)!;
  return Array.from(
    tf.slice(tf.reshape(tensor, [-1, width]), [tensor.size / width - 1, 0], [1, width]).dataSync(),
  );
}
export function inspectImageModel(
  tf: typeof TF,
  model: TF.Sequential,
  step: number,
  pixels: Float32Array,
): OperationSnapshot {
  return tf.tidy(() => {
    let value: TF.Tensor = tf.tensor4d(pixels, [1, 28, 28, 1]);
    for (let i = 0; i < step; i++) value = model.layers[i].apply(value) as TF.Tensor;
    const inputs = tensorRow(tf, value);
    const layer = model.layers[step];
    const outputs = tensorRow(tf, layer.apply(value) as TF.Tensor);
    const [kernel, bias] = layer.getWeights();
    return {
      inputs,
      outputs,
      ...(kernel
        ? { weights: Array.from(kernel.dataSync()), biases: Array.from(bias.dataSync()) }
        : {}),
    };
  });
}
