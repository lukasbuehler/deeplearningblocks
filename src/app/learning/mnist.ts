import { DATASETS, DatasetId } from './datasets';
export interface DigitSet {
  pixels: Float32Array;
  labels: Uint8Array;
  count: number;
}
export function decodeDigits(buffer: ArrayBuffer, count: number): DigitSet {
  const bytes = new Uint8Array(buffer);
  if (bytes.length !== count * 785) throw new Error('The image file is incomplete. Please retry.');
  const pixels = new Float32Array(count * 784),
    labels = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    labels[i] = bytes[i * 785];
    if (labels[i] > 9) throw new Error('The image file has an invalid label.');
    for (let p = 0; p < 784; p++) pixels[i * 784 + p] = bytes[i * 785 + p + 1] / 255;
  }
  return { pixels, labels, count };
}
export async function loadDigits(
  split: 'train' | 'test',
  dataset: DatasetId = 'mnist',
): Promise<DigitSet> {
  const response = await fetch(`/data/${dataset}-${split}.bin.gz`, {
    signal: AbortSignal.timeout(20000),
    // Decoded datasets are cached by TrainingService; retries need fresh transport bytes.
    cache: 'no-store',
  });
  if (!response.ok)
    throw new Error(`Could not load ${DATASETS[dataset].name}. Check your connection and retry.`);
  // Some servers (such as the Angular dev server) send .gz files with Content-Encoding: gzip, so
  // the browser has already unzipped them. Only gunzip bytes that still start with the gzip magic.
  const raw = await response.arrayBuffer();
  const head = new Uint8Array(raw, 0, Math.min(2, raw.byteLength));
  const buffer =
    head[0] === 0x1f && head[1] === 0x8b
      ? await new Response(
          new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip')),
        ).arrayBuffer()
      : raw;
  return decodeDigits(buffer, split === 'train' ? 3000 : 500);
}
