import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GameService } from './game.service';
import { TrainingService } from '../learning/training.service';
import { Board, compileBoard } from './graph';
import { freshGame } from './storage';

const connected = (): Board => ({
  nodes: [
    { id: 'i', kind: 'image', x: 0, y: 0 },
    { id: 'f', kind: 'flatten', x: 0, y: 250 },
    { id: 'd', kind: 'dense', units: 32, x: 0, y: 450 },
    { id: 'c', kind: 'classifier', x: 0, y: 650 },
  ],
  edges: [
    { from: 'i', to: 'f' },
    { from: 'f', to: 'd' },
    { from: 'd', to: 'c' },
  ],
  viewport: { x: 0, y: 0, zoom: 1 },
});
describe('Playground state', () => {
  let game: GameService;
  let trainer: {
    busy: ReturnType<typeof signal<boolean>>;
    status: ReturnType<typeof signal<string>>;
    epochs: ReturnType<typeof signal<never[]>>;
    test: ReturnType<typeof signal<null>>;
    invalidate: jasmine.Spy;
    loadPreview: jasmine.Spy;
    train: jasmine.Spy;
    predict: jasmine.Spy;
  };
  beforeEach(() => {
    trainer = {
      busy: signal(false),
      status: signal(''),
      epochs: signal([]),
      test: signal(null),
      invalidate: jasmine.createSpy(),
      loadPreview: jasmine.createSpy().and.resolveTo(),
      train: jasmine.createSpy().and.resolveTo({ accuracy: 0.9, loss: 0.2 }),
      predict: jasmine.createSpy().and.returnValue([0.1]),
    };
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: TrainingService, useValue: trainer },
      ],
    });
    game = TestBed.inject(GameService);
    game.save.set(freshGame());
    game.edit(connected());
    trainer.invalidate.calls.reset();
  });
  it('retains predictions for layout and loose nodes, invalidates active changes, supports undo', () => {
    game.probabilities.set([0.9]);
    game.configure({ id: 'd', x: 300 });
    game.setViewport({ x: 20, y: 30, zoom: 0.5 });
    game.edit({
      ...game.board(),
      nodes: [...game.board().nodes, { id: 'loose', kind: 'dense', units: 128, x: 0, y: 0 }],
    });
    expect(trainer.invalidate).not.toHaveBeenCalled();
    expect(game.probabilities()).toEqual([0.9]);
    game.configure({ id: 'd', units: 64 });
    expect(trainer.invalidate).toHaveBeenCalledTimes(1);
    expect(game.probabilities()).toEqual([]);
    game.undo();
    expect(compileBoard(game.board()).network?.parameters).toBe(25450);
    game.redo();
    expect(compileBoard(game.board()).network?.parameters).toBe(50890);
  });
  it('permits movement during training but prevents computational edits', () => {
    trainer.busy.set(true);
    game.edit({ ...game.board(), nodes: game.board().nodes.map((n) => ({ ...n, x: 100 })) });
    expect(game.board().nodes[0].x).toBe(100);
    game.configure({ id: 'd', units: 128 });
    expect(game.board().nodes.find((n) => n.id === 'd')?.units).toBe(32);
    game.switchMode('sandbox');
    expect(game.mode()).toBe('journey');
    expect(trainer.invalidate).not.toHaveBeenCalled();
  });
  it('keeps Sandbox experiments from advancing Journey and restores separate boards', async () => {
    game.switchMode('sandbox');
    expect(game.board().edges.length).toBe(0);
    game.edit(connected());
    await game.train();
    expect(game.save().era).toBe(0);
    expect(game.save().sandbox.experiments.length).toBe(1);
    expect(game.save().journey.experiments.length).toBe(0);
    game.switchMode('journey');
    await game.train();
    expect(game.save().era).toBe(1);
    expect(game.save().journey.experiments.length).toBe(1);
  });
  it('does not record cancelled training or unlock a chapter', async () => {
    trainer.train.and.resolveTo(null);
    await game.train();
    expect(game.save().era).toBe(0);
    expect(game.workspace().experiments.length).toBe(0);
  });
  it('exposes a retry after dataset failure', async () => {
    trainer.loadPreview.and.rejectWith(new Error('offline'));
    await game.loadPreview();
    expect(game.error()).toContain('retry');
    trainer.loadPreview.and.resolveTo();
    await game.loadPreview();
    expect(game.error()).toBe('');
  });
});
