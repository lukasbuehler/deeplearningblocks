import { TrainingService } from './training.service';

async function images(label: number): Promise<Response> {
  const records = new Uint8Array(500 * 785);
  for (let i = 0; i < 500; i++) records[i * 785] = label;
  const body = new Blob([records]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Response(await new Response(body).arrayBuffer());
}

describe('Dataset previews', () => {
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
