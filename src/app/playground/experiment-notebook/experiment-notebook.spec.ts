import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ExperimentNotebook } from './experiment-notebook';
import { GameService } from '../game.service';
import { DATASETS } from '../../learning/datasets';
import { IMAGE_TRAINING } from '../../learning/training-config';
import { TEXT_TRAINING } from '../../learning/shakespeare';

function setup() {
  const game = {
    dataset: signal(DATASETS.mnist),
    workspace: signal({ experiments: [] }),
    board: signal({ nodes: [], edges: [] }),
    compilation: signal({ network: null, issues: [] }),
    trainer: {
      epochs: signal<{ loss: number }[]>([]),
      busy: signal(false),
      status: signal('Ready when you are'),
    },
  };
  TestBed.configureTestingModule({
    imports: [ExperimentNotebook],
    providers: [provideZonelessChangeDetection(), { provide: GameService, useValue: game }],
  });
  const fixture = TestBed.createComponent(ExperimentNotebook);
  fixture.componentRef.setInput('expanded', true);
  return { fixture, game };
}

describe('Training recipe', () => {
  it('shows the runtime image settings and switches to the text recipe with the dataset', async () => {
    const { fixture, game } = setup();
    await fixture.whenStable();
    let settings = fixture.componentInstance.settings();
    expect(settings.find((s) => s.name === 'Optimizer')?.value).toBe('Adam');
    expect(settings.find((s) => s.name === 'Learning rate')?.value).toBe(
      String(IMAGE_TRAINING.learningRate),
    );
    expect(settings.find((s) => s.name === 'Batch size')?.value).toBe(
      `${IMAGE_TRAINING.batch} images`,
    );
    expect(fixture.nativeElement.textContent).toContain('Shuffled each pass');
    game.dataset.set(DATASETS['tiny-shakespeare']);
    await fixture.whenStable();
    settings = fixture.componentInstance.settings();
    expect(settings.find((s) => s.name === 'Learning rate')?.value).toBe(
      String(TEXT_TRAINING.learningRate),
    );
    expect(settings.find((s) => s.name === 'Batch size')?.value).toBe(
      `${TEXT_TRAINING.batch} sequences`,
    );
    expect(fixture.nativeElement.textContent).toContain('600 steps');
    expect(fixture.nativeElement.textContent).toContain('32 characters');
    expect(fixture.nativeElement.textContent).toContain('final 10% held out');
    fixture.destroy();
  });
  it('keeps all six text rounds inside the chart and labels held-out loss accurately', async () => {
    const { fixture, game } = setup();
    game.dataset.set(DATASETS['tiny-shakespeare']);
    game.trainer.epochs.set([3, 2.7, 2.5, 2.3, 2.2, 2.1].map((loss) => ({ loss })));
    await fixture.whenStable();
    const xs = fixture.componentInstance
      .lossPoints()
      .split(' ')
      .map((p) => Number(p.split(',')[0]));
    expect(xs[0]).toBe(10);
    expect(xs.at(-1)).toBe(220);
    expect(xs.every((x) => x >= 10 && x <= 220)).toBeTrue();
    expect(fixture.nativeElement.querySelector('svg').getAttribute('aria-label')).toBe(
      'Held-out loss by round',
    );
    fixture.destroy();
  });
});
