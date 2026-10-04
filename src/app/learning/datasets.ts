/** Current lessons share 28 × 28 grayscale images and ten classes. */
export type DatasetId = 'mnist' | 'fashion-mnist';
export interface Dataset {
  id: DatasetId;
  name: string;
  subject: string;
  inputTitle: string;
  outputTitle: string;
  question: string;
  classes: readonly string[];
  symbols: readonly string[];
  drawable: boolean;
  torchvision: string;
  source: string;
  credit: string;
}
export const DATASETS: Record<DatasetId, Dataset> = {
  mnist: {
    id: 'mnist',
    name: 'MNIST',
    subject: 'Handwritten digits',
    inputTitle: 'Handwritten digit',
    outputTitle: 'Digit guess',
    question: 'What digit is it?',
    classes: Array.from({ length: 10 }, (_, i) => String(i)),
    symbols: Array.from({ length: 10 }, (_, i) => String(i)),
    drawable: true,
    torchvision: 'MNIST',
    source: 'https://yann.lecun.org/exdb/mnist/index.html',
    credit: 'Yann LeCun, Corinna Cortes and Christopher J. C. Burges.',
  },
  'fashion-mnist': {
    id: 'fashion-mnist',
    name: 'Fashion-MNIST',
    subject: 'Clothing recognition',
    inputTitle: 'Mystery clothing',
    outputTitle: 'Clothing guess',
    question: 'What is it?',
    classes: [
      'T-shirt/top',
      'Trouser',
      'Pullover',
      'Dress',
      'Coat',
      'Sandal',
      'Shirt',
      'Sneaker',
      'Bag',
      'Ankle boot',
    ],
    symbols: ['T', 'Tr', 'P', 'D', 'C', 'Sa', 'Sh', 'Sn', 'B', 'Ab'],
    drawable: false,
    torchvision: 'FashionMNIST',
    source: 'https://github.com/zalandoresearch/fashion-mnist',
    credit: 'Han Xiao, Kashif Rasul and Roland Vollgraf, Zalando Research (2017). MIT license.',
  },
};
/** Saves made before datasets were introduced always used MNIST. */
export function experimentDataset(run: { dataset?: DatasetId }): Dataset {
  return DATASETS[run.dataset ?? 'mnist'] ?? DATASETS.mnist;
}
