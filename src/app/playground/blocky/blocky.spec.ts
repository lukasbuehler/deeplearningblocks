import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Blocky } from './blocky';

describe('Blocky preferences and clues', () => {
  beforeEach(() => {
    localStorage.removeItem('dlb-blocky-v1');
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  });
  afterEach(() => localStorage.removeItem('dlb-blocky-v1'));
  it('lets players dismiss, ask again, mute and unmute immediately', () => {
    const f = TestBed.createComponent(Blocky),
      c = f.componentInstance;
    f.componentRef.setInput('hint', {
      id: 'gap',
      text: 'Connect the blocks',
      why: 'Follow the shapes',
      target: { kind: 'tray' },
    });
    f.componentRef.setInput('context', 'board');
    f.detectChanges();
    c.ask();
    f.detectChanges();
    expect(c.open()).toBeTrue();
    c.dismiss();
    f.detectChanges();
    expect(c.open()).toBeFalse();
    c.ask();
    f.detectChanges();
    expect(c.open()).toBeTrue();
    c.mute();
    f.detectChanges();
    expect(c.open()).toBeFalse();
    expect(JSON.parse(localStorage.getItem('dlb-blocky-v1')!).muted).toBeTrue();
    c.ask();
    f.detectChanges();
    expect(c.open()).toBeTrue();
    f.componentRef.setInput('suppressed', true);
    f.detectChanges();
    expect(f.nativeElement.querySelector('section')).toBeNull();
    f.componentRef.setInput('context', 'another-board');
    f.detectChanges();
    expect(c.open()).toBeFalse();
    f.destroy();
  });
});
