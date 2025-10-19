import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  PLATFORM_ID,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { StageConfig } from 'konva/lib/Stage';
import { CoreShapeComponent, StageComponent } from 'ng2-konva';
import Konva from 'konva';
import rough from 'roughjs';
import { BlockPositionPayload } from '../block/block';

interface StageSize {
  width: number;
  height: number;
}

interface BlockModel {
  id: string;
  label: string;
  color: string;
  textColor: string;
  x: number;
  y: number;
  width: number;
  height: number;
  cornerRadius: number;
}

interface ConnectionModel {
  id: string;
  from: string;
  to: string;
  color: string;
}

interface ArrowViewModel {
  id: string;
  image: HTMLCanvasElement;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface BlockViewModel {
  id: string;
  x: number;
  y: number;
  blockImage: HTMLCanvasElement;
  width: number;
  height: number;
  text: string;
  textColor: string;
}

@Component({
  selector: 'app-container',
  imports: [StageComponent, CoreShapeComponent],
  templateUrl: './container.html',
  styleUrl: './container.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Container implements OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  public readonly isBrowser = computed(() => isPlatformBrowser(this.platformId));

  private readonly stageSize = signal<StageSize>({ width: 800, height: 600 });
  private readonly blockState = signal<BlockModel[]>([
    {
      id: 'red-block',
      label: 'Red Block',
      color: '#f87171',
      textColor: '#1f2937',
      x: 180,
      y: 220,
      width: 260,
      height: 140,
      cornerRadius: 24,
    },
    {
      id: 'blue-block',
      label: 'Blue Block',
      color: '#60a5fa',
      textColor: '#0f172a',
      x: 700,
      y: 220,
      width: 260,
      height: 140,
      cornerRadius: 24,
    },
    {
      id: 'green-block',
      label: 'Green Block',
      color: '#4ade80',
      textColor: '#064e3b',
      x: 660,
      y: 420,
      width: 260,
      height: 140,
      cornerRadius: 24,
    },
  ]);
  private readonly connectionState = signal<ConnectionModel[]>([
    { id: 'red-to-blue', from: 'red-block', to: 'blue-block', color: '#60a5fa' },
    { id: 'blue-to-green', from: 'blue-block', to: 'green-block', color: '#34d399' },
  ]);

  public readonly blocks = computed(() => this.blockState());
  public readonly blockViews = computed<BlockViewModel[]>(() => {
    return this.blocks().map((block) => ({
      id: block.id,
      x: block.x,
      y: block.y,
      blockImage: this.createBlockCanvas(
        block.width,
        block.height,
        block.color,
        block.cornerRadius,
      ),
      width: block.width,
      height: block.height,
      text: block.label,
      textColor: block.textColor,
    }));
  });
  public readonly arrowConfigs = computed<ArrowViewModel[]>(() => {
    if (!this.isBrowser()) {
      return [];
    }

    return this.calculateArrowViews(this.blockState(), this.connectionState());
  });

  public readonly gridImage = signal<HTMLImageElement | null>(null);
  public readonly isDarkMode = signal(false);
  public readonly stage = signal<Konva.Stage | null>(null);
  public readonly currentZoom = signal(100);

  public readonly configStage = computed<StageConfig>(() => ({
    width: this.stageSize().width,
    height: this.stageSize().height,
    draggable: true,
  }));

  public readonly gridConfig = computed(() => {
    const { width, height } = this.stageSize();
    return {
      image: this.gridImage(),
      x: -5000 + width / 2,
      y: -5000 + height / 2,
      width: 10000,
      height: 10000,
      listening: false,
    };
  });

  private darkModeMediaQuery?: MediaQueryList;
  private darkModeListener?: (event: MediaQueryListEvent) => void;
  private readonly resizeHandler = () => this.handleResize();
  private wheelHandler?: (event: WheelEvent) => void;

  constructor() {
    effect(() => {
      if (!this.isBrowser()) {
        return;
      }

      if (!this.darkModeMediaQuery) {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        this.darkModeMediaQuery = mediaQuery;
        this.isDarkMode.set(mediaQuery.matches);
        this.darkModeListener = (event) => this.isDarkMode.set(event.matches);
        mediaQuery.addEventListener('change', this.darkModeListener);
      }
    });

    effect(() => {
      if (!this.isBrowser()) {
        return;
      }

      this.isDarkMode();
      this.generateScribblyGrid();
    });

    afterNextRender(() => {
      if (!this.isBrowser()) {
        return;
      }

      const width = window.innerWidth;
      const height = window.innerHeight;
      this.stageSize.set({ width, height });
      window.addEventListener('resize', this.resizeHandler);
    });
  }

  public handleStageInit(stage: Konva.Stage) {
    this.stage.set(stage);
    stage.scale({ x: 1, y: 1 });
    stage.draggable(true);

    this.attachWheelHandler(stage);
    this.setupStageDragBoundaries(stage);
    this.centerContentOnStage(stage);
    this.enforceBounds(stage);
    stage.batchDraw();
  }

  public onBlockDragStart(payload: BlockPositionPayload) {
    const stage = this.stage();
    if (stage) {
      stage.draggable(false);
    }
  }

  public onBlockDragMove(payload: BlockPositionPayload) {
    this.blockState.update((blocks) =>
      blocks.map((block) =>
        block.id === payload.id ? { ...block, x: payload.x, y: payload.y } : block,
      ),
    );
  }

  public onBlockDragEnd(payload: BlockPositionPayload) {
    this.blockState.update((blocks) =>
      blocks.map((block) =>
        block.id === payload.id ? { ...block, x: payload.x, y: payload.y } : block,
      ),
    );

    const stage = this.stage();
    if (stage) {
      stage.draggable(true);
      this.enforceBounds(stage);
      stage.batchDraw();
    }
  }

  private setupStageDragBoundaries(stage: Konva.Stage) {
    stage.on('dragmove', () => this.enforceBounds(stage));
    stage.on('dragend', () => this.enforceBounds(stage));
  }

  private attachWheelHandler(stage: Konva.Stage) {
    const container = stage.container();
    if (this.wheelHandler) {
      container.removeEventListener('wheel', this.wheelHandler);
    }

    this.wheelHandler = (event: WheelEvent) => {
      event.preventDefault();
      stage.setPointersPositions(event as unknown as MouseEvent);

      const scaleBy = 1.05;
      const oldScale = stage.scaleX();
      const direction = event.deltaY > 0 ? 1 / scaleBy : scaleBy;
      const proposedScale = oldScale * direction;
      const clampedScale = Math.max(0.2, Math.min(4, proposedScale));

      const pointer = stage.getPointerPosition() ?? this.derivePointerFromEvent(stage, event);
      const stagePosition = stage.position();
      const pointerToScene = {
        x: (pointer.x - stagePosition.x) / oldScale,
        y: (pointer.y - stagePosition.y) / oldScale,
      };

      stage.scale({ x: clampedScale, y: clampedScale });
      stage.position({
        x: pointer.x - pointerToScene.x * clampedScale,
        y: pointer.y - pointerToScene.y * clampedScale,
      });

      this.currentZoom.set(Math.round(clampedScale * 100));
      this.enforceBounds(stage);
      stage.batchDraw();
    };

    container.addEventListener('wheel', this.wheelHandler, { passive: false });
  }

  private derivePointerFromEvent(stage: Konva.Stage, event: WheelEvent) {
    const rect = stage.container().getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  private enforceBounds(stage: Konva.Stage) {
    const scale = stage.scaleX();
    const { width: stageWidth, height: stageHeight } = this.stageSize();
    const bounds = this.getContentBounds();
    const margin = 120;

    const minStageXRaw = -(bounds.maxX - margin) * scale;
    const maxStageXRaw = stageWidth - (bounds.minX + margin) * scale;
    const minStageYRaw = -(bounds.maxY - margin) * scale;
    const maxStageYRaw = stageHeight - (bounds.minY + margin) * scale;

    const { min: minStageX, max: maxStageX } = this.normaliseBounds(
      minStageXRaw,
      maxStageXRaw,
      bounds.minX,
      bounds.maxX,
      stageWidth,
      scale,
    );
    const { min: minStageY, max: maxStageY } = this.normaliseBounds(
      minStageYRaw,
      maxStageYRaw,
      bounds.minY,
      bounds.maxY,
      stageHeight,
      scale,
    );

    const { x, y } = stage.position();
    const clampedX = Math.min(Math.max(x, minStageX), maxStageX);
    const clampedY = Math.min(Math.max(y, minStageY), maxStageY);

    if (clampedX !== x || clampedY !== y) {
      stage.position({ x: clampedX, y: clampedY });
    }
  }

  private normaliseBounds(
    rawMin: number,
    rawMax: number,
    contentMin: number,
    contentMax: number,
    viewportSize: number,
    scale: number,
  ) {
    if (rawMin <= rawMax) {
      return { min: rawMin, max: rawMax };
    }

    const contentCenter = (contentMin + contentMax) / 2;
    const target = viewportSize / 2 - contentCenter * scale;
    return { min: target, max: target };
  }

  private handleResize() {
    const previous = this.stageSize();
    const newWidth = window.innerWidth;
    const newHeight = window.innerHeight;
    this.stageSize.set({ width: newWidth, height: newHeight });

    const stage = this.stage();
    if (stage) {
      const pos = stage.position();
      stage.position({
        x: pos.x + (newWidth - previous.width) / 2,
        y: pos.y + (newHeight - previous.height) / 2,
      });
      this.enforceBounds(stage);
      stage.batchDraw();
    }
  }

  private centerContentOnStage(stage: Konva.Stage) {
    const bounds = this.getContentBounds();
    const { width, height } = this.stageSize();
    const scale = stage.scaleX();
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    stage.position({
      x: width / 2 - centerX * scale,
      y: height / 2 - centerY * scale,
    });
  }

  private getContentBounds() {
    const blocks = this.blockState();
    if (!blocks.length) {
      return { minX: -200, minY: -200, maxX: 200, maxY: 200 };
    }

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const block of blocks) {
      minX = Math.min(minX, block.x);
      minY = Math.min(minY, block.y);
      maxX = Math.max(maxX, block.x + block.width);
      maxY = Math.max(maxY, block.y + block.height);
    }

    return { minX, minY, maxX, maxY };
  }

  private calculateArrowViews(
    blocks: BlockModel[],
    connections: ConnectionModel[],
  ): ArrowViewModel[] {
    const blockMap = new Map(blocks.map((block) => [block.id, block] as const));
    const arrows: ArrowViewModel[] = [];

    for (const connection of connections) {
      const from = blockMap.get(connection.from);
      const to = blockMap.get(connection.to);
      if (!from || !to) {
        continue;
      }

      const arrow = this.buildArrowImage(connection, from, to);
      if (arrow) {
        arrows.push(arrow);
      }
    }

    return arrows;
  }

  private buildArrowImage(
    connection: ConnectionModel,
    from: BlockModel,
    to: BlockModel,
  ): ArrowViewModel | null {
    const { start, end } = this.getConnectionEndpoints(from, to);

    if (!start || !end) {
      return null;
    }

    const padding = 32;
    const minX = Math.min(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const width = Math.max(Math.abs(end.x - start.x), 1) + padding * 2;
    const height = Math.max(Math.abs(end.y - start.y), 1) + padding * 2;

    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width);
    canvas.height = Math.ceil(height);

    const rc = rough.canvas(canvas);
    const startPoint = {
      x: start.x - minX + padding,
      y: start.y - minY + padding,
    };
    const endPoint = {
      x: end.x - minX + padding,
      y: end.y - minY + padding,
    };

    rc.linearPath(
      [
        [startPoint.x, startPoint.y],
        [endPoint.x, endPoint.y],
      ],
      {
        roughness: 1.4,
        stroke: connection.color,
        strokeWidth: 3,
      },
    );

    const angle = Math.atan2(endPoint.y - startPoint.y, endPoint.x - startPoint.x);
    const headLength = 18;
    const left = {
      x: endPoint.x - headLength * Math.cos(angle - Math.PI / 6),
      y: endPoint.y - headLength * Math.sin(angle - Math.PI / 6),
    };
    const right = {
      x: endPoint.x - headLength * Math.cos(angle + Math.PI / 6),
      y: endPoint.y - headLength * Math.sin(angle + Math.PI / 6),
    };

    rc.linearPath(
      [
        [endPoint.x, endPoint.y],
        [left.x, left.y],
      ],
      {
        roughness: 1.4,
        stroke: connection.color,
        strokeWidth: 3,
      },
    );

    rc.linearPath(
      [
        [endPoint.x, endPoint.y],
        [right.x, right.y],
      ],
      {
        roughness: 1.4,
        stroke: connection.color,
        strokeWidth: 3,
      },
    );

    return {
      id: connection.id,
      image: canvas,
      x: minX - padding,
      y: minY - padding,
      width: canvas.width,
      height: canvas.height,
    };
  }

  private getConnectionEndpoints(from: BlockModel, to: BlockModel) {
    const targetCenter = this.getBlockCenter(to);
    const sourceCenter = this.getBlockCenter(from);

    return {
      start: this.getConnectionPoint(from, targetCenter),
      end: this.getConnectionPoint(to, sourceCenter),
    };
  }

  private getBlockCenter(block: BlockModel) {
    return {
      x: block.x + block.width / 2,
      y: block.y + block.height / 2,
    };
  }

  private getConnectionPoint(block: BlockModel, target: { x: number; y: number }) {
    const center = this.getBlockCenter(block);
    const dx = target.x - center.x;
    const dy = target.y - center.y;

    if (dx === 0 && dy === 0) {
      return { ...center };
    }

    const halfWidth = block.width / 2;
    const halfHeight = block.height / 2;
    const ratioX = dx !== 0 ? halfWidth / Math.abs(dx) : Number.POSITIVE_INFINITY;
    const ratioY = dy !== 0 ? halfHeight / Math.abs(dy) : Number.POSITIVE_INFINITY;
    const ratio = Math.min(ratioX, ratioY);

    const edgePoint = {
      x: center.x + dx * ratio,
      y: center.y + dy * ratio,
    };

    const padding = 16;
    const length = Math.sqrt(dx * dx + dy * dy) || 1;

    return {
      x: edgePoint.x + (padding * dx) / length,
      y: edgePoint.y + (padding * dy) / length,
    };
  }

  private generateScribblyGrid() {
    const canvasSize = 10000;
    const gridSize = 40;

    const canvas = document.createElement('canvas');
    canvas.width = canvasSize;
    canvas.height = canvasSize;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const gridColor = this.isDarkMode() ? '#64b5f6' : '#2d3748';
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.2;

    for (let x = 0; x < canvasSize; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasSize);
      ctx.stroke();
    }

    for (let y = 0; y < canvasSize; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasSize, y);
      ctx.stroke();
    }

    const imageUrl = canvas.toDataURL('image/png');
    const img = new Image();
    img.onload = () => this.gridImage.set(img);
    img.src = imageUrl;
  }

