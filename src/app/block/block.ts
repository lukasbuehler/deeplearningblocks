import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { CoreShapeComponent } from 'ng2-konva';
import rough from 'roughjs';

export interface BlockPositionPayload {
  id: string;
  x: number;
  y: number;
}

@Component({
  selector: 'app-block',
  imports: [CoreShapeComponent],
  templateUrl: './block.html',
  styleUrl: './block.scss',
})
export class Block {
  public readonly blockId = input.required<string>();
  public readonly x = input<number>(0);
  public readonly y = input<number>(0);
  public readonly width = input<number>(240);
  public readonly height = input<number>(120);
  public readonly fillColor = input<string>('#f87171');
  public readonly text = input<string>('Block');
  public readonly textColor = input<string>('#1f2937');
  public readonly cornerRadius = input<number>(16);
  public readonly draggable = input<boolean>(true);

  public readonly dragStart = output<BlockPositionPayload>();
  public readonly dragMove = output<BlockPositionPayload>();
  public readonly dragEnd = output<BlockPositionPayload>();

  private readonly blockCanvas = (() => {
    const canvas = document.createElement('canvas');
    return canvas;
  })();

  private readonly blockImage = signal<HTMLCanvasElement | null>(this.blockCanvas);

  constructor() {
    effect(() => {
      const width = this.width();
      const height = this.height();
      const fill = this.fillColor();
      const radius = this.cornerRadius();

      this.drawBlockCanvas(width, height, fill, radius);
      this.blockImage.set(this.blockCanvas);
    });
  }

  public readonly groupConfig = computed(() => ({
    id: this.blockId(),
    x: this.x(),
    y: this.y(),
    draggable: this.draggable(),
  }));

  public readonly imageConfig = computed(() => ({
    image: this.blockImage(),
    width: this.width(),
    height: this.height(),
    listening: false,
  }));

  public readonly textConfig = computed(() => ({
    text: this.text(),
    x: 0,
    y: 0,
    width: this.width(),
    height: this.height(),
    align: 'center',
    verticalAlign: 'middle',
    padding: 16,
    fontSize: 20,
    fontStyle: 'bold',
    fill: this.textColor(),
    listening: false,
  }));

  public onDragStart(event: any) {
    this.emitPosition(event, this.dragStart.emit.bind(this.dragStart));
  }

  public onDragMove(event: any) {
    this.emitPosition(event, this.dragMove.emit.bind(this.dragMove));
  }

  public onDragEnd(event: any) {
    this.emitPosition(event, this.dragEnd.emit.bind(this.dragEnd));
  }

  public onMouseEnter(event: any) {
    const stage = event.target?.getStage?.();
    if (stage) {
      stage.container().style.cursor = 'move';
    }
  }

  public onMouseLeave(event: any) {
    const stage = event.target?.getStage?.();
    if (stage) {
      stage.container().style.cursor = 'default';
    }
  }

  private emitPosition(event: any, callback: (payload: BlockPositionPayload) => void) {
    const node = event.target;
    if (!node) {
      return;
    }

    callback({
      id: this.blockId(),
      x: node.x(),
      y: node.y(),
    });
  }

  private drawBlockCanvas(width: number, height: number, fill: string, radius: number) {
    const canvas = this.blockCanvas;
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const rc = rough.canvas(canvas);
    const cornerRadius = Math.max(0, Math.min(radius, Math.min(width, height) / 2));

    if (cornerRadius === 0) {
      rc.rectangle(0, 0, width, height, {
        roughness: 1.5,
        fill,
        fillStyle: 'solid', //'hachure',
        fillWeight: 5,
        stroke: fill,
        strokeWidth: 4,
      });
      return;
    }

    const path = this.buildRoundedRectPath(width, height, cornerRadius);

    rc.path(path, {
      roughness: 1.5,
      fill,
      fillStyle: 'solid', //'hachure',
      fillWeight: 1,
      stroke: fill,
      strokeWidth: 5,
    });
    return;
  }

  private buildRoundedRectPath(width: number, height: number, radius: number) {
    const r = Math.min(radius, width / 2, height / 2);
    return `M${r},0 L${width - r},0 Q${width},0 ${width},${r} L${width},${height - r} Q${width},${height} ${width - r},${height} L${r},${height} Q0,${height} 0,${height - r} L0,${r} Q0,0 ${r},0 Z`;
  }
}
