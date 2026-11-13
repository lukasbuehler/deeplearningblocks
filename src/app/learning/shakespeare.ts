/**
 * Tiny Shakespeare as letter IDs. The alphabet is declared here, not fitted at runtime, so a
 * saved model, the browser and the Python export always agree on what each ID means.
 */
export const SHAKESPEARE_ALPHABET =
  "\n !$&',-.3:;?ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
export const VOCAB_SIZE = SHAKESPEARE_ALPHABET.length;
/** How many letters the model sees at once. Attention compares every pair inside this window. */
export const CONTEXT = 32;
export const SHAKESPEARE_CHARACTERS = 1115394;
/** The first 90% of the text teaches the model; the rest is held out to check it. */
export const TRAIN_FRACTION = 0.9;
/**
 * One browser experiment: 600 practice steps of 32 windows, in 6 rounds. Measured on the CPU
 * backend, a 27k-parameter model reaches a held-out loss near 2.2 (35% next-letter accuracy) in
 * 300 steps. WebGL is much faster. The Python export uses the same recipe.
 */
export const TEXT_TRAINING = { steps: 600, rounds: 6, batch: 32, learningRate: 0.01 } as const;
export const SHAKESPEARE_SOURCE =
  'https://raw.githubusercontent.com/karpathy/char-rnn/6f9487a6fe5b420b7ca9afb0d7c078e37c1d1b4e/data/tinyshakespeare/input.txt';

const INDEX = new Map([...SHAKESPEARE_ALPHABET].map((letter, id) => [letter, id]));

/** Letters outside the alphabet are left out and counted, so the player can be told. */
export function encode(text: string): { ids: Uint8Array; dropped: number } {
  const ids: number[] = [];
  let dropped = 0;
  for (const letter of text.replace(/\r\n?/g, '\n')) {
    const id = INDEX.get(letter);
    if (id === undefined) dropped++;
    else ids.push(id);
  }
  return { ids: Uint8Array.from(ids), dropped };
}
export function decode(ids: ArrayLike<number>): string {
  return Array.from(ids, (id) => SHAKESPEARE_ALPHABET[id] ?? '').join('');
}

export interface TextCorpus {
  train: Uint8Array;
  validation: Uint8Array;
}
export function splitCorpus(ids: Uint8Array): TextCorpus {
  const cut = Math.floor(ids.length * TRAIN_FRACTION);
  return { train: ids.subarray(0, cut), validation: ids.subarray(cut) };
}
export function decodeCorpus(buffer: ArrayBuffer): TextCorpus {
  const { ids, dropped } = encode(new TextDecoder().decode(buffer));
  if (dropped || ids.length !== SHAKESPEARE_CHARACTERS)
    throw new Error('The Shakespeare file is incomplete. Please retry.');
  return splitCorpus(ids);
}
export async function loadShakespeare(): Promise<TextCorpus> {
  const response = await fetch('/data/tiny-shakespeare.txt.gz', {
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok || !response.body)
    throw new Error('Could not load Tiny Shakespeare. Check your connection and retry.');
  const buffer = await new Response(
    response.body.pipeThrough(new DecompressionStream('gzip')),
  ).arrayBuffer();
  return decodeCorpus(buffer);
}

/** A small seeded random number generator, so batches and samples are reproducible. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Random windows from one region. Each target is the letter right after its input, so one
 * window holds `context` practice questions. Windows stay inside the region they come from.
 */
export function sampleBatch(
  region: Uint8Array,
  size: number,
  context: number,
  random: () => number,
): { inputs: Int32Array; targets: Int32Array } {
  const inputs = new Int32Array(size * context),
    targets = new Int32Array(size * context);
  for (let row = 0; row < size; row++) {
    const start = Math.floor(random() * (region.length - context - 1));
    for (let i = 0; i < context; i++) {
      inputs[row * context + i] = region[start + i];
      targets[row * context + i] = region[start + i + 1];
    }
  }
  return { inputs, targets };
}

/** Pick a letter ID from probabilities. Temperature below 1 plays safe; above 1 takes chances. */
export function sampleLetter(logits: ArrayLike<number>, temperature: number, random: () => number) {
  const scaled = Array.from(logits, (value) => value / Math.max(temperature, 0.05));
  const top = Math.max(...scaled);
  const weights = scaled.map((value) => Math.exp(value - top));
  let pick = random() * weights.reduce((a, b) => a + b, 0);
  for (let id = 0; id < weights.length; id++) {
    pick -= weights[id];
    if (pick <= 0) return id;
  }
  return weights.length - 1;
}
