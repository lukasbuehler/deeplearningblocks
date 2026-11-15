import { CdkDrag, CdkDragEnd, CdkDragMove } from '@angular/cdk/drag-drop';
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
import {
  blockOutline,
  recipeWellOutline,
  connectorLabels,
  connectorEdgePath,
  nodeConnectors,
} from '../block-connectors';
import { ACTIVATIONS, Activation } from '../../learning/curriculum';
import {
  BLOCKS,
  BlockNode,
  FRAME,
  customLayout,
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
  host: {
    '[style.width.px]': 'size().width',
    '(document:pointerdown)': 'closeHelp($event)',
    '(document:keydown.escape)': 'helpOpen.set(false)',
    '[class.help-open]': 'helpOpen()',
  },
  imports: [CdkDrag, MatIcon, PercentPipe, DigitPreview, BlockIcon],
  templateUrl: './block-card.html',
  styleUrl: './block-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockCard {
  readonly dataset = input<Dataset>(DATASETS.mnist);
  readonly node = input.required<BlockNode>();
  readonly zoom = input(1);
  readonly inputFeedback = input<'valid' | 'invalid' | null>(null);
  readonly outputFeedback = input<'valid' | 'invalid' | null>(null);
  readonly recipeFeedback = input<'valid' | 'invalid' | null>(null);
  readonly innerMove = output<{ id: string; point: { x: number; y: number } }>();
  previewInnerDrag(event: CdkDragMove, id: string): void {
    this.innerMove.emit({ id, point: event.pointerPosition });
  }
  readonly inputEdge = computed(() =>
    connectorEdgePath(this.connectors().input, this.size().width, 0),
  );
  readonly outputEdge = computed(() =>
    connectorEdgePath(this.connectors().output, this.size().width, this.size().height),
  );
  readonly innerDrop = output<{
    id: string;
    point: { x: number; y: number };
    drop: { x: number; y: number };
  }>();
  finishInnerDrag(event: CdkDragEnd, id: string): void {
    const rect = event.source.element.nativeElement.getBoundingClientRect();
    this.innerDrop.emit({ id, point: { x: rect.left, y: rect.top }, drop: event.dropPoint });
    event.source.setFreeDragPosition({ x: 0, y: 0 });
  }
  readonly layout = computed(() => customLayout(this.node()));
  readonly connectorShape = input<ReturnType<typeof nodeConnectors>>();
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
    let incoming = this.connectors().input;
    return expandCustom(this.node()).map((inner, index) => {
      const input = width;
      width = inner.kind === 'dense' ? inner.units : width;
      const node = { ...inner, x: 0, y: 0 } as BlockNode;
      const connectors = nodeConnectors(node, input, width, incoming, true);
      incoming = connectors.output;
      return {
        node,
        input,
        output: width,
        connectors,
        key: `${index}-${inner.id}`,
        copy: Math.floor(index / this.node().blocks!.length) + 1,
        firstInCopy: index % this.node().blocks!.length === 0,
      };
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
  readonly connectors = computed(
    () =>
      this.connectorShape() ??
      nodeConnectors(
        this.node(),
        this.inputSize(),
        this.outputSize(),
        undefined,
        this.inputWired(),
      ),
  );
  readonly outline = computed(() =>
    blockOutline(
      this.size().width,
      this.size().height,
      this.connectors().input,
      this.connectors().output,
    ),
  );
  readonly connectorLabels = computed(() => [
    ...connectorLabels(this.connectors().input, this.size().width, 0),
    ...connectorLabels(this.connectors().output, this.size().width, this.size().height),
  ]);
  readonly editableCards = computed(() => this.innerCards().filter((c) => c.copy === 1));
  readonly copyGroups = computed(() =>
    this.expanded()
      ? Array.from({ length: this.repeat() - 1 }, (_, i) => ({
          number: i + 2,
          top: this.layout().copiesTop + i * this.layout().copyHeight,
          cards: this.innerCards().filter((c) => c.copy === i + 2),
        }))
      : [],
  );
  readonly wells = computed(() => {
    const groups = [
      { top: FRAME.head - FRAME.neck, cards: this.editableCards() },
      ...this.copyGroups().map((g) => ({ top: g.top + 24, cards: g.cards })),
    ];
    return groups.map((g) => ({
      top: g.top,
      path: recipeWellOutline(
        330 + 2 * FRAME.inset,
        this.layout().recipeHeight + 2 * FRAME.neck,
        FRAME.inset,
        FRAME.neck,
        g.cards[0]?.connectors.input ?? this.connectors().input,
        g.cards.at(-1)?.connectors.output ?? this.connectors().input,
      ),
    }));
  });
  updateRepeat(event: Event): void {
    const repeat = (event.target as HTMLInputElement).valueAsNumber;
    if (Number.isInteger(repeat) && repeat >= 1 && repeat <= MAX_REPEAT) this.setRepeat(repeat);
  }
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
  changeRepeat(event: Event): void {
    const field = event.target as HTMLInputElement;
    const repeat = field.valueAsNumber;
    if (Number.isInteger(repeat) && repeat >= 1 && repeat <= MAX_REPEAT) this.setRepeat(repeat);
    else field.value = String(this.repeat());
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
  stopControls(event: Event): void {
    if ((event.target as HTMLElement).closest('button,select,input')) event.stopPropagation();
  }
  updateInputs(event: Event): void {
    const inputs = (event.target as HTMLInputElement).valueAsNumber;
    if (!this.inputWired() && validDenseInputs(inputs) && inputs !== this.node().inputs)
      this.configure.emit({ id: this.node().id, inputs });
  }
  updateUnits(event: Event): void {
    const units = (event.target as HTMLInputElement).valueAsNumber;
    if (validDenseUnits(units) && units !== this.node().units)
      this.configure.emit({ id: this.node().id, units });
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
