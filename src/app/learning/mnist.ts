export interface DigitSet { pixels: Float32Array; labels: Uint8Array; count: number }
export function decodeDigits(buffer: ArrayBuffer, count: number): DigitSet {
  const bytes = new Uint8Array(buffer);
  if (bytes.length !== count * 785) throw new Error('The digit file is incomplete. Please retry.');
  const pixels = new Float32Array(count * 784), labels = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    labels[i] = bytes[i * 785];
    if (labels[i] > 9) throw new Error('The digit file has an invalid label.');
    for (let p = 0; p < 784; p++) pixels[i * 784 + p] = bytes[i * 785 + p + 1] / 255;
  }
  return { pixels, labels, count };
}
export async function loadDigits(split: 'train' | 'test'): Promise<DigitSet> {
  const response = await fetch(`/data/mnist-${split}.bin.gz`);
  if (!response.ok || !response.body) throw new Error('Could not load MNIST. Check your connection and retry.');
  const buffer = await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  return decodeDigits(buffer, split === 'train' ? 3000 : 500);
}
