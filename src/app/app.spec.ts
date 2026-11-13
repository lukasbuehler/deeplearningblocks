import { Board } from './playground/graph';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Blocky } from './playground/blocky/blocky';
import { freshGame } from './playground/storage';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.sidebar.set(true);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Big ideas.');
  });
  it('offers Sandbox as an unlocked level and keeps Journey navigation available inside it', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.game.save.set(freshGame());
    app.sidebar.set(true);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const sandbox = root.querySelector<HTMLButtonElement>('.sandbox-level')!;
    expect(sandbox.disabled).toBeFalse();
    expect(root.querySelector('header .mode-switch')).toBeNull();
    const journeyBoard = app.game.board();
    sandbox.click();
    fixture.detectChanges();
    expect(app.game.mode()).toBe('sandbox');
    expect(sandbox.getAttribute('aria-current')).toBe('page');
    expect(root.querySelectorAll('.chapters button').length).toBe(5);
    const lessons = root.querySelectorAll<HTMLButtonElement>(
      '.chapters button:not(.sandbox-level)',
    );
    expect(lessons[1].disabled).toBeTrue();
    expect(lessons[0].getAttribute('aria-current')).toBeNull();
    app.game.configure({ id: 'image', x: 987 });
    lessons[0].click();
    fixture.detectChanges();
    expect(app.game.mode()).toBe('journey');
    expect(app.game.board()).toEqual(journeyBoard);
    expect(lessons[0].getAttribute('aria-current')).toBe('step');
    expect(sandbox.getAttribute('aria-current')).toBeNull();
    sandbox.click();
    fixture.detectChanges();
    expect(app.game.board().nodes.find((n) => n.id === 'image')?.x).toBe(987);
    fixture.destroy();
  });
  it('keeps Blocky and an expanded clue visible while panning, with the target following the board', () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.game.save.set(freshGame());
    fixture.detectChanges();
    const canvas = fixture.componentInstance.canvas()!;
    canvas.paperSize.set({ width: 800, height: 600 });
    canvas.game.setViewport({ x: 0, y: 0, zoom: 1 });
    canvas.game.configure({ id: 'image', x: 100, y: 200 });
    const helper = fixture.debugElement.query(By.directive(Blocky)).componentInstance as Blocky;
    helper.ask();
    fixture.detectChanges();
    helper.details.set(true);
    fixture.detectChanges();
    const before = canvas.pointerGeometry()!.end;
    canvas.panning.set(true);
    const view = canvas.game.board().viewport;
    canvas.game.setViewport({ ...view, x: view.x + 80, y: view.y + 40 });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-blocky .character')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-blocky .bubble')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-blocky .why')).toBeTruthy();
    expect(canvas.highlightedNode()).toBe('image');
    expect(canvas.pointerGeometry()!.end.x).toBeCloseTo(before.x + 80, 6);
    expect(canvas.pointerGeometry()!.end.y).toBeCloseTo(before.y + 40, 6);
    canvas.panEnd();
    fixture.destroy();
  });
  it('keeps Blocky and an expanded clue visible during block dragging and tracks the moving target', () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.game.save.set(freshGame());
    fixture.detectChanges();
    const canvas = fixture.componentInstance.canvas()!;
    canvas.paperSize.set({ width: 800, height: 600 });
    canvas.game.setViewport({ x: 0, y: 0, zoom: 1 });
    canvas.game.configure({ id: 'image', x: 100, y: 200 });
    const helper = fixture.debugElement.query(By.directive(Blocky)).componentInstance as Blocky;
    helper.ask();
    fixture.detectChanges();
    helper.details.set(true);
    fixture.detectChanges();
    const character = fixture.nativeElement.querySelector('app-blocky .character');
    const before = canvas.pointerGeometry()!.end;
    const node = canvas.game.board().nodes.find((n) => n.kind === 'image')!;
    const zoom = canvas.game.board().viewport.zoom;
    canvas.draft.set({ ...node, x: node.x + 100, y: node.y + 60 });
    fixture.detectChanges();
    expect(canvas.helperSuppressed()).toBeFalse();
    expect(fixture.nativeElement.querySelector('app-blocky .character')).toBe(character);
    expect(fixture.nativeElement.querySelector('app-blocky .why')).toBeTruthy();
    expect(canvas.pointerGeometry()!.end.x).toBeCloseTo(before.x + 100 * zoom, 6);
    expect(canvas.pointerGeometry()!.end.y).toBeCloseTo(before.y + 60 * zoom, 6);
    const paper = fixture.nativeElement.querySelector('.paper').getBoundingClientRect();
    const mascot = character.getBoundingClientRect();
    expect(mascot.top - paper.top).toBeCloseTo(18, 0);
    canvas.draft.set(null);
    fixture.destroy();
  });
  it('offers the yellow toolbar check, directs Blocky to it, then keeps the completed canvas', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.game.save.set(freshGame());
    const nodes: Board['nodes'] = [
      { id: 'i', kind: 'image', x: 0, y: 0 },
      { id: 'f', kind: 'flatten', x: 0, y: 250 },
      { id: 'd', kind: 'dense', units: 10, x: 0, y: 450 },
      { id: 's', kind: 'softmax', x: 0, y: 650 },
      { id: 'c', kind: 'classifier', x: 0, y: 850 },
    ];
    app.game.edit({
      nodes,
      edges: nodes.slice(1).map((n, i) => ({ from: nodes[i].id, to: n.id })),
      viewport: { x: 0, y: 0, zoom: 1 },
    });
    fixture.detectChanges();
    const helper = fixture.debugElement.query(By.directive(Blocky)).componentInstance as Blocky;
    helper.ask();
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('.train-button') as HTMLButtonElement;
    expect(button.textContent).toContain('Check build');
    expect(button.classList.contains('check-ready')).toBeTrue();
    expect(app.canvas()!.helperTarget()?.kind).toBe('check');
    expect(fixture.nativeElement.querySelector('.toolbar-pointer')).toBeTruthy();
    app.canvas()!.showClueTarget();
    expect(document.activeElement).toBe(button);
    button.click();
    fixture.detectChanges();
    expect(app.game.levelComplete()).toBeTrue();
    expect(app.game.level().id).toBe('first-network');
    expect(button.textContent).toContain('Train');
    app.switchLevel('hidden-layers');
    fixture.detectChanges();
    expect(app.game.board().nodes.length).toBe(2);
    app.switchLevel('first-network');
    fixture.detectChanges();
    expect(app.game.board().nodes.length).toBe(5);
    fixture.destroy();
  });
  it('respects reduced motion when the browser requests it', () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.game.celebration.set('A new discovery');
    fixture.detectChanges();
    const banner = fixture.nativeElement.querySelector('.celebration') as HTMLElement;
    expect(banner).toBeTruthy();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches)
      expect(getComputedStyle(banner).animationName).toBe('none');
    else expect(getComputedStyle(banner).animationName).toContain('pop');
  });
});
