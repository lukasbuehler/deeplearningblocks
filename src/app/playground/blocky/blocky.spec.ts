import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AUTO_HINT_DELAY, Blocky } from './blocky';

describe('Blocky preferences and clues', () => {
  beforeEach(() => {
    localStorage.removeItem('dlb-blocky-v1');
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  });
  afterEach(() => localStorage.removeItem('dlb-blocky-v1'));
  it('waits at least 15 seconds and restarts the delay when the build changes', () => {
    jasmine.clock().install();
    const fixture = TestBed.createComponent(Blocky);
    fixture.componentRef.setInput('hint', {
      id: 'flatten',
      text: 'Add Flatten',
      why: 'A picture needs flattening',
      target: { kind: 'tray' },
    });
    fixture.componentRef.setInput('context', 'first');
    fixture.detectChanges();
    try {
      jasmine.clock().tick(AUTO_HINT_DELAY - 1);
      expect(fixture.componentInstance.open()).toBeFalse();
      fixture.componentRef.setInput('context', 'changed');
      fixture.detectChanges();
      jasmine.clock().tick(AUTO_HINT_DELAY - 1);
      expect(fixture.componentInstance.open()).toBeFalse();
      jasmine.clock().tick(1);
      expect(fixture.componentInstance.open()).toBeTrue();
      fixture.componentRef.setInput('hint', null);
      fixture.detectChanges();
      fixture.componentInstance.ask();
      jasmine.clock().tick(AUTO_HINT_DELAY);
      expect(fixture.componentInstance.open()).toBeFalse();
    } finally {
      fixture.destroy();
      jasmine.clock().uninstall();
    }
  });
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
