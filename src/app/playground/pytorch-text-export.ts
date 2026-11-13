import {
  CONTEXT,
  SHAKESPEARE_ALPHABET,
  SHAKESPEARE_SOURCE,
  TEXT_TRAINING,
  VOCAB_SIZE,
} from '../learning/shakespeare';
import { NetworkSpec, describeNetwork } from './graph';

const activations = {
  linear: 'nn.Identity()',
  sigmoid: 'nn.Sigmoid()',
  tanh: 'nn.Tanh()',
  relu: 'nn.ReLU()',
};

const helpers = `class Position(nn.Module):
    """Add a learned list of numbers for each seat (position) in the window."""

    def __init__(self, width):
        super().__init__()
        self.seats = nn.Embedding(CONTEXT, width)

    def forward(self, x):
        return x + self.seats(torch.arange(x.shape[1], device=x.device))


class SelfAttention(nn.Module):
    """Causal multi-head self-attention: each letter looks only at itself and earlier letters."""

    def __init__(self, width, heads):
        super().__init__()
        self.heads = heads
        self.query = nn.Linear(width, width)
        self.key = nn.Linear(width, width)
        self.value = nn.Linear(width, width)
        self.project = nn.Linear(width, width)

    def forward(self, x):
        batch, letters, width = x.shape
        def split(t):  # [batch, letters, width] -> [batch, heads, letters, head size]
            return t.view(batch, letters, self.heads, width // self.heads).transpose(1, 2)
        q, k, v = split(self.query(x)), split(self.key(x)), split(self.value(x))
        # is_causal=True is the no-peeking curtain. Scores are scaled by 1/sqrt(head size).
        mixed = nn.functional.scaled_dot_product_attention(q, k, v, is_causal=True)
        return self.project(mixed.transpose(1, 2).reshape(batch, letters, width))
`;

/** A PyTorch module whose forward() follows the board's wires, shortcuts included. */
export function pytorchTextModel(network: NetworkSpec): string {
  const widths: number[] = [];
  const modules: string[] = [];
  const lines: string[] = [];
  let result = '';
  network.steps.forEach((step, i) => {
    const from = step.from ?? i - 1;
    const input = from < 0 ? 'ids' : `x${from}`;
    const width = from < 0 ? 0 : widths[from];
    const name = `self.${step.kind}${i}`;
    let out = width;
    switch (step.kind) {
      case 'embedding':
        modules.push(`${name} = nn.Embedding(VOCAB_SIZE, ${step.units})  # Letter embedding`);
        lines.push(`x${i} = ${name}(${input})  # ${CONTEXT} letters x ${step.units} numbers`);
        out = step.units;
        break;
      case 'position':
        modules.push(`${name} = Position(${width})`);
        lines.push(`x${i} = ${name}(${input})`);
        break;
      case 'layernorm':
        modules.push(`${name} = nn.LayerNorm(${width})`);
        lines.push(`x${i} = ${name}(${input})`);
        break;
      case 'attention':
        modules.push(`${name} = SelfAttention(${width}, heads=${step.heads})`);
        lines.push(`x${i} = ${name}(${input})`);
        break;
      case 'dense':
        modules.push(
          `${name} = nn.Linear(${width}, ${step.units})  # Dense, applied to each letter`,
        );
        lines.push(`x${i} = ${name}(${input})`);
        out = step.units;
        break;
      case 'activation':
        modules.push(`${name} = ${activations[step.activation]}`);
        lines.push(`x${i} = ${name}(${input})`);
        break;
      case 'add':
        lines.push(`x${i} = ${input} + x${step.skip}  # Add: the shortcut joins here`);
        break;
      case 'softmax':
        // Letter scores leave the model; softmax happens in the loss and while writing.
        result = input;
        break;
      default:
        throw new Error(`${step.kind} belongs in a picture network.`);
    }
    widths.push(out);
  });
  return `import torch
from torch import nn

VOCAB_SIZE = ${VOCAB_SIZE}  # letters in the alphabet
CONTEXT = ${CONTEXT}  # letters the model sees at once


${helpers}

class YourModel(nn.Module):
    """${describeNetwork(network)}"""

    def __init__(self):
        super().__init__()
${modules.map((m) => `        ${m}`).join('\n')}

    def forward(self, ids):
${lines.map((l) => `        ${l}`).join('\n')}
        return ${result}  # letter scores; softmax happens in the loss and while writing


model = YourModel()
assert sum(p.numel() for p in model.parameters()) == ${network.parameters}
print(model)
`;
}

