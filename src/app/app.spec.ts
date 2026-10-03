import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
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
