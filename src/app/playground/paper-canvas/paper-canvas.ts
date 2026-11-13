import { MatIcon } from '@angular/material/icon';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
  HostListener,
  DestroyRef,
} from '@angular/core';
import { CdkDrag, CdkDragMove, CdkDragEnd, CdkDragStart } from '@angular/cdk/drag-drop';
import {
  BLOCKS,
  BLOCK_WIDTH,
  BlockKind,
  BlockNode,
  Board,
  INNER_KINDS,
  Edge,
  InputPort,
  Point,
  classCount,
  connect,
  newConnectionError,
  inferShapes,
  nodeSize,
  portPosition,
  portType,
  removeNode,
  worldOf,
} from '../graph';
import { CONTEXT } from '../../learning/shakespeare';
import { MIN_ZOOM, toWorld, wirePath, zoomAt, closestPointOnRect } from '../geometry';
import { GameService } from '../game.service';
import {
  attachStacks,
  applyStackDrop,
  moveStack,
  stackIds,
  stackSnapTarget,
  stackDropTarget,
} from '../stacks';
import { BlockCard } from '../block-card/block-card';
import { routeWire, roundedWire } from '../wire-router';
import { SoundService } from '../sound';
import { tilesFor, Tile, blockName } from '../block-catalog';
import { BlockIcon } from '../block-icon/block-icon';
import {
  blockOutline,
  connectorLabels,
  inferConnectorShapes,
  nodeConnectors,
} from '../block-connectors';
import { Blocky } from '../blocky/blocky';
import { blockyHint, hintContext } from '../blocky-hints';
import {
  insertIntoRecipe,
  extractFromRecipe,
  makeCustomBlock,
  nextPickable,
  pickedChain,
  starterRecipe,
  takeApart,
} from '../custom-blocks';
@Component({
  selector: 'app-paper-canvas',
  imports: [MatIcon, CdkDrag, BlockCard, BlockIcon, Blocky],
  templateUrl: './paper-canvas.html',
  styleUrl: './paper-canvas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaperCanvas {
  readonly checkButton = input<HTMLButtonElement>();
  readonly game = inject(GameService);
  readonly paper = viewChild.required<ElementRef<HTMLDivElement>>('paper');
  readonly definitions = BLOCKS;
  readonly size = nodeSize;
  readonly boardWorld = computed(() => worldOf(this.game.board()));
  readonly portType = (node: BlockNode, side: 'input' | 'output') =>
    portType(node.kind, side, this.boardWorld());
  /** A stable name for a wire. Text outputs can feed several sockets, so `from` is not enough. */
  readonly edgeKey = (edge: Edge) => `${edge.from}>${edge.to}>${edge.port ?? ''}`;
  readonly defaultUnits = computed(() =>
    this.boardWorld() === 'text'
      ? 48
      : this.game.mode() === 'journey' && this.game.era() === 0
        ? 10
        : 32,
  );
  readonly tiles = computed(() =>
    tilesFor(this.game.dataset()).map((tile) => {
      const node: BlockNode = {
        id: 'preview',
        kind: tile.kind,
        units: this.defaultUnits(),
        x: 0,
        y: 0,
        ...(tile.kind === 'custom' ? { blocks: [{ id: 'dense', kind: 'dense', units: 32 }] } : {}),
      };
      const { input, output } = nodeConnectors(
        node,
        undefined,
        undefined,
        undefined,
        false,
        this.boardWorld(),
      );
      if (tile.kind === 'dense' && output) {
        output.size = undefined;
        output.label = 'M';
      }
      return {
        ...tile,
        outline: blockOutline(180, 118, input, output),
        labels: [...connectorLabels(input, 180, 0), ...connectorLabels(output, 180, 118)],
      };
    }),
  );
  readonly blockName = (node: BlockNode) => blockName(node, this.game.dataset());
  readonly tray = signal(false);
  readonly pending = signal<string | null>(null);
  readonly selectedEdge = signal<Edge | null>(null);
  readonly pointer = signal<Point | null>(null);
  readonly draft = signal<BlockNode | null>(null);
  readonly sound = inject(SoundService);
  /** The wire that just clicked into place, for its little pop animation. */
  readonly clicked = signal<{ from: string; to: string } | null>(null);
  /** The block that just landed from the toy box, and whether the trashcan is gulping. */
  readonly fresh = signal<string | null>(null);
  readonly gulping = signal(false);
  /** Read out by screen readers instead of a visible snackbar. */
  readonly announcement = signal('');
  private flash<T>(target: { set(value: T): void }, value: T, reset: T, ms = 520): void {
    target.set(value);
    setTimeout(() => target.set(reset), ms);
  }
  private celebrateConnection(from: string, to: string): void {
    this.game.message.set('');
    this.sound.play('click');
    this.flash(this.clicked, { from, to }, null);
    const name = (id: string) => {
      const node = this.game.board().nodes.find((n) => n.id === id);
      return node ? this.blockName(node) : 'block';
    };
    this.announcement.set(`Click! ${name(from)} connected to ${name(to)}.`);
  }
  readonly trash = viewChild<ElementRef<HTMLButtonElement>>('trash');
  readonly selectedJoint = computed(() =>
    this.game.board().edges.find((e) => !e.port && e.to === this.game.selected()),
  );
  detachSelected(): void {
    const edge = this.selectedJoint();
    if (!edge) return;
    this.selectedEdge.set(edge);
    this.disconnect();
  }
  readonly selectedBlockName = computed(() => {
    const node = this.game.selectedNode();
    return node ? this.blockName(node) : null;
  });
  /** True while a dragged block hovers over the trashcan, so letting go deletes it. */
  readonly overTrash = signal(false);
  private inTrash(point: { x: number; y: number }): boolean {
    const r = this.trash()?.nativeElement.getBoundingClientRect();
    // A little slack around the can makes it an easy target for fingers.
    return (
      !!r &&
      point.x > r.left - 16 &&
      point.x < r.right + 16 &&
      point.y > r.top - 16 &&
      point.y < r.bottom + 16
    );
  }
  readonly dragIntent = signal<{
    point: Point;
    tile?: Tile;
    inner?: { parent: string; id: string };
  } | null>(null);
  previewInner(parent: string, event: { id: string; point: Point }): void {
    this.dragIntent.set({ point: event.point, inner: { parent, id: event.id } });
  }
  readonly dropSource = computed(() => {
    const draft = this.draft();
    if (draft) return { board: this.game.board(), node: draft };
    const ghost = this.trayGhost();
    if (!ghost) return null;
    const world = toWorld(ghost.point, this.game.board().viewport);
    const node: BlockNode = {
      id: '__palette__',
      kind: ghost.tile.kind,
      units: this.defaultUnits(),
      activation: ghost.tile.activation,
      x: world.x - BLOCK_WIDTH / 2,
      y: world.y - BLOCKS[ghost.tile.kind].height / 2,
    };
    return { node, board: { ...this.game.board(), nodes: [...this.game.board().nodes, node] } };
  });
  readonly recipeHover = computed(() => {
    const intent = this.dragIntent();
    if (!intent || this.game.trainer.busy()) return null;
    const target = this.recipeAt(intent.point, intent.inner?.id);
    if (!target) return null;
    let board = this.dropSource()?.board ?? this.game.board();
    let ids: string[];
    if (intent.inner) {
      board = extractFromRecipe(
        board,
        intent.inner.parent,
        intent.inner.id,
        { x: 0, y: 0 },
        () => '__inner__',
      );
      ids = [board.nodes.at(-1)!.id];
    } else {
      const source = this.dropSource();
      if (!source) return null;
      ids = stackIds(board, source.node.id);
      if (ids.includes(target.id)) return null;
    }
    const result = insertIntoRecipe(board, target.id, ids, target.index);
    return { ...target, error: typeof result === 'string' ? result : null };
  });
  readonly dropCandidate = computed(() => {
    const source = this.dropSource();
    return source && !this.recipeHover() && !this.game.trainer.busy()
      ? stackDropTarget(source.board, source.node)
      : null;
  });
  readonly edgeFeedback = computed(() => {
    const feedback = new Map<string, 'valid' | 'invalid'>();
    for (const pair of this.dropCandidate()?.pairs ?? []) {
      const state = pair.error ? 'invalid' : 'valid';
      feedback.set(pair.from + ':output', state);
      feedback.set(pair.to + ':input', state);
    }
    return feedback;
  });
  readonly trayGhost = signal<{ tile: Tile; point: Point } | null>(null);
  readonly panning = signal(false);
  /** Blocks picked to become one custom block, in the order they were picked. */
  readonly picked = signal<string[]>([]);
  readonly pickedChain = computed(() =>
    this.picked().length ? pickedChain(this.game.board(), this.picked()) : null,
  );
  readonly nextPick = computed(() =>
    this.picked().length ? nextPickable(this.game.board(), this.picked()) : null,
  );
  /** Set on pointerdown so the focus that follows does not undo a shift-click pick. */
  private pickModifier = false;
  readonly visualBoard = computed(() => {
    const draft = this.draft();
    return draft ? moveStack(this.game.board(), draft.id, draft) : this.game.board();
  });
  readonly shapes = computed(() => inferShapes(this.visualBoard()));
  readonly connectorShapes = computed(() => inferConnectorShapes(this.visualBoard()));
  readonly wiredInputs = computed(
    () =>
      new Set(
        this.visualBoard()
          .edges.filter((e) => !e.port)
          .map((e) => e.to),
      ),
  );
  readonly visualNodes = computed(() => this.visualBoard().nodes);
  readonly positions = computed(() => new Map(this.visualNodes().map((n) => [n.id, n])));
  private readonly committedPositions = computed(() => {
    const { zoom } = this.game.board().viewport;
    return new Map(this.game.board().nodes.map((n) => [n.id, { x: n.x * zoom, y: n.y * zoom }]));
  });
  readonly dragPositions = computed(() => {
    const draft = this.draft();
    const committed = this.committedPositions();
    if (!draft) return committed;
    const zoom = this.game.board().viewport.zoom;
    return new Map(
      this.visualNodes().map((n) => [
        n.id,
        n.id === draft.id ? committed.get(n.id)! : { x: n.x * zoom, y: n.y * zoom },
      ]),
    );
  });
  /** Last drawn route per wire, so a dragged card does not make near-tied wires flip sides. */
  private readonly lastRoutes = new Map<string, Point[]>();
  readonly wires = computed(() => {
    const routes = new Map<string, Point[]>();
    const wires = this.visualBoard()
      .edges.filter((edge) => {
        const source = this.positions().get(edge.from)!,
          target = this.positions().get(edge.to)!;
        const out = portPosition(source, 'output'),
          input = portPosition(target, 'input', edge.port);
        return Math.hypot(out.x - input.x, out.y - input.y) > 0.5;
      })
      .map((edge) => {
        const from = this.visualNodes().find((n) => n.id === edge.from)!,
          to = this.visualNodes().find((n) => n.id === edge.to)!;
        const key = this.edgeKey(edge);
        const points = routeWire(from, to, this.visualNodes(), this.lastRoutes.get(key), edge.port);
        routes.set(key, points);
        return {
          ...edge,
          points,
          key,
          path: roundedWire(points),
          label: `${this.blockName(from)} to ${this.blockName(to)}`,
          type: this.portType(from, 'output'),
        };
      });
    this.lastRoutes.clear();
    for (const [key, points] of routes) this.lastRoutes.set(key, points);
    return wires;
  });
  readonly wireSource = computed(() => this.visualNodes().find((n) => n.id === this.pending()));
  readonly wireBadge = computed(() => {
    const source = this.wireSource();
    const point = this.pointer();
    if (!source || !point) return null;
    const view = this.game.board().viewport;
    const x = point.x * view.zoom + view.x;
    const y = point.y * view.zoom + view.y;
    const { width } = this.paperSize();
    return {
      label: this.portLabel(source, 'output'),
      x: Math.min(Math.max(x - 28, 168), width - 8),
      y: Math.max(20, y),
    };
  });
  readonly ghostPath = computed(() => {
    const source = this.wireSource();
    if (!source) return '';
    const start = portPosition(source, 'output');
    return wirePath(start, this.pointer() ?? { x: start.x + 90, y: start.y + 100 });
  });
  readonly snap = computed(() => {
    const drop = this.dropCandidate();
    return drop?.error ? null : drop;
  });
  private readonly destroyRef = inject(DestroyRef);
  readonly paperSize = signal({ width: 0, height: 0 });
  readonly helperVisible = signal(false);
  readonly rejected = signal<{ edge: Edge; context: string } | null>(null);
  readonly helperContext = computed(() =>
    hintContext(this.game.board(), this.game.era(), this.game.mode()),
  );
  readonly helperHint = computed(() =>
    blockyHint(
      this.game.board(),
      this.game.era(),
      this.game.mode(),
      this.rejected()?.context === this.helperContext() ? this.rejected()!.edge : undefined,
      this.game.trainer.trained() && !this.game.canCheck()
        ? this.game.workspace().experiments.at(-1)?.accuracy
        : undefined,
      this.game.levelComplete(),
      this.game.dataset(),
    ),
  );
  readonly helperSuppressed = computed(
    () => !!(this.tray() || this.pending() || this.game.drawingOpen() || this.game.trainer.busy()),
  );
  readonly helperTarget = computed(() =>
    this.helperVisible() && !this.helperSuppressed() ? this.helperHint()?.target : null,
  );
  readonly highlightedNode = computed(() => {
    const t = this.helperTarget();
    return t?.kind === 'node' ? t.id : null;
  });
  readonly highlightedEdge = computed(() => {
    const t = this.helperTarget();
    return t?.kind === 'edge' ? this.edgeKey(t) : null;
  });
  readonly targetPoint = computed(() => {
    const t = this.helperHint()?.target,
      nodes = this.visualNodes();
    if (!t || t.kind === 'tray' || t.kind === 'check') return null;
    if (t.kind === 'node') {
      const n = nodes.find((n) => n.id === t.id);
      if (!n) return null;
      const size = nodeSize(n);
      return { x: n.x + size.width / 2, y: n.y + size.height / 2 };
    }
    const from = nodes.find((n) => n.id === t.from),
      to = nodes.find((n) => n.id === t.to);
    if (!from || !to) return null;
    const points =
        this.wires().find((w) => w.from === t.from && w.to === t.to && w.port === t.port)?.points ??
        routeWire(from, to, nodes, undefined, t.port),
      i = Math.floor((points.length - 1) / 2);
    return { x: (points[i].x + points[i + 1].x) / 2, y: (points[i].y + points[i + 1].y) / 2 };
  });
  readonly pointerGeometry = computed(() => {
    const p = this.targetPoint(),
      v = this.game.board().viewport,
      size = this.paperSize();
    if (this.helperHint()?.target?.kind === 'check') {
      const button = this.checkButton()?.getBoundingClientRect();
      if (!button) return null;
      const paper = this.paper().nativeElement.getBoundingClientRect();
      const end = { x: button.left + button.width / 2, y: button.bottom + 8 };
      const center = { x: paper.right - 78, y: paper.top + 61 };
      const angle = (Math.atan2(end.y - center.y, end.x - center.x) * 180) / Math.PI;
      const start = { x: paper.right - (end.x < center.x ? 109 : 55), y: center.y };
      return {
        path: `M${start.x},${start.y} L${end.x},${end.y}`,
        angle,
        visible: true,
        end,
      };
    }
    if (!p) return null;
    const center = { x: size.width - 78, y: 61 };
    const target = this.helperHint()?.target;
    const node =
      target?.kind === 'node' ? this.visualNodes().find((n) => n.id === target.id) : null;
    // Match the highlighted outline and calculate in screen space for every zoom level.
    const box = node ? nodeSize(node) : null;
    const bounds = node
      ? {
          x: (node.x - 12) * v.zoom + v.x,
          y: (node.y - 12) * v.zoom + v.y,
          width: (box!.width + 24) * v.zoom,
          height: (box!.height + 24) * v.zoom,
        }
      : null;
    const aim = bounds
      ? closestPointOnRect(center, bounds)
      : { x: p.x * v.zoom + v.x, y: p.y * v.zoom + v.y };
    const start = { x: aim.x < center.x ? size.width - 109 : size.width - 55, y: center.y };
    const end = bounds ? closestPointOnRect(start, bounds) : aim;
    return {
      path: `M${start.x},${start.y} L${end.x},${end.y}`,
      angle: (Math.atan2(end.y - center.y, end.x - center.x) * 180) / Math.PI,
      visible: end.x > 0 && end.y > 0 && end.x < size.width && end.y < size.height - 50,
      end,
    };
  });
  showClueTarget(): void {
    this.game.message.set('');
    const target = this.helperHint()?.target;
    if (!target) return;
    if (target.kind === 'check') {
      this.checkButton()?.focus({ preventScroll: true });
      return;
    }
    if (target.kind === 'tray') {
      this.tray.set(true);
      return;
    }
    const p = this.targetPoint();
    if (!p) return;
    if (target.kind === 'edge') this.chooseEdge(target);
    const size = this.paperSize(),
      v = this.game.board().viewport;
    this.game.setViewport({
      ...v,
      x: size.width * 0.3 - p.x * v.zoom,
      y: size.height * (size.width < 650 ? 0.12 : 0.3) - p.y * v.zoom,
    });
    const selector =
      target.kind === 'node'
        ? `[data-node="${CSS.escape(target.id)}"]`
        : `[data-edge="${CSS.escape(this.edgeKey(target))}"]`;
    this.paper().nativeElement.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true });
  }
  private panOrigin?: { point: Point; view: Board['viewport'] };
  private wireStart?: Point;
  private tileDrag?: { tile: Tile; start: Point; pointerId: number };
  private dragged = false;
  constructor() {
    afterNextRender(() => {
      const observer = new ResizeObserver(([entry]) =>
        this.paperSize.set({ width: entry.contentRect.width, height: entry.contentRect.height }),
      );
      observer.observe(this.paper().nativeElement);
      this.destroyRef.onDestroy(() => observer.disconnect());
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
    const width = Math.max(...nodes.map((n) => n.x + nodeSize(n).width)) - minX,
      height = Math.max(...nodes.map((n) => n.y + nodeSize(n).height)) - minY;
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
    if ((event.target as HTMLElement).closest('.tray,.canvas-tools,app-blocky')) return;
    event.preventDefault();
    this.zoom(Math.exp(-event.deltaY * 0.002), this.local(event));
  }
  panStart(event: PointerEvent): void {
    if (
      event.button !== 0 ||
      (event.target as HTMLElement).closest('.node,button,.tray,.wire-hit,.canvas-tools,app-blocky')
    )
      return;
    this.game.selected.set(null);
    this.picked.set([]);
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
  private recipeAt(point: Point, omit?: string): { id: string; index: number } | null {
    for (const zone of this.paper().nativeElement.querySelectorAll<HTMLElement>(
      '[data-custom-recipe]',
    )) {
      const rect = zone.getBoundingClientRect();
      if (
        point.x < rect.left ||
        point.x > rect.right ||
        point.y < rect.top ||
        point.y > rect.bottom
      )
        continue;
      const items = [...zone.querySelectorAll<HTMLElement>('[data-inner-id]')].filter(
        (n) => n.dataset['innerId'] !== omit,
      );
      return {
        id: zone.dataset['customRecipe']!,
        index: items.filter((n) => {
          const r = n.getBoundingClientRect();
          return point.y > r.top + r.height / 2;
        }).length,
      };
    }
    return null;
  }
  moveInner(parent: string, event: { id: string; point: Point; drop: Point }): void {
    this.dragIntent.set(null);
    if (this.game.trainer.busy()) return;
    const paper = this.paper().nativeElement.getBoundingClientRect();
    const position = toWorld(
      { x: event.point.x - paper.left, y: event.point.y - paper.top },
      this.game.board().viewport,
    );
    const target = this.recipeAt(event.drop, event.id);
    let board = extractFromRecipe(this.game.board(), parent, event.id, position, () =>
      crypto.randomUUID(),
    );
    const moved = board.nodes.at(-1)!;
    if (target) {
      const inserted = insertIntoRecipe(board, target.id, [moved.id], target.index);
      if (typeof inserted === 'string') this.game.message.set(inserted);
      else board = inserted;
    }
    this.game.edit(board);
  }
  startDrag(event: CdkDragStart, node: BlockNode): void {
    this.dragged = true;
    this.pending.set(null);
    this.game.selected.set(node.id);
    this.selectedEdge.set(null);
    this.draft.set({ ...node });
  }
  moveDrag(event: CdkDragMove, node: BlockNode): void {
    this.dragIntent.set({ point: event.pointerPosition });
    this.overTrash.set(this.inTrash(event.pointerPosition));
    const p = event.source.getFreeDragPosition();
    this.draft.set({
      ...node,
      x: p.x / this.game.board().viewport.zoom,
      y: p.y / this.game.board().viewport.zoom,
    });
  }
  endDrag(event: CdkDragEnd, node: BlockNode): void {
    this.dragIntent.set(null);
    this.overTrash.set(false);
    if (this.inTrash(event.dropPoint) && !this.game.trainer.busy()) {
      this.draft.set(null);
      this.deleteNode(node.id);
      setTimeout(() => (this.dragged = false), 0);
      return;
    }
    const recipe = this.recipeAt(event.dropPoint);
    if (recipe && INNER_KINDS.includes(node.kind) && !this.game.trainer.busy()) {
      const inserted = insertIntoRecipe(
        this.game.board(),
        recipe.id,
        stackIds(this.game.board(), node.id),
        recipe.index,
      );
      if (typeof inserted !== 'string') {
        this.game.edit(inserted);
        this.draft.set(null);
        setTimeout(() => (this.dragged = false), 0);
        return;
      }
      this.game.message.set(inserted);
    }
    const position = event.source.getFreeDragPosition();
    const moved = {
        ...node,
        x: position.x / this.game.board().viewport.zoom,
        y: position.y / this.game.board().viewport.zoom,
      },
      snap = !this.game.trainer.busy() ? stackSnapTarget(this.game.board(), moved) : null;
    const finalNode = snap ? { ...moved, ...snap.position } : moved;
    let board = moveStack(this.game.board(), node.id, finalNode);
    if (snap) board = applyStackDrop(this.game.board(), moved, snap);
    this.game.edit(board);
    if (snap) this.celebrateConnection(snap.from, snap.to);
    event.source.setFreeDragPosition({
      x: finalNode.x * this.game.board().viewport.zoom,
      y: finalNode.y * this.game.board().viewport.zoom,
    });
    this.draft.set(null);
    setTimeout(() => (this.dragged = false), 0);
  }
  notePickModifier(event: PointerEvent): void {
    this.pickModifier = event.shiftKey || event.metaKey || event.ctrlKey;
  }
  /** Focus and plain clicks select one block; shift-click adds or removes it from the picks. */
  selectNode(id: string, event?: MouseEvent): void {
    if (this.dragged) return;
    const adding = event ? event.shiftKey || event.metaKey || event.ctrlKey : this.pickModifier;
    this.selectedEdge.set(null);
    if (adding && !event) return;
    this.pickModifier = false;
    const node = this.game.board().nodes.find((n) => n.id === id);
    const pickable = !!node && INNER_KINDS.includes(node.kind);
    if (adding) {
      if (pickable)
        this.picked.update((ids) =>
          ids.includes(id) ? ids.filter((other) => other !== id) : [...ids, id],
        );
    } else this.picked.set(pickable ? [id] : []);
    this.game.selected.set(id);
  }
  readonly isChain = (value: string[] | string | null): value is string[] => Array.isArray(value);
  pickNext(): void {
    const next = this.nextPick();
    if (next) this.picked.update((ids) => [...ids, next]);
  }
  makeBlock(): void {
    if (this.game.trainer.busy() || this.picked().length < 2) return;
    const id = crypto.randomUUID();
    const result = makeCustomBlock(this.game.board(), this.picked(), id);
    if (typeof result === 'string') {
      this.game.message.set(result);
      return;
    }
    this.game.edit(result);
    this.picked.set([]);
    this.game.selected.set(id);
    this.game.message.set('A custom block! Name it, repeat it, or take it apart again.');
  }
  takeApartNode(id: string): void {
    if (this.game.trainer.busy()) return;
    this.game.edit(takeApart(this.game.board(), id, () => crypto.randomUUID()));
    this.game.selected.set(null);
    this.game.message.set('Taken apart. Same layers, now as separate blocks.');
  }
  outputStart(event: PointerEvent, node: BlockNode): void {
    event.stopPropagation();
    if (this.game.trainer.busy()) return;
    const occupied = this.game.board().edges.find((e) => e.from === node.id);
    if (occupied && !this.branches(node)) {
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
      if (target)
        this.finishConnection(
          target.dataset['input']!,
          target.dataset['port'] as InputPort | undefined,
        );
      else this.cancelWire();
    }
  }
  outputClick(event: MouseEvent, id: string): void {
    event.stopPropagation();
    if (event.detail === 0 && !this.game.trainer.busy()) {
      const occupied = this.game.board().edges.find((e) => e.from === id);
      const node = this.game.board().nodes.find((n) => n.id === id);
      if (occupied && !(node && this.branches(node))) this.chooseEdge(occupied);
      else {
        this.pending.set(id);
        this.pointer.set(null);
      }
    }
  }
  /** Sequence outputs may feed several sockets, such as a block and a shortcut. */
  branches(node: BlockNode): boolean {
    return this.portType(node, 'output') === 'sequence';
  }
  finishConnection(id: string, port?: InputPort): void {
    const from = this.pending();
    if (this.game.trainer.busy()) return;
    if (!from) {
      const occupied = this.game
        .board()
        .edges.find((e) => e.to === id && (e.port ?? null) === (port ?? null));
      if (occupied) this.chooseEdge(occupied);
      return;
    }
    const error = this.wireError(id, port);
    if (error) {
      this.game.message.set(error);
      this.rejected.set({
        edge: port ? { from, to: id, port } : { from, to: id },
        context: this.helperContext(),
      });
      this.cancelWire();
      return;
    }
    this.game.edit(
      port ? connect(this.game.board(), from, id, port) : attachStacks(this.game.board(), from, id),
    );
    this.cancelWire();
    this.celebrateConnection(from, id);
  }
  portLabel(node: BlockNode, side: 'input' | 'output', port?: InputPort): string {
    const type = this.portType(node, side);
    const classes = classCount(this.boardWorld());
    if (type === 'image') return '28 × 28 × 1';
    if (type === 'tokens') return `${CONTEXT} letters`;
    if (node.kind === 'classifier') return '10 probabilities';
    if (node.kind === 'writer') return `${classes} letter chances`;
    const shortcut = port
      ? this.game.board().edges.find((e) => e.to === node.id && e.port === port)?.from
      : undefined;
    const width = port
      ? shortcut && this.shapes().get(shortcut)?.output
      : (this.shapes().get(node.id)?.[side] ??
        (side === 'output' ? BLOCKS[node.kind].inferWidth(node) : undefined));
    if (port) return `Shortcut · ${width || 'N'}`;
    if (type === 'sequence') return `${CONTEXT} letters × ${width ?? 'N'}`;
    if (type === 'probabilities' && this.boardWorld() === 'text')
      return `${classes} letter chances`;
    return `${type === 'probabilities' ? 'Probabilities' : 'Vector'} · ${width ?? 'N'}`;
  }
  wireError(id: string, port?: InputPort): string | null {
    const from = this.pending();
    return from ? newConnectionError(this.game.board(), from, id, this.shapes(), port) : null;
  }
  compatible(id: string, port?: InputPort): boolean {
    return !!this.pending() && !this.wireError(id, port);
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
    const board = this.game.board();
    const target = board.nodes.find((n) => n.id === edge.to)!;
    this.game.edit(
      edge.port
        ? {
            ...board,
            edges: board.edges.filter((e) => this.edgeKey(e) !== this.edgeKey(edge)),
          }
        : moveStack(board, target.id, { x: target.x + 32, y: target.y + 40 }),
    );
    this.selectedEdge.set(null);
  }
  /** Tapping the trashcan deletes the selected block, for anyone who cannot drag. */
  deleteSelected(): void {
    const id = this.game.selected();
    if (id && this.game.board().nodes.some((n) => n.id === id)) this.deleteNode(id);
  }
  deleteNode(id: string): void {
    if (this.game.trainer.busy()) return;
    this.game.edit(removeNode(this.game.board(), id));
    this.picked.update((ids) => ids.filter((other) => other !== id));
    this.cancelWire();
    this.sound.play('trash');
    this.flash(this.gulping, true, false);
    this.announcement.set('Block thrown away. Undo can bring it back.');
  }
  locked(tile: Tile): boolean {
    return tile.era > this.game.unlockedEra();
  }
  exists(tile: Tile): boolean {
    return (
      ['image', 'classifier', 'text', 'writer'].includes(tile.kind) &&
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
    if (Math.hypot(p.x - this.tileDrag.start.x, p.y - this.tileDrag.start.y) > 8) {
      this.trayGhost.set({ tile: this.tileDrag.tile, point: p });
      this.dragIntent.set({
        point: { x: event.clientX, y: event.clientY },
        tile: this.tileDrag.tile,
      });
    }
  }
  tileEnd(event: PointerEvent): void {
    if (!this.tileDrag) return;
    const tile = this.tileDrag.tile,
      dragging = !!this.trayGhost();
    this.tileDrag = undefined;
    this.dragIntent.set(null);
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
    this.dragIntent.set(null);
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
      ...(tile.kind === 'dense'
        ? {
            units:
              this.boardWorld() === 'text'
                ? 48
                : this.game.mode() === 'journey' && this.game.era() === 0
                  ? 10
                  : 32,
          }
        : {}),
      ...(tile.kind === 'embedding' ? { units: 48 } : {}),
      ...(tile.kind === 'attention' ? { heads: 4 } : {}),
      ...(tile.activation ? { activation: tile.activation } : {}),
      ...(tile.kind === 'custom'
        ? {
            repeat: 1,
            blocks: starterRecipe(
              this.game.activations().some((a) => a.value === 'relu') ? 'relu' : 'tanh',
              () => crypto.randomUUID(),
            ),
          }
        : {}),
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
    let board = { ...this.game.board(), nodes: [...this.game.board().nodes, node] };
    const rect = this.paper().nativeElement.getBoundingClientRect(),
      view = board.viewport;
    const recipe = point
      ? this.recipeAt({
          x: rect.left + point.x * view.zoom + view.x,
          y: rect.top + point.y * view.zoom + view.y,
        })
      : null;
    if (recipe) {
      const inserted = insertIntoRecipe(board, recipe.id, [node.id], recipe.index);
      if (typeof inserted !== 'string') {
        this.game.edit(inserted);
        this.tray.set(false);
        return;
      }
      this.game.message.set(inserted);
    }
    const selected = this.game.selected();
    const tail = selected ? stackIds(board, selected).at(-1) : undefined;
    const snap = stackSnapTarget(board, node);
    if (snap) board = applyStackDrop(board, node, snap);
    else if (!point && tail) board = attachStacks(board, tail, node.id);
    this.game.edit(board);
    this.game.selected.set(node.id);
    this.tray.set(false);
    this.sound.play('drop');
    this.flash(this.fresh, node.id, null);
    this.announcement.set(`${tile.name} is on the paper.`);
  }
  clearSelection(): void {
    this.game.selected.set(null);
    this.picked.set([]);
    this.selectedEdge.set(null);
    this.cancelWire();
    this.tray.set(false);
  }
  @HostListener('document:keydown', ['$event']) key(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    if (
      target.closest(
        'input,select,textarea,[contenteditable="true"],dialog,[role="dialog"],app-blocky',
      )
    )
      return;
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
      this.game.edit(
        moveStack(this.game.board(), node.id, {
          x:
            node.x +
            (event.key === 'ArrowRight' ? amount : event.key === 'ArrowLeft' ? -amount : 0),
          y: node.y + (event.key === 'ArrowDown' ? amount : event.key === 'ArrowUp' ? -amount : 0),
        }),
      );
    }
  }
}
