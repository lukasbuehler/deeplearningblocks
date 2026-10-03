import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { ACTIVATIONS, Activation, DenseBlock, parameterCount } from '../curriculum';

@Component({
  selector: 'app-network-editor',
  imports: [DecimalPipe, DragDropModule, FormsModule],
  templateUrl: './network-editor.html',
  styleUrl: './network-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NetworkEditor {
  readonly blocks = input.required<DenseBlock[]>();
  readonly era = input.required<number>();
  readonly tips = input(false);
  readonly busy = input(false);
  readonly blocksChange = output<DenseBlock[]>();
  readonly parameters = computed(() => parameterCount(this.blocks()));
  readonly activations = computed(() => ACTIVATIONS.filter((a) => a.era <= this.era()));
  addBlock(): void {
    if (this.blocks().length >= 3) return;
    this.change([
      ...this.blocks(),
      {
        id: Math.max(0, ...this.blocks().map((b) => b.id)) + 1,
        units: 32,
        activation: this.era() === 0 ? 'linear' : this.era() === 1 ? 'sigmoid' : 'relu',
      },
    ]);
  }
  removeBlock(id: number): void {
    this.change(this.blocks().filter((block) => block.id !== id));
  }
  updateBlock(id: number, key: 'units' | 'activation', value: string | number): void {
    this.change(
      this.blocks().map((block) =>
        block.id === id
          ? { ...block, [key]: key === 'units' ? +value : (value as Activation) }
          : block,
      ),
    );
  }
  move(index: number, direction: number): void {
    const blocks = [...this.blocks()];
    moveItemInArray(blocks, index, index + direction);
    this.change(blocks);
  }
  drop(event: CdkDragDrop<DenseBlock[]>): void {
    const blocks = [...this.blocks()];
    moveItemInArray(blocks, event.previousIndex, event.currentIndex);
    this.change(blocks);
  }
  private change(blocks: DenseBlock[]): void {
    if (!this.busy()) this.blocksChange.emit(blocks);
  }
  activationHint(activation: Activation): string {
    return ACTIVATIONS.find((a) => a.value === activation)!.explanation;
  }
}
