import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { BlockNode, Board, compileBoard } from './graph';
import { pytorchModel, pytorchNotebook, pytorchScript } from './pytorch-export';

function compiled(middle: Partial<BlockNode>[]) {
  const nodes = [
    { kind: 'image' },
    { kind: 'flatten' },
    ...middle,
    { kind: 'dense', units: 10 },
    { kind: 'softmax' },
    { kind: 'classifier' },
  ].map((node, i) => ({ ...node, id: String(i), x: 0, y: i * 250 }) as BlockNode);
  const board: Board = {
    nodes: [...nodes].reverse().concat({ id: 'loose', kind: 'dense', units: 128, x: 800, y: 0 }),
    edges: nodes.slice(1).map((node, i) => ({ from: nodes[i].id, to: node.id })),
    viewport: { x: 0, y: 0, zoom: 1 },
  };
  return compileBoard(board).network!;
}

test('PyTorch export follows connections, infers widths and leaves classification as logits', () => {
  const network = compiled([
    { kind: 'dense', units: 64 },
    { kind: 'activation', activation: 'relu' },
    { kind: 'dense', units: 16 },
  ]);
  const code = pytorchModel(network);
  assert.match(
    code,
    /nn.Flatten\(start_dim=1\)[\s\S]*nn.Linear\(784, 64\)[\s\S]*nn.ReLU\(\)[\s\S]*nn.Linear\(64, 16\)[\s\S]*nn.Linear\(16, 10\)/,
  );
  assert.match(code, /== 51450/);
  assert.doesNotMatch(code, /128|nn.Softmax/);
  assert.match(pytorchScript(network), /nn.CrossEntropyLoss\(\)/);
  assert.match(pytorchScript(network), /\.softmax\(dim=1\)/);
});

test('all separate activations and the minimal classifier export correctly', () => {
  for (const [activation, name] of Object.entries({
    linear: 'Identity',
    sigmoid: 'Sigmoid',
    tanh: 'Tanh',
    relu: 'ReLU',
  })) {
    const code = pytorchModel(
      compiled([{ kind: 'activation', activation: activation as BlockNode['activation'] }]),
    );
    assert.ok(code.includes(`nn.${name}()`));
    assert.ok(code.includes('nn.Linear(784, 10)'));
  }
  assert.match(pytorchModel(compiled([])), /== 7850/);
});

test('Colab notebook and Python script share the complete executable recipe', () => {
  const network = compiled([{ kind: 'dense', units: 32 }]);
  const notebook = JSON.parse(pytorchNotebook(network));
  const script = pytorchScript(network);
  assert.equal(notebook.nbformat, 4);
  assert.equal(notebook.metadata.kernelspec.name, 'python3');
  const cells = notebook.cells.filter((cell: { cell_type: string }) => cell.cell_type === 'code');
  assert.equal(cells.length, 5);
  for (const cell of cells) {
    assert.equal(cell.execution_count, null);
    assert.deepEqual(cell.outputs, []);
    const source = cell.source.join('');
    if (!source.startsWith('%pip')) assert.ok(script.includes(source));
  }
  assert.match(script, /random.Random\(1958\).sample\(range\(len\(train_data\)\), 3000\)/);
  assert.match(script, /random.Random\(1958\).sample\(range\(len\(test_data\)\), 500\)/);
  assert.match(script, /range\(5\)/);
  assert.match(script, /lr=0.003/);
  assert.match(script, /model.eval\(\)/);
  assert.match(script, /with torch.no_grad\(\)/);
  assert.doesNotMatch(script, /%pip/);
});
