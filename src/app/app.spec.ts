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
  it('keeps Blocky and an expanded clue visible while panning, with the target following the board', () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.game.save.set(freshGame());
    fixture.detectChanges();
    const canvas = fixture.componentInstance.canvas()!;
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
