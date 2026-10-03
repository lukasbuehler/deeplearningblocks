import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
  HostListener,
} from '@angular/core';
import { CdkDrag, CdkDragMove, CdkDragEnd, CdkDragStart } from '@angular/cdk/drag-drop';
import {
  BLOCKS,
  BLOCK_WIDTH,
  BlockKind,
  BlockNode,
  Board,
  Edge,
  Point,
  connect,
  connectionError,
  inferShapes,
  portPosition,
  removeNode,
} from '../graph';
import { MIN_ZOOM, toWorld, wirePath, zoomAt, snapTarget } from '../geometry';
import { GameService } from '../game.service';
import { BlockCard } from '../block-card/block-card';
import { routeWire, roundedWire } from '../wire-router';
import { TILES, Tile, blockName } from '../block-catalog';
import { BlockIcon } from '../block-icon/block-icon';
@Component({
  selector: 'app-paper-canvas',
  imports: [CdkDrag, BlockCard, BlockIcon],
  templateUrl: './paper-canvas.html',
  styleUrl: './paper-canvas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaperCanvas {
  readonly game = inject(GameService);
  readonly paper = viewChild.required<ElementRef<HTMLDivElement>>('paper');
  readonly definitions = BLOCKS;
  readonly tiles = TILES;
  readonly blockName = blockName;
  readonly tray = signal(false);
  readonly pending = signal<string | null>(null);
  readonly selectedEdge = signal<Edge | null>(null);
  readonly pointer = signal<Point | null>(null);
  readonly draft = signal<BlockNode | null>(null);
  readonly trayGhost = signal<{ tile: Tile; point: Point } | null>(null);
  readonly panning = signal(false);
  readonly shapes = computed(() => inferShapes(this.game.board()));
  readonly visualNodes = computed(() =>
    this.game.board().nodes.map((n) => (n.id === this.draft()?.id ? this.draft()! : n)),
  );
  readonly wires = computed(() =>
    this.game.board().edges.map((edge) => {
      const from = this.visualNodes().find((n) => n.id === edge.from)!,
        to = this.visualNodes().find((n) => n.id === edge.to)!;
      return {
        ...edge,
        path: roundedWire(routeWire(from, to, this.visualNodes())),
        label: `${blockName(from)} to ${blockName(to)}`,
        type: BLOCKS[from.kind].output,
      };
    }),
  );
  readonly ghostPath = computed(() => {
    const source = this.visualNodes().find((n) => n.id === this.pending());
    if (!source) return '';
    const start = portPosition(source, 'output');
    return wirePath(start, this.pointer() ?? { x: start.x + 90, y: start.y + 100 });
  });
  readonly snap = computed(() =>
    this.draft() && !this.game.trainer.busy() ? snapTarget(this.game.board(), this.draft()!) : null,
  );
  private panOrigin?: { point: Point; view: Board['viewport'] };
  private wireStart?: Point;
  private tileDrag?: { tile: Tile; start: Point; pointerId: number };
  private dragged = false;
  constructor() {
    afterNextRender(() => {
      const v = this.game.board().viewport;
      if (v.x === 0 && v.y === 0) this.fit();
    });
  }
  private local(event: { clientX: number; clientY: number }): Point {
    const r = this.paper().nativeElement.getBoundingClientRect();
    return { x: event.clientX - r.left, y: event.clientY - r.top };
  }
  private world(event: { clientX: number; clientY: number }): Point {
    return toWorld(this.local(event), this.game.board().viewport);
  }
  fit(): void {
    const nodes = this.game.board().nodes;
    if (!nodes.length) {
      this.game.setViewport({ x: 30, y: 30, zoom: 1 });
      return;
    }
    const r = this.paper().nativeElement.getBoundingClientRect();
    const minX = Math.min(...nodes.map((n) => n.x)),
      minY = Math.min(...nodes.map((n) => n.y));
    const width = Math.max(...nodes.map((n) => n.x + BLOCK_WIDTH)) - minX,
      height = Math.max(...nodes.map((n) => n.y + BLOCKS[n.kind].height)) - minY;
    const zoom = Math.max(
      MIN_ZOOM,
      Math.min(1, (r.width - 100) / width, (r.height - 130) / height),
    );
    this.game.setViewport({
      x: (r.width - width * zoom) / 2 - minX * zoom,
      y: (r.height - 60 - height * zoom) / 2 - minY * zoom,
      zoom,
    });
  }
  zoom(factor: number, point?: Point): void {
    if (this.draft()) return;
    const el = this.paper().nativeElement;
    this.game.setViewport(
      zoomAt(
        this.game.board().viewport,
        point ?? { x: el.clientWidth / 2, y: el.clientHeight / 2 },
        this.game.board().viewport.zoom * factor,
      ),
    );
  }
  wheel(event: WheelEvent): void {
    if ((event.target as HTMLElement).closest('.tray,.canvas-tools')) return;
    event.preventDefault();
    this.zoom(Math.exp(-event.deltaY * 0.002), this.local(event));
  }
  panStart(event: PointerEvent): void {
    if (
      event.button !== 0 ||
      (event.target as HTMLElement).closest('.node,button,.tray,.wire-hit,.canvas-tools')
    )
      return;
    this.game.selected.set(null);
    this.selectedEdge.set(null);
    this.pending.set(null);
    this.panOrigin = { point: this.local(event), view: { ...this.game.board().viewport } };
    this.panning.set(true);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }
  paperMove(event: PointerEvent): void {
    if (this.panOrigin) {
      const p = this.local(event),
        o = this.panOrigin;
      this.game.setViewport({
        ...o.view,
        x: o.view.x + p.x - o.point.x,
        y: o.view.y + p.y - o.point.y,
      });
    }
    if (this.pending()) this.pointer.set(this.world(event));
  }
  panEnd(): void {
    this.panOrigin = undefined;
    this.panning.set(false);
  }
  startDrag(event: CdkDragStart, node: BlockNode): void {
    this.dragged = true;
    this.pending.set(null);
    this.game.selected.set(node.id);
    this.selectedEdge.set(null);
    this.draft.set({ ...node });
  }
  moveDrag(event: CdkDragMove, node: BlockNode): void {
    const p = event.source.getFreeDragPosition();
    this.draft.set({
      ...node,
      x: p.x / this.game.board().viewport.zoom,
      y: p.y / this.game.board().viewport.zoom,
    });
  }
  endDrag(event: CdkDragEnd, node: BlockNode): void {
    const position = event.source.getFreeDragPosition();
    const moved = {
        ...node,
        x: position.x / this.game.board().viewport.zoom,
        y: position.y / this.game.board().viewport.zoom,
      },
      snap = !this.game.trainer.busy() ? snapTarget(this.game.board(), moved) : null;
    const finalNode = snap ? { ...moved, ...snap.position } : moved;
    let board = {
      ...this.game.board(),
      nodes: this.game.board().nodes.map((n) => (n.id === node.id ? finalNode : n)),
    };
    if (snap) board = connect(board, snap.from, snap.to);
    this.game.edit(board);
    event.source.setFreeDragPosition({
      x: finalNode.x * this.game.board().viewport.zoom,
      y: finalNode.y * this.game.board().viewport.zoom,
    });
    this.draft.set(null);
    setTimeout(() => (this.dragged = false), 0);
  }
  selectNode(id: string): void {
    if (this.dragged) return;
    this.game.selected.set(id);
    this.selectedEdge.set(null);
  }
  outputStart(event: PointerEvent, node: BlockNode): void {
    event.stopPropagation();
    if (this.game.trainer.busy()) return;
    const occupied = this.game.board().edges.find((e) => e.from === node.id);
    if (occupied) {
      this.chooseEdge(occupied);
      return;
    }
    this.pending.set(node.id);
    this.selectedEdge.set(null);
    this.wireStart = this.local(event);
    this.pointer.set(this.world(event));
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }
  outputMove(event: PointerEvent): void {
    if (this.wireStart) this.pointer.set(this.world(event));
  }
  outputEnd(event: PointerEvent): void {
    if (!this.wireStart) return;
    const moved =
      Math.hypot(this.local(event).x - this.wireStart.x, this.local(event).y - this.wireStart.y) >
      6;
    this.wireStart = undefined;
    if (moved) {
      const target = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>('[data-input]');
      if (target) this.finishConnection(target.dataset['input']!);
      else this.cancelWire();
    }
  }
  outputClick(event: MouseEvent, id: string): void {
    event.stopPropagation();
    if (event.detail === 0 && !this.game.trainer.busy()) {
      const occupied = this.game.board().edges.find((e) => e.from === id);
      if (occupied) this.chooseEdge(occupied);
      else {
        this.pending.set(id);
        this.pointer.set(null);
      }
    }
  }
  finishConnection(id: string): void {
    const from = this.pending();
    if (this.game.trainer.busy()) return;
    if (!from) {
      const occupied = this.game.board().edges.find((e) => e.to === id);
      if (occupied) this.chooseEdge(occupied);
      return;
    }
    const error = connectionError(this.game.board(), from, id);
    if (error) {
      this.game.message.set(error);
      return;
    }
    this.game.edit(connect(this.game.board(), from, id));
    this.game.message.set('Click! Your blocks are connected.');
    this.cancelWire();
  }
  compatible(id: string): boolean {
    return !!this.pending() && !connectionError(this.game.board(), this.pending()!, id);
  }
  cancelWire(): void {
    this.pending.set(null);
    this.pointer.set(null);
    this.wireStart = undefined;
  }
  chooseEdge(edge: Edge): void {
    this.selectedEdge.set(edge);
    this.game.selected.set(null);
    this.cancelWire();
  }
  disconnect(): void {
    const edge = this.selectedEdge();
    if (!edge || this.game.trainer.busy()) return;
    this.game.edit({
      ...this.game.board(),
      edges: this.game.board().edges.filter((e) => e.from !== edge.from || e.to !== edge.to),
    });
    this.selectedEdge.set(null);
  }
  deleteNode(id: string): void {
    if (this.game.trainer.busy()) return;
    this.game.edit(removeNode(this.game.board(), id));
    this.cancelWire();
    this.game.message.set('Block removed. Undo can bring it back.');
  }
  locked(tile: Tile): boolean {
    return tile.era > this.game.era();
  }
  exists(tile: Tile): boolean {
    return (
      ['image', 'classifier'].includes(tile.kind) &&
      this.game.board().nodes.some((n) => n.kind === tile.kind)
    );
  }
  tileStart(event: PointerEvent, tile: Tile): void {
    if (this.locked(tile) || this.exists(tile) || this.game.trainer.busy()) return;
    event.stopPropagation();
    this.tileDrag = { tile, start: this.local(event), pointerId: event.pointerId };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }
  tileMove(event: PointerEvent): void {
    if (!this.tileDrag) return;
    const p = this.local(event);
    if (Math.hypot(p.x - this.tileDrag.start.x, p.y - this.tileDrag.start.y) > 8)
      this.trayGhost.set({ tile: this.tileDrag.tile, point: p });
  }
  tileEnd(event: PointerEvent): void {
    if (!this.tileDrag) return;
    const tile = this.tileDrag.tile,
      dragging = !!this.trayGhost();
    this.tileDrag = undefined;
    this.trayGhost.set(null);
    const p = this.local(event),
      el = this.paper().nativeElement;
    if (
      dragging &&
      (p.x < 0 ||
        p.y < 0 ||
        p.x > el.clientWidth ||
        p.y > el.clientHeight ||
        document.elementFromPoint(event.clientX, event.clientY)?.closest('.tray'))
    )
      return;
    this.add(tile, dragging ? this.world(event) : undefined);
  }
  tileCancel(): void {
    this.tileDrag = undefined;
    this.trayGhost.set(null);
  }
  tileClick(event: MouseEvent, tile: Tile): void {
    if (event.detail === 0) this.add(tile);
  }
  add(tile: Tile, point?: Point): void {
    if (this.locked(tile) || this.exists(tile) || this.game.trainer.busy()) return;
    const el = this.paper().nativeElement,
      center =
        point ??
        toWorld({ x: el.clientWidth / 2, y: el.clientHeight / 2 }, this.game.board().viewport);
    const node: BlockNode = {
      id: crypto.randomUUID(),
      kind: tile.kind,
      x: Math.round(center.x - BLOCK_WIDTH / 2),
      y: Math.round(center.y - BLOCKS[tile.kind].height / 2),
      ...(tile.kind === 'dense' ? { units: 32 } : {}),
      ...(tile.activation ? { activation: tile.activation } : {}),
    };
    // Offset overlapping placements so every new piece remains reachable.
    while (
      this.game
        .board()
        .nodes.some((n) => Math.abs(n.x - node.x) < 35 && Math.abs(n.y - node.y) < 35)
    ) {
      node.x += 35;
      node.y += 35;
    }
    this.game.edit({ ...this.game.board(), nodes: [...this.game.board().nodes, node] });
    this.game.selected.set(node.id);
    this.tray.set(false);
    this.game.message.set(`${tile.name} is on the paper. Connect its studs!`);
  }
  clearSelection(): void {
    this.game.selected.set(null);
    this.selectedEdge.set(null);
    this.cancelWire();
    this.tray.set(false);
  }
  @HostListener('document:keydown', ['$event']) key(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    if (target.closest('input,select,textarea,[contenteditable="true"],[role="dialog"]')) return;
    if (event.key === 'Escape') {
      this.clearSelection();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      event.shiftKey ? this.game.redo() : this.game.undo();
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (this.selectedEdge()) {
        event.preventDefault();
        this.disconnect();
      } else if (this.game.selected()) {
        event.preventDefault();
        this.deleteNode(this.game.selected()!);
      }
    }
    if (
      ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key) &&
      this.game.selected() &&
      target.closest('.node')
    ) {
      event.preventDefault();
      const node = this.game.selectedNode()!;
      const amount = event.shiftKey ? 30 : 10;
      this.game.edit({
        ...this.game.board(),
        nodes: this.game.board().nodes.map((n) =>
          n.id === node.id
            ? {
                ...n,
                x:
                  n.x +
                  (event.key === 'ArrowRight' ? amount : event.key === 'ArrowLeft' ? -amount : 0),
                y:
                  n.y +
                  (event.key === 'ArrowDown' ? amount : event.key === 'ArrowUp' ? -amount : 0),
              }
            : n,
        ),
      });
    }
  }
}