  private createBlockCanvas(
    width: number,
    height: number,
    fill: string,
    radius: number,
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return canvas;
    }

    const rc = rough.canvas(canvas);
    const cornerRadius = Math.max(0, Math.min(radius, Math.min(width, height) / 2));

    if (cornerRadius === 0) {
      rc.rectangle(0, 0, width, height, {
        roughness: 1.5,
        fill,
        fillStyle: 'hachure',
        fillWeight: 2,
        stroke: fill,
        strokeWidth: 2,
      });
      return canvas;
    }

    const path = this.buildRoundedRectPath(width, height, cornerRadius);

    rc.path(path, {
      roughness: 1.5,
      fill,
      fillStyle: 'hachure',
      fillWeight: 6,
      stroke: fill,
      strokeWidth: 2,
    });

    return canvas;
  }

  private buildRoundedRectPath(width: number, height: number, radius: number): string {
    const r = Math.min(radius, width / 2, height / 2);
    return `M${r},0 L${width - r},0 Q${width},0 ${width},${r} L${width},${height - r} Q${width},${height} ${width - r},${height} L${r},${height} Q0,${height} 0,${height - r} L0,${r} Q0,0 ${r},0 Z`;
  }

  public ngOnDestroy() {
    if (this.darkModeMediaQuery && this.darkModeListener) {
      this.darkModeMediaQuery.removeEventListener('change', this.darkModeListener);
    }

    if (this.isBrowser()) {
      window.removeEventListener('resize', this.resizeHandler);
    }

    const stage = this.stage();
    if (stage) {
      stage.off('dragmove');
      stage.off('dragend');
      if (this.wheelHandler) {
        stage.container().removeEventListener('wheel', this.wheelHandler);
      }
    }
  }
}
