/** Shared by the runtime and training panel so the displayed recipe stays accurate. */
export const ADAM_CONFIG = { beta1: 0.9, beta2: 0.999 } as const;
export const IMAGE_TRAINING = {
  learningRate: 0.003,
  batch: 64,
  epochs: 5,
  trainExamples: 3000,
  testExamples: 500,
  shuffle: true,
  loss: 'categoricalCrossentropy',
} as const;
