import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BlockCard } from './block-card';

describe('Custom block repeat editing', () => {
  it('commits a valid count on input without waiting for blur', () => {
    TestBed.configureTestingModule({
      imports: [BlockCard],
      providers: [provideZonelessChangeDetection()],
    });
    const fixture = TestBed.createComponent(BlockCard);
    fixture.componentRef.setInput('node', {
      id: 'group',
      kind: 'custom',
      x: 0,
      y: 0,
      repeat: 1,
      blocks: [{ id: 'd', kind: 'dense', units: 32 }],
    });
    fixture.detectChanges();
    const changes: number[] = [];
    fixture.componentInstance.configure.subscribe((change) => changes.push(change.repeat!));
    const field = fixture.nativeElement.querySelector(
      '[aria-label="Number of copies"]',
    ) as HTMLInputElement;
    field.value = '3';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    expect(changes).toEqual([3]);
    field.value = '';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    expect(changes).toEqual([3]);
  });

  it('updates Dense studs on input and leaves a temporarily blank field editable', () => {
    TestBed.configureTestingModule({
      imports: [BlockCard],
      providers: [provideZonelessChangeDetection()],
    });
    const fixture = TestBed.createComponent(BlockCard);
    let node = { id: 'dense', kind: 'dense', x: 0, y: 0, units: 32 };
    fixture.componentRef.setInput('node', node);
    fixture.componentInstance.configure.subscribe((change) => {
      node = { ...node, ...change };
      fixture.componentRef.setInput('node', node);
    });
    fixture.detectChanges();
    const field = fixture.nativeElement.querySelectorAll(
      'input[type="number"]',
    )[1] as HTMLInputElement;
    field.value = '10';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(node.units).toBe(10);
    expect(fixture.componentInstance.connectors().output?.size).toBe(10);
    expect(
      fixture.componentInstance.connectorLabels().some((label) => label.text === '10'),
    ).toBeFalse();
    expect(fixture.nativeElement.querySelector('.block-outline').textContent).not.toContain('32');
    field.value = '';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(node.units).toBe(10);
    expect(field.value).toBe('');
  });
});

describe('Flexible Softmax', () => {
  it('shows symbolic sizes until attached, then matching input and output counts', () => {
    TestBed.configureTestingModule({
      imports: [BlockCard],
      providers: [provideZonelessChangeDetection()],
    });
    const fixture = TestBed.createComponent(BlockCard);
    fixture.componentRef.setInput('node', { id: 's', kind: 'softmax', x: 0, y: 0 });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('N scores → N probabilities');
    expect(fixture.componentInstance.connectors().input?.size).toBeUndefined();
    expect(fixture.componentInstance.connectors().output?.size).toBeUndefined();
    fixture.componentRef.setInput('inputSize', 3);
    fixture.componentRef.setInput('outputSize', 3);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('3 scores → 3 probabilities');
    expect(fixture.componentInstance.connectors().input?.size).toBe(3);
    expect(fixture.componentInstance.connectors().output?.size).toBe(3);
    fixture.destroy();
  });
});

describe('Block inspection routing', () => {
  it('opens an inspector from the question mark instead of the small help bubble', async () => {
    TestBed.configureTestingModule({
      imports: [BlockCard],
      providers: [provideZonelessChangeDetection()],
    });
    const fixture = TestBed.createComponent(BlockCard);
    fixture.componentRef.setInput('node', { id: 'dense', kind: 'dense', units: 10, x: 0, y: 0 });
    const inspect = jasmine.createSpy();
    fixture.componentInstance.inspect.subscribe(inspect);
    await fixture.whenStable();
    fixture.nativeElement.querySelector('.help').click();
    expect(inspect).toHaveBeenCalledWith({ id: 'dense' });
    expect(fixture.componentInstance.helpOpen()).toBeFalse();
    fixture.destroy();
  });
});

describe('Repeated copy inspection', () => {
  it('routes a repeated Dense question mark to that copy rather than the editable recipe', async () => {
    TestBed.configureTestingModule({
      imports: [BlockCard],
      providers: [provideZonelessChangeDetection()],
    });
    const fixture = TestBed.createComponent(BlockCard);
    fixture.componentRef.setInput('node', {
      id: 'group',
      kind: 'custom',
      repeat: 2,
      expanded: true,
      blocks: [{ id: 'dense', kind: 'dense', units: 4 }],
      x: 0,
      y: 0,
    });
    const inspect = jasmine.createSpy();
    fixture.componentInstance.inspect.subscribe(inspect);
    await fixture.whenStable();
    fixture.nativeElement.querySelector('[aria-label="Repeated copy"] .help').click();
    expect(inspect).toHaveBeenCalledWith({ id: 'group', innerId: 'dense', copy: 2 });
    fixture.destroy();
  });
});
