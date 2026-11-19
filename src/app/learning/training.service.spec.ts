import { TrainingService } from './training.service';

async function images(label: number): Promise<Response> {
  const records = new Uint8Array(500 * 785);
  for (let i = 0; i < 500; i++) records[i * 785] = label;
  const body = new Blob([records]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Response(await new Response(body).arrayBuffer());
}

describe('Dataset previews', () => {
  it('loads clothing bytes already decompressed by the local server and bypasses stale HTTP cache', async () => {
    const compressed = await images(8);
    const raw = await new Response(
      compressed.body!.pipeThrough(new DecompressionStream('gzip')),
    ).arrayBuffer();
    const fetcher = spyOn(window, 'fetch').and.resolveTo(
      new Response(raw, { headers: { 'Content-Encoding': 'gzip' } }),
    );
    const service = new TrainingService();
    await service.loadPreview('fashion-mnist');
    expect(service.test()!.count).toBe(500);
    expect(service.test()!.labels[0]).toBe(8);
    expect(fetcher.calls.mostRecent().args[1]?.cache).toBe('no-store');
  });
  it('isolates cached datasets and ignores a slower preview from a previous level', async () => {
    const service = new TrainingService();
    let resolveDigits!: (response: Response) => void;
    const digits = new Promise<Response>((resolve) => (resolveDigits = resolve));
    const fashion = await images(8);
    const fetcher = spyOn(window, 'fetch').and.callFake((url) =>
      String(url).includes('fashion-mnist') ? Promise.resolve(fashion) : digits,
    );
    const slow = service.loadPreview('mnist');
    await service.loadPreview('fashion-mnist');
    expect(service.test()!.labels[0]).toBe(8);
    resolveDigits(await images(3));
    await slow;
    expect(service.test()!.labels[0]).toBe(8);
    await service.loadPreview('mnist');
    expect(service.test()!.labels[0]).toBe(3);
    await service.loadPreview('fashion-mnist');
    expect(service.test()!.labels[0]).toBe(8);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('clears the old preview immediately and retries a failed dataset download', async () => {
    const service = new TrainingService();
    const fetcher = spyOn(window, 'fetch').and.resolveTo(await images(3));
    await service.loadPreview('mnist');
    service.trained.set(true);
    fetcher.and.rejectWith(new Error('offline'));
    const failed = service.loadPreview('fashion-mnist');
    expect(service.test()).toBeNull();
    expect(service.trained()).toBeFalse();
    await expectAsync(failed).toBeRejectedWithError('offline');
    fetcher.and.resolveTo(await images(9));
    await service.loadPreview('fashion-mnist');
    expect(service.test()!.labels[0]).toBe(9);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});

describe('Inspectable model lifecycle', () => {
  const network = {
    steps: [
      { kind: 'flatten' as const },
      { kind: 'dense' as const, units: 10 },
      { kind: 'softmax' as const },
    ],
    signature: 'inspection-model',
    nodeIds: [],
    parameters: 7850,
  };

  it('trains the inspected initialized model and exposes updated weights', async () => {
    const tf = await import('./tensorflow');
    await tf.setBackend('cpu');
    const service = new TrainingService();
    const data = {
      count: 4,
      pixels: new Float32Array(4 * 784).fill(0.5),
      labels: new Uint8Array([1, 1, 1, 1]),
    };
    spyOn<any>(service, 'load').and.resolveTo(data);
    expect(await service.prepare(network, 'mnist')).toBeTrue();
    const model = (service as unknown as { model: object }).model;
    const pixels = data.pixels.slice(0, 784);
    const initialized = service.inspect(1, pixels)!;
    expect(service.hasUpdates()).toBeFalse();
    expect(await service.prepare(network, 'mnist')).toBeTrue();
    expect(service.inspect(1, pixels)!.weights).toEqual(initialized.weights);
    await service.train(network, 'mnist');
    expect((service as unknown as { model: object }).model).toBe(model);
    expect(service.trained()).toBeTrue();
    expect(service.hasUpdates()).toBeTrue();
    expect(service.inspect(1, pixels)!.weights).not.toEqual(initialized.weights);
    service.invalidate();
    expect(service.inspect(1, pixels)).toBeNull();
    expect(service.hasUpdates()).toBeFalse();
  }, 30000);

  it('does not install an obsolete model when a board changes during initialization', async () => {
    const service = new TrainingService();
    const pending = service.prepare(network, 'mnist');
    service.invalidate();
    expect(await pending).toBeFalse();
    expect(service.inspect(1)).toBeNull();
    expect(await service.prepare(network, 'mnist')).toBeTrue();
    expect(service.inspect(1)!.weights!.length).toBe(7840);
    service.invalidate();
  });
});

describe('Stopping before training starts', () => {
  it('can stop safely while an inspected image model is still uncompiled', async () => {
    const service = new TrainingService();
    await service.prepare(
      {
        steps: [{ kind: 'flatten' }, { kind: 'dense', units: 10 }, { kind: 'softmax' }],
        signature: 'before-compile',
        nodeIds: [],
        parameters: 7850,
      },
      'mnist',
    );
    expect(() => service.stop()).not.toThrow();
    expect(service.inspect(1)!.weights!.length).toBe(7840);
    service.invalidate();
  });
});
