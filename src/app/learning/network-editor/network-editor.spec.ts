import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NetworkEditor } from './network-editor';

describe('NetworkEditor', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [NetworkEditor],
      providers: [provideZonelessChangeDetection()],
    }),
  );
  it('shows the actual neuron count when options first render and when a new activation unlocks', async () => {
    const fixture = TestBed.createComponent(NetworkEditor);
    fixture.componentRef.setInput('blocks', [{ id: 1, units: 32, activation: 'linear' }]);
    fixture.componentRef.setInput('era', 0);
    await fixture.whenStable();
    const selects = fixture.nativeElement.querySelectorAll(
      'select',
    ) as NodeListOf<HTMLSelectElement>;
    expect(selects[0].value).toBe('32');
    expect(selects[1].options.length).toBe(1);
    fixture.componentRef.setInput('era', 2);
    fixture.componentRef.setInput('blocks', [{ id: 1, units: 64, activation: 'relu' }]);
    await fixture.whenStable();
    expect(selects[0].value).toBe('64');
    expect(selects[1].value).toBe('relu');
    expect(selects[1].options.length).toBe(4);
  });
  it('disables editing while training and preserves the layer limit', async () => {
    const fixture = TestBed.createComponent(NetworkEditor);
    fixture.componentRef.setInput(
      'blocks',
      [1, 2, 3].map((id) => ({ id, units: 32, activation: 'linear' })),
    );
    fixture.componentRef.setInput('era', 0);
    fixture.componentRef.setInput('busy', true);
    await fixture.whenStable();
    const emit = spyOn(fixture.componentInstance.blocksChange, 'emit');
    fixture.componentInstance.addBlock();
    fixture.componentInstance.removeBlock(1);
    expect(emit).not.toHaveBeenCalled();
    expect(
      [...fixture.nativeElement.querySelectorAll('select')].every(
        (el: HTMLSelectElement) => el.disabled,
      ),
    ).toBeTrue();
    expect(
      (fixture.nativeElement.querySelector('.add-layer') as HTMLButtonElement).disabled,
    ).toBeTrue();
  });
});
