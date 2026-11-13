import { MatIcon } from '@angular/material/icon';
import { Dataset, DATASETS } from '../../learning/datasets';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { DecimalPipe, PercentPipe } from '@angular/common';
import { DigitPreview } from '../../learning/digit-preview/digit-preview';
import { BlockIcon } from '../block-icon/block-icon';
import { blockName } from '../block-catalog';
import { ACTIVATIONS, Activation } from '../../learning/curriculum';
import { CONTEXT, VOCAB_SIZE } from '../../learning/shakespeare';
import {
  BLOCKS,
  BlockNode,
  FRAME,
  HEAD_CHOICES,
  MAX_DENSE_INPUTS,
  MAX_DENSE_UNITS,
  MAX_NAME_LENGTH,
  MAX_REPEAT,
  customBlockName,
  expandCustom,
  nodeSize,
  validDenseInputs,
  validDenseUnits,
} from '../graph';
@Component({
  selector: 'app-block-card',
  host: { '[style.width.px]': 'size().width' },
  imports: [MatIcon, PercentPipe, DecimalPipe, DigitPreview, BlockIcon],
  templateUrl: './block-card.html',
  styleUrl: './block-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockCard {
  readonly dataset = input<Dataset>(DATASETS.mnist);
  readonly node = input.required<BlockNode>();
  readonly inputSize = input<number>();
  /** True when a wire feeds this block, so the wire dictates the input size. */
  readonly inputWired = input(false);
  readonly outputSize = input<number>();
  readonly selected = input(false);
  readonly busy = input(false);
  readonly pixels = input<Float32Array>();
  readonly actual = input<number>();
  readonly custom = input(false);
  /** Drawn inside an expanded custom block: no delete button, edits go to the parent. */
  readonly nested = input(false);
  /** Text level: one practice question, and what the writer has written so far. */
  readonly snippet = input<{ letters: string; next: string } | null>(null);
  readonly written = input<{ prompt: string; text: string; caption: string } | null>(null);
  readonly writing = input(false);
  readonly trained = input(false);
  readonly prompt = input('');
  readonly temperature = input(0.8);
  readonly write = output<void>();
  readonly stopWrite = output<void>();
  readonly promptChange = output<string>();
  readonly temperatureChange = output<number>();
  readonly context = CONTEXT;
  readonly vocab = VOCAB_SIZE;
  readonly headChoices = HEAD_CHOICES;
  readonly textWorld = computed(() => this.dataset().kind === 'text');
  /** Newlines and spaces drawn so a player can see them. */
  readonly visible = (letters: string) => letters.replace(/\n/g, '↵\n');
  readonly showNext = (letter: string) => (letter === '\n' ? '↵' : letter === ' ' ? '␣' : letter);
  /** Learnable numbers in this text block, given the width flowing in. */
  readonly textWeights = computed(() => {
    const width = this.inputSize(),
      node = this.node();
    if (node.kind === 'embedding') return VOCAB_SIZE * (node.units ?? 0);
    if (width === undefined) return undefined;
    if (node.kind === 'position') return CONTEXT * width;
    if (node.kind === 'layernorm') return 2 * width;
    if (node.kind === 'attention') return 4 * (width * width + width);
    return 0;
  });
  readonly frame = FRAME;
  readonly maxDenseUnits = MAX_DENSE_UNITS;
  readonly maxDenseInputs = MAX_DENSE_INPUTS;
  readonly maxRepeat = MAX_REPEAT;
  readonly maxNameLength = MAX_NAME_LENGTH;
  readonly takeApart = output<void>();
  readonly draw = output<void>();
  readonly probabilities = input<number[]>([]);
  readonly choose = output<MouseEvent>();
  readonly remove = output<void>();
  readonly nextDigit = output<void>();
  readonly configure = output<Partial<BlockNode> & { id: string }>();
  readonly definition = computed(() => BLOCKS[this.node().kind]);
  readonly size = computed(() => nodeSize(this.node()));
  readonly expanded = computed(() => this.node().kind === 'custom' && !!this.node().expanded);
  /** The recipe as full blocks with the vector sizes flowing between them. */
  readonly innerCards = computed(() => {
    let width = this.inputSize();
    return (this.node().blocks ?? []).map((inner) => {
      const input = width;
      width = inner.kind === 'dense' ? inner.units : width;
      return { node: { ...inner, x: 0, y: 0 } as BlockNode, input, output: width };
    });
  });
  readonly prediction = computed(() =>
    this.probabilities().length
      ? this.probabilities().indexOf(Math.max(...this.probabilities()))
      : null,
  );
  readonly name = computed(() => blockName(this.node(), this.dataset()));
  readonly activationDetail = computed(
    () =>
      ({
        linear: 'Keep every value',
        sigmoid: 'Between 0 and 1',
        tanh: 'Between −1 and 1',
        relu: 'Keep positives. Zero negatives.',
      })[this.node().activation ?? 'linear'],
  );
  /** The editable first part of the title; the card always adds "block" after it. */
  readonly baseName = computed(() => customBlockName(this.node().name));
  readonly repeat = computed(() => this.node().repeat ?? 1);
  /** "784 → 64 · 3 layers · 58,560 weights", counting every copy. */
  readonly customDetail = computed(() => {
    const layers = expandCustom(this.node()).filter((b) => b.kind === 'dense');
    const count = `${layers.length} layer${layers.length === 1 ? '' : 's'}`;
    let width = this.inputSize();
    if (width === undefined) return `Needs a vector · ${count}`;
    let weights = 0;
    for (const layer of layers) {
      weights += (width + 1) * layer.units!;
      width = layer.units!;
    }
    return `${this.inputSize()} → ${width} · ${count} · ${weights.toLocaleString('en-US')} weights`;
  });
  activationName(activation?: Activation): string {
    return ACTIVATIONS.find((a) => a.value === activation)?.label ?? 'Activation';
  }
  toggleExpanded(): void {
    this.configure.emit({ id: this.node().id, expanded: !this.node().expanded });
  }
  /** An inner Dense card changed its neurons: rewrite this custom block's recipe. */
  configureInner(change: Partial<BlockNode> & { id: string }): void {
    if (change.units === undefined) return;
    const blocks = this.node().blocks ?? [];
    if (!blocks.some((b) => b.id === change.id && b.units !== change.units)) return;
    this.configure.emit({
      id: this.node().id,
      blocks: blocks.map((b) => (b.id === change.id ? { ...b, units: change.units } : b)),
    });
  }
  setRepeat(repeat: number): void {
    if (repeat >= 1 && repeat <= MAX_REPEAT) this.configure.emit({ id: this.node().id, repeat });
  }
  /** Text being typed into the name field; a hidden copy of it sizes the field. */
  readonly typedName = signal<string | null>(null);
  rename(event: Event): void {
    this.typedName.set(null);
    const field = event.target as HTMLInputElement;
    const name = customBlockName(field.value).slice(0, MAX_NAME_LENGTH);
    field.value = name;
    if (name !== customBlockName(this.node().name))
      this.configure.emit({ id: this.node().id, name: name || undefined });
  }
  changeInnerUnits(event: Event, index: number): void {
    const field = event.target as HTMLInputElement;
    const units = field.valueAsNumber;
    const blocks = this.node().blocks ?? [];
    if (!validDenseUnits(units)) {
      field.value = String(blocks[index]?.units ?? '');
      return;
    }
    if (units === blocks[index]?.units) return;
    this.configure.emit({
      id: this.node().id,
      blocks: blocks.map((b, i) => (i === index ? { ...b, units } : b)),
    });
  }
  stopControls(event: Event): void {
    if ((event.target as HTMLElement).closest('button,select,input,textarea'))
      event.stopPropagation();
  }
  changeInputs(event: Event): void {
    if (this.inputWired()) return;
    const field = event.target as HTMLInputElement;
    const inputs = field.valueAsNumber;
    if (validDenseInputs(inputs)) {
      if (inputs !== this.node().inputs) this.configure.emit({ id: this.node().id, inputs });
    } else field.value = this.node().inputs === undefined ? '' : String(this.node().inputs);
  }
  setHeads(heads: number): void {
    if (heads !== this.node().heads) this.configure.emit({ id: this.node().id, heads });
  }
  changePrompt(event: Event): void {
    this.promptChange.emit((event.target as HTMLTextAreaElement).value);
  }
  changeTemperature(event: Event): void {
    this.temperatureChange.emit((event.target as HTMLInputElement).valueAsNumber);
  }
  changeUnits(event: Event): void {
    const field = event.target as HTMLInputElement;
    const units = field.valueAsNumber;
    if (validDenseUnits(units)) this.configure.emit({ id: this.node().id, units });
    else field.value = String(this.node().units);
  }
}
