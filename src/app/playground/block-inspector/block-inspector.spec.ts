import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BlockInspector } from './block-inspector';
import { GameService } from '../game.service';
import { DATASETS } from '../../learning/datasets';
import { BlockNode, Board, NetworkSpec } from '../graph';

function setup(kind: 'dense' | 'activation' | 'softmax') {
  const node: BlockNode = { id: 'block', kind, units: 2, activation: 'relu', x: 0, y: 0 };
  const board: Board = { nodes: [node], edges: [], viewport: { x: 0, y: 0, zoom: 1 } };
  const network: NetworkSpec = {
    steps:
      kind === 'dense'
        ? [{ kind, units: 2 }]
        : kind === 'activation'
          ? [{ kind, activation: 'relu' }]
          : [{ kind }],
    signature: kind,
    nodeIds: ['block'],
    parameters: 8,
  };
  const snapshot =
    kind === 'dense'
      ? { inputs: [1, 2, 3], outputs: [4, 5], weights: [1, 2, 3, 4, 5, 6], biases: [0.1, 0.2] }
      : { inputs: [-1, 2], outputs: kind === 'activation' ? [0, 2] : [0.1, 0.9] };
  const trainer = {
    modelRevision: signal(0),
    hasUpdates: signal(false),
    busy: signal(false),
    trained: signal(false),
    prepare: jasmine.createSpy().and.resolveTo(true),
    inspect: jasmine.createSpy().and.returnValue(snapshot),
  };
  const game = {
    trainer,
    board: signal(board),
    compilation: signal({ network, issues: [] }),
    dataset: signal(DATASETS.mnist),
    pixels: signal(new Float32Array(784)),
    snippet: signal(null),
    prompt: signal('ROMEO:'),
  };
  TestBed.configureTestingModule({
    imports: [BlockInspector],
    providers: [provideZonelessChangeDetection(), { provide: GameService, useValue: game }],
  });
  const fixture = TestBed.createComponent(BlockInspector);
  fixture.componentRef.setInput('target', { id: 'block' });
  return { fixture, trainer };
}

describe('Block inspector dialogs', () => {
  it('shows initialized weights and switches to live learned snapshots without rebuilding', async () => {
    const { fixture, trainer } = setup('dense');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role=dialog]')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Initialized weights');
    expect(fixture.nativeElement.querySelectorAll('.heatmap span').length).toBe(3);
    const field = fixture.nativeElement.querySelector('.neuron-picker input') as HTMLInputElement;
    field.value = '2';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    expect(fixture.componentInstance.connections().map((v) => v.weight)).toEqual([2, 4, 6]);
    trainer.hasUpdates.set(true);
    trainer.trained.set(true);
    trainer.modelRevision.update((n) => n + 1);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Learned weights');
    expect(trainer.inspect).toHaveBeenCalledTimes(2);
    fixture.destroy();
  });
  it('explores an activation curve while retaining actual model values below', async () => {
    const { fixture } = setup('activation');
    await fixture.whenStable();
    const slider = fixture.nativeElement.querySelector(
      '[aria-label="Activation example input"]',
    ) as HTMLInputElement;
    slider.value = '-2';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    expect(fixture.componentInstance.evaluate(-2)).toBe(0);
    expect(
      fixture.nativeElement.querySelector('.activation-graph path.curve').getAttribute('d'),
    ).toContain('M');
    expect(fixture.nativeElement.textContent).toContain('f(x) = max(0, x)');
    expect(fixture.componentInstance.numberRows().map((v) => v.output)).toEqual([0, 2]);
    fixture.destroy();
  });
  it('shows Softmax formula, input/output numbers, total and Escape close', async () => {
    const { fixture } = setup('softmax');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[aria-label="Softmax formula"]')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('100%');
    expect(fixture.componentInstance.numberRows().map((v) => v.input)).toEqual([-1, 2]);
    const closed = jasmine.createSpy();
    fixture.componentInstance.close.subscribe(closed);
    fixture.nativeElement
      .querySelector('[role=dialog]')
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(closed).toHaveBeenCalled();
    fixture.destroy();
  });
});

describe('Disconnected block explanations', () => {
  it('keeps the Softmax formula visible when actual runtime numbers are unavailable', async () => {
    const { fixture, trainer } = setup('softmax');
    const game = fixture.componentInstance.game;
    (game.compilation as unknown as { set(value: unknown): void }).set({
      network: null,
      issues: [],
    });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[aria-label="Softmax formula"]')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('complete network');
    expect(trainer.inspect).not.toHaveBeenCalled();
    fixture.destroy();
  });
});