const dataCode = `import urllib.request
import torch

torch.manual_seed(2017)
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print("Training on:", device)

# Tiny Shakespeare from char-rnn (Andrej Karpathy, 2015, MIT license). Public-domain plays.
text = urllib.request.urlopen("${SHAKESPEARE_SOURCE}").read().decode("utf-8")
alphabet = ${JSON.stringify(SHAKESPEARE_ALPHABET)}
assert "".join(sorted(set(text))) == alphabet
to_id = {letter: i for i, letter in enumerate(alphabet)}
data = torch.tensor([to_id[letter] for letter in text], dtype=torch.long)
# The first 90% teaches the model. The last 10% is held out, like in the playground.
cut = int(0.9 * len(data))
train_data, validation_data = data[:cut], data[cut:]


def get_batch(region, batch_size=${TEXT_TRAINING.batch}):
    """Random windows. Each target is the letter right after its input letter."""
    starts = torch.randint(len(region) - CONTEXT - 1, (batch_size,))
    x = torch.stack([region[s:s + CONTEXT] for s in starts])
    y = torch.stack([region[s + 1:s + CONTEXT + 1] for s in starts])
    return x.to(device), y.to(device)
`;

const roundSize = TEXT_TRAINING.steps / TEXT_TRAINING.rounds;
const trainingCode = `model = model.to(device)
optimizer = torch.optim.Adam(model.parameters(), lr=${TEXT_TRAINING.learningRate}, eps=1e-7)
loss_function = nn.CrossEntropyLoss()


def score(region, batches=8):
    model.eval()
    with torch.no_grad():
        losses = [loss_function(model(x).flatten(0, 1), y.flatten()).item()
                  for x, y in (get_batch(region) for _ in range(batches))]
    model.train()
    return sum(losses) / len(losses)


# ${TEXT_TRAINING.steps} practice steps in ${TEXT_TRAINING.rounds} rounds, just like the playground.
for step in range(${TEXT_TRAINING.steps}):
    x, y = get_batch(train_data)
    loss = loss_function(model(x).flatten(0, 1), y.flatten())
    optimizer.zero_grad()
    loss.backward()
    optimizer.step()
    if (step + 1) % ${roundSize} == 0:
        print(f"Round {(step + 1) // ${roundSize}}/${TEXT_TRAINING.rounds} | held-out loss: {score(validation_data):.3f}")
`;

const writingCode = `@torch.no_grad()
def write(prompt="ROMEO:\\n", letters=300, temperature=0.8):
    """Pick one letter at a time. Lower temperature plays safe; higher takes chances."""
    model.eval()
    ids = [to_id[letter] for letter in prompt if letter in to_id] or [0]
    for _ in range(letters):
        context = torch.tensor([ids[-CONTEXT:]], device=device)
        scores = model(context)[0, -1] / temperature
        ids.append(torch.multinomial(scores.softmax(dim=-1), 1).item())
    return "".join(alphabet[i] for i in ids)


print(write())
`;

export function pytorchTextScript(network: NetworkSpec): string {
  return `# Deep Learning Blocks | Your Shakespeare transformer
# Install once: python -m pip install torch
# Run: python deep-learning-blocks.py
# Fresh weights and the same recipe as the browser. Results will differ.

${dataCode}\n${pytorchTextModel(network)}\n${trainingCode}\n${writingCode}`;
}

/** Notebook cells, in order, for the shared notebook writer. */
export function pytorchTextCells(network: NetworkSpec): ['markdown' | 'code', string][] {
  return [
    [
      'markdown',
      `# Deep Learning Blocks: your Shakespeare transformer

This notebook contains the blocks you connected and the playground's training recipe.
It starts with **fresh weights**: browser-trained weights are not included. Run each cell from top
to bottom, or choose **Runtime > Run all** in Google Colab. A GPU helps, but a CPU works too.
`,
    ],
    ['code', '%pip install -q torch\n'],
    [
      'markdown',
      `## 1. Meet Tiny Shakespeare
About 40,000 lines from Shakespeare's plays, prepared by Andrej Karpathy for char-rnn (2015, MIT license). The model reads ${CONTEXT} letters and practices guessing each next letter.
`,
    ],
    ['code', dataCode],
    [
      'markdown',
      `## 2. Your blocks, in order
${network.parameters.toLocaleString('en-US')} learnable parameters. Each Add is a shortcut wire from your board. [CrossEntropyLoss](https://docs.pytorch.org/docs/stable/generated/torch.nn.CrossEntropyLoss.html) takes raw letter scores, so softmax happens in the loss and while writing.
`,
    ],
    ['code', pytorchTextModel(network)],
    [
      'markdown',
      '## 3. Let it practice\nA lower held-out loss means better next-letter guesses on text the model never practiced on.\n',
    ],
    ['code', trainingCode],
    [
      'markdown',
      '## 4. Let it write\nChange the prompt or the temperature and run the cell again. Funny words are normal for a tiny model.\n',
    ],
    ['code', writingCode],
  ];
}
