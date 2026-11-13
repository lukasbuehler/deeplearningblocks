import { MatIcon } from '@angular/material/icon';
import { Dataset, DATASETS } from '../../learning/datasets';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { PercentPipe } from '@angular/common';
import { DigitPreview } from '../../learning/digit-preview/digit-preview';
import { BlockIcon } from '../block-icon/block-icon';
import { blockName } from '../block-catalog';
import { ACTIVATIONS, Activation } from '../../learning/curriculum';
import {
  BLOCKS,
  BlockNode,
  FRAME,
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
/** Pixels between the edges of stacked copies of a repeated custom block. */
export const STACK_STEP = 5;
@Component({
  selector: 'app-block-card',
  host: {
    '[style.width.px]': 'size().width',
    '(document:pointerdown)': 'closeHelp($event)',
    '(document:keydown.escape)': 'helpOpen.set(false)',
    '[class.help-open]': 'helpOpen()',
  },
  imports: [MatIcon, PercentPipe, DigitPreview, BlockIcon],
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
  readonly frame = FRAME;
  readonly maxDenseUnits = MAX_DENSE_UNITS;
  readonly maxDenseInputs = MAX_DENSE_INPUTS;
  readonly maxRepeat = MAX_REPEAT;
  readonly maxNameLength = MAX_NAME_LENGTH;
  readonly takeApart = output<void>();
  readonly draw = output<void>();
  readonly probabilities = input<number[]>([]);
  readonly choose = output<MouseEvent>();
  readonly nextDigit = output<void>();
  readonly configure = output<Partial<BlockNode> & { id: string }>();
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
  /** The "?" bubble: what this block does, in plain words. */
  readonly helpOpen = signal(false);
  readonly help = computed(() =>
    this.node().kind === 'activation'
      ? (ACTIVATIONS.find((a) => a.value === this.node().activation)?.explanation ??
        BLOCKS.activation.help)
      : BLOCKS[this.node().kind].help,
  );
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  closeHelp(event: PointerEvent): void {
    if (this.helpOpen() && !this.host.nativeElement.contains(event.target as Node))
      this.helpOpen.set(false);
  }
  /**
   * Repeated custom blocks look like a stack with one card edge per copy.
   * Each copy adds an orange edge with its own black outline, offset a little further.
   */
  readonly stackShadow = computed(() => {
    const copies = this.node().kind === 'custom' ? this.repeat() : 1;
    const layers = ['6px 6px 0 #171717'];
    for (let i = 1; i < copies; i++) {
      const offset = 6 + i * STACK_STEP;
      layers.push(`${offset}px ${offset}px 0 -3px #ffb86b`, `${offset}px ${offset}px 0 0 #171717`);
    }
    return layers.join(', ');
  });
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
    if ((event.target as HTMLElement).closest('button,select,input')) event.stopPropagation();
  }
  changeInputs(event: Event): void {
    if (this.inputWired()) return;
    const field = event.target as HTMLInputElement;
    const inputs = field.valueAsNumber;
    if (validDenseInputs(inputs)) {
      if (inputs !== this.node().inputs) this.configure.emit({ id: this.node().id, inputs });
    } else field.value = this.node().inputs === undefined ? '' : String(this.node().inputs);
  }
  changeUnits(event: Event): void {
    const field = event.target as HTMLInputElement;
    const units = field.valueAsNumber;
    if (validDenseUnits(units)) this.configure.emit({ id: this.node().id, units });
    else field.value = String(this.node().units);
  }
}
