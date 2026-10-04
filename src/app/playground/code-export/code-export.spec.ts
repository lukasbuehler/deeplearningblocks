import { DATASETS } from '../../learning/datasets';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GameService } from '../game.service';
import { compileBoard, NetworkSpec } from '../graph';
import { CodeExport } from './code-export';

describe('Code export', () => {
  const network: NetworkSpec = {
    steps: [{ kind: 'flatten' }, { kind: 'dense', units: 10 }, { kind: 'softmax' }],
    signature: 'test',
    parameters: 7850,
    nodeIds: ['image', 'flatten', 'guess'],
  };
  const compilation = signal<ReturnType<typeof compileBoard>>({ network, issues: [] });
  beforeEach(() => {
    compilation.set({ network, issues: [] });
    TestBed.configureTestingModule({
      imports: [CodeExport],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: GameService,
          useValue: { compilation, dataset: signal(DATASETS['fashion-mnist']) },
        },
      ],
    });
  });
  it('offers guidance without downloads for an incomplete path', () => {
    compilation.set({ network: null, issues: [] });
    const fixture = TestBed.createComponent(CodeExport);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Connect the image');
    expect(fixture.nativeElement.querySelector('.downloads')).toBeNull();
    expect(fixture.nativeElement.querySelector('pre')).toBeNull();
  });
  it('downloads complete Python and notebook blobs even while showing only the model', async () => {
    const fixture = TestBed.createComponent(CodeExport);
    fixture.detectChanges();
    const blobs: Blob[] = [];
    const names: string[] = [];
    spyOn(URL, 'createObjectURL').and.callFake((blob: Blob | MediaSource) => {
      blobs.push(blob as Blob);
      return 'blob:test';
    });
    spyOn(HTMLAnchorElement.prototype, 'click').and.callFake(function (this: HTMLAnchorElement) {
      names.push(this.download);
    });
    fixture.nativeElement.querySelector('.python').click();
    fixture.nativeElement.querySelector('.notebook').click();
    expect(names).toEqual(['deep-learning-blocks.py', 'deep-learning-blocks.ipynb']);
    const python = await blobs[0].text();
    const notebook = JSON.parse(await blobs[1].text());
    expect(python).toContain('for epoch in range(5)');
    expect(python).toContain('nn.Linear(784, 10)');
    expect(python).toContain('datasets.FashionMNIST');
    expect(notebook.nbformat).toBe(4);
    expect(
      notebook.cells.some((cell: { source: string[] }) =>
        cell.source.join('').includes('model.eval()'),
      ),
    ).toBeTrue();
    expect(fixture.componentInstance.fullRecipe()).toBeFalse();
  });
});
