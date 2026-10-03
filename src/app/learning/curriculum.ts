export type Activation = 'linear' | 'sigmoid' | 'tanh' | 'relu';
export interface DenseBlock {
  id: number;
  units: number;
  activation: Activation;
}
export interface Experiment {
  accuracy: number;
  loss: number;
  layers: string;
  era: number;
}
export const ERAS = [
  {
    year: '1958',
    title: 'A learning neuron',
    short: 'The foundations',
    description:
      'Frank Rosenblatt’s perceptron showed how a machine could learn weights from examples. Start with the same big idea: pixels go in, weighted connections make a decision.',
    challenge:
      'Build a first network. Connect Flatten and Dense, then check your build. Try training to recognize handwritten digits.',
    note: 'Our lab uses softmax and a modern optimizer, not the original perceptron rule. Dates mark influential milestones, not the invention of every ingredient.',
    source:
      'https://web.stanford.edu/class/psych209a/ReadingsByDate/01_30/Rosenblatt58Perceptron.pdf',
    sourceLabel: 'Rosenblatt’s 1958 paper',
  },
  {
    year: '1986',
    title: 'Learning in layers',
    short: 'Hidden possibilities',
    description:
      'Rumelhart, Hinton and Williams helped popularize backpropagation: send an error backward to improve the weights in hidden layers. Smooth nonlinear activations make those layers useful.',
    challenge:
      'Add a Sigmoid or Tanh block and check your build. Try training again. Compare the result with your first experiment.',
    note: 'Backpropagation has earlier roots. 1986 marks an influential demonstration. Stacking only linear layers still gives a linear transformation.',
    source: 'https://www.cs.toronto.edu/~hinton/backprop.html',
    sourceLabel: 'The 1986 backpropagation papers',
  },
  {
    year: '2010',
    title: 'Make room for ReLU',
    short: 'Deeper discoveries',
    description:
      'Nair and Hinton demonstrated the usefulness of rectified linear units in 2010. ReLU keeps positive inputs and turns negative ones into zero, helping many deeper networks learn.',
    challenge:
      'Try ReLU. Add another hidden layer, change its width, and see whether more blocks actually help.',
    note: 'Rectifying neurons predate 2010. This milestone is one step toward modern deep learning, not a claim that ReLU was invented that year.',
    source: 'https://www.cs.toronto.edu/~hinton/absps/reluICML.pdf',
    sourceLabel: 'Nair & Hinton’s 2010 paper',
  },
] as const;
export const ACTIVATIONS: { value: Activation; label: string; era: number; explanation: string }[] =
  [
    {
      value: 'linear',
      label: 'Linear',
      era: 0,
      explanation:
        'f(x) = x. Passes the value through. More linear layers alone do not add nonlinear patterns.',
    },
    {
      value: 'sigmoid',
      label: 'Sigmoid',
      era: 1,
      explanation:
        'f(x) = 1 / (1 + exp(−x)). Squeezes values between 0 and 1. At the extremes, its gradient gets very small.',
    },
    {
      value: 'tanh',
      label: 'Tanh',
      era: 1,
      explanation:
        'f(x) = tanh(x). Squeezes values between −1 and 1, centered at zero. It can also saturate.',
    },
    {
      value: 'relu',
      label: 'ReLU',
      era: 2,
      explanation:
        'f(x) = max(0, x). Keeps positive values and zeros negative ones. Simple, but some neurons can become inactive.',
    },
  ];
export function parameterCount(blocks: readonly DenseBlock[]): number {
  let inputs = 784,
    count = 0;
  for (const block of blocks) {
    count += (inputs + 1) * block.units;
    inputs = block.units;
  }
  return count + (inputs + 1) * 10;
}
export function nextEra(era: number, blocks: readonly DenseBlock[]): number {
  if (era === 0 && blocks.length) return 1;
  if (era === 1 && blocks.some((b) => b.activation === 'sigmoid' || b.activation === 'tanh'))
    return 2;
  return era;
}
