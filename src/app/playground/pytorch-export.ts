import { Dataset, DATASETS } from '../learning/datasets';
import type { NetworkSpec } from './graph';
import { pytorchTextCells, pytorchTextModel, pytorchTextScript } from './pytorch-text-export';

const activations = { linear: 'Identity', sigmoid: 'Sigmoid', tanh: 'Tanh', relu: 'ReLU' };

/** Consume the compiled path, never node positions or loose blocks. */
export function pytorchModel(network: NetworkSpec): string {
  if (network.world === 'text') return pytorchTextModel(network);
  let width = 784;
  const layers = network.steps.map((step): string => {
    switch (step.kind) {
      case 'flatten':
        return '    nn.Flatten(start_dim=1),  # 1 x 28 x 28 pixels -> 784 numbers';
      case 'dense': {
        const layer = `    nn.Linear(${width}, ${step.units}),`;
        width = step.units;
        return layer;
      }
      case 'activation':
        return `    nn.${activations[step.activation]}(),`;
      case 'softmax':
        return '    # Softmax block: applied in the prediction cell, after training on logits.';
      default:
        throw new Error(`${step.kind} belongs in a text network.`);
    }
  });
  return `from torch import nn

model = nn.Sequential(
${layers.join('\n')}
)

# The output block is only a display, so it adds no layer.
# CrossEntropyLoss includes the softmax calculation during training.
# For a prediction, turn scores into probabilities with logits.softmax(dim=1).
assert sum(p.numel() for p in model.parameters()) == ${network.parameters}
print(model)
`;
}

const dataCode = (dataset: Dataset) => `import random
import torch
from torch.utils.data import DataLoader, Subset
from torchvision import datasets, transforms

class_names = ${JSON.stringify(dataset.classes)}
torch.manual_seed(1958)
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print("Training on:", device)

# ToTensor keeps grayscale pixels in [0, 1]. PyTorch uses [batch, 1, 28, 28].
# Resetting the Python seed for each split reproduces the playground's subset.
train_data = datasets.${dataset.torchvision}("data", train=True, download=True, transform=transforms.ToTensor())
test_data = datasets.${dataset.torchvision}("data", train=False, download=True, transform=transforms.ToTensor())
train_subset = Subset(train_data, random.Random(1958).sample(range(len(train_data)), 3000))
test_subset = Subset(test_data, random.Random(1958).sample(range(len(test_data)), 500))
train_loader = DataLoader(train_subset, batch_size=64, shuffle=True,
                          generator=torch.Generator().manual_seed(1958))
test_loader = DataLoader(test_subset, batch_size=64)
`;

const trainingCode = `model = model.to(device)
optimizer = torch.optim.Adam(model.parameters(), lr=0.003, eps=1e-7)
loss_function = nn.CrossEntropyLoss()

# Five passes through the training images, just like the playground.
for epoch in range(5):
    model.train()
    total_loss = 0.0
    for images, labels in train_loader:
        images, labels = images.to(device), labels.to(device)
        optimizer.zero_grad()
        logits = model(images)
        loss = loss_function(logits, labels)
        loss.backward()
        optimizer.step()
        total_loss += loss.item() * len(labels)
    print(f"Pass {epoch + 1}/5 | training loss: {total_loss / len(train_subset):.4f}")
`;

const evaluationCode = `# These 500 images were never used to update the weights.
model.eval()
correct = 0
with torch.no_grad():
    for images, labels in test_loader:
        guesses = model(images.to(device)).argmax(dim=1)
        correct += (guesses == labels.to(device)).sum().item()
print(f"Held-out accuracy: {100 * correct / len(test_subset):.1f}%")

# Change sample_index to try a different held-out image (0 to 499).
sample_index = 0
image, label = test_subset[sample_index]
with torch.no_grad():
    probabilities = model(image.unsqueeze(0).to(device)).softmax(dim=1)[0].cpu()
print(f"Actual: {class_names[label]} | guessed: {class_names[probabilities.argmax().item()]}")
for index, probability in enumerate(probabilities):
    print(f"  {class_names[index]}: {probability.item():.1%}")
`;

const intro = (dataset: Dataset) => `# Deep Learning Blocks: from blocks to Python

This notebook contains your connected network and the playground's training recipe.
Loose blocks are excluded. It starts with **fresh weights**: browser-trained weights,
drawings, progress and notebook results are not included. Scores will differ because
PyTorch and TensorFlow initialize and train their weights differently.

Run each cell from top to bottom, or choose **Runtime > Run all** in Google Colab.
The first run downloads ${dataset.name}. Try changing one layer and running the notebook again.
`;

export function pytorchScript(network: NetworkSpec, dataset: Dataset = DATASETS.mnist): string {
  if (network.world === 'text') return pytorchTextScript(network);
  return `# Deep Learning Blocks | Your connected network
# Install once: python -m pip install torch torchvision
# Run: python deep-learning-blocks.py
# Fresh weights, same 3000 training / 500 held-out images. Results will differ.

${dataCode(dataset)}\n${pytorchModel(network)}\n${trainingCode}\n${evaluationCode}`;
}

export function pytorchNotebook(network: NetworkSpec, dataset: Dataset = DATASETS.mnist): string {
  const cell = (cell_type: 'markdown' | 'code', source: string) => ({
    cell_type,
    metadata: {},
    source: source.match(/[^\n]*\n|[^\n]+$/g) ?? [],
    ...(cell_type === 'code' ? { execution_count: null, outputs: [] } : {}),
  });
  return (
    JSON.stringify(
      {
        nbformat: 4,
        nbformat_minor: 4,
        metadata: {
          kernelspec: { display_name: 'Python 3', language: 'python', name: 'python3' },
          language_info: { name: 'python' },
          colab: { name: 'deep-learning-blocks.ipynb', provenance: [] },
        },
        cells:
          network.world === 'text'
            ? pytorchTextCells(network).map(([type, source]) => cell(type, source))
            : [
                cell('markdown', intro(dataset)),
                cell('code', '%pip install -q torch torchvision\n'),
                cell(
                  'markdown',
                  `## 1. Meet ${dataset.name}\n${dataset.subject}. We use the same small, seeded subset as the playground.\n\n${dataset.credit} [Dataset source](${dataset.source}).\n`,
                ),
                cell('code', dataCode(dataset)),
                cell(
                  'markdown',
                  `## 2. Your blocks, in order\n${network.parameters.toLocaleString('en-US')} learnable parameters. Flatten makes a vector; Linear is your Dense block. The last Linear makes 10 scores.\n\n[CrossEntropyLoss](https://docs.pytorch.org/docs/stable/generated/torch.nn.CrossEntropyLoss.html) takes raw scores, so softmax belongs in the prediction cell.\n`,
                ),
                cell('code', pytorchModel(network)),
                cell(
                  'markdown',
                  '## 3. Let it learn\nEach pass adjusts the weights using training examples. A smaller loss means the model fits these examples better.\n',
                ),
                cell('code', trainingCode),
                cell(
                  'markdown',
                  '## 4. Try unseen images\nNow test on images that did not teach the model. A confident guess can still be wrong!\n',
                ),
                cell('code', evaluationCode),
              ],
      },
      null,
      2,
    ) + '\n'
  );
}
