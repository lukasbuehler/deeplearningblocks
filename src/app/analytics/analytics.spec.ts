import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ANALYTICS_RUNTIME, Analytics } from './analytics';
import { POSTHOG_OPTIONS, analyticsAllowed, parseAnalyticsConfig } from './analytics-policy';

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
describe('Usage analytics', () => {
  let client: { init: jasmine.Spy; capture: jasmine.Spy };
  let runtime: { allowed: jasmine.Spy; config: jasmine.Spy; client: jasmine.Spy };
  beforeEach(() => {
    client = { init: jasmine.createSpy(), capture: jasmine.createSpy() };
    runtime = {
      allowed: jasmine.createSpy().and.returnValue(true),
      config: jasmine
        .createSpy()
        .and.resolveTo({ token: 'phc_test', host: 'https://eu.i.posthog.com' }),
      client: jasmine.createSpy().and.resolveTo(client),
    };
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: ANALYTICS_RUNTIME, useValue: runtime },
      ],
    });
  });
  it('initializes once, retains early events in order, and captures explicit context', async () => {
    const analytics = TestBed.inject(Analytics);
    analytics.track('workspace_opened', { mode: 'journey', dataset_id: 'mnist' });
    analytics.track('training_started', { parameter_count: 7850 });
    await flush();
    expect(client.init).toHaveBeenCalledTimes(1);
    expect(client.capture.calls.allArgs().map((args) => args[0])).toEqual([
      '$pageview',
      'workspace_opened',
      'training_started',
    ]);
    expect(client.capture).toHaveBeenCalledWith('workspace_opened', {
      mode: 'journey',
      dataset_id: 'mnist',
    });
    const options = client.init.calls.first().args[1];
    expect(options.disable_session_recording).toBeTrue();
    expect(options.disable_persistence).toBeTrue();
    expect(options.autocapture).toBeFalse();
  });
  it('does not fetch config or load the SDK on excluded hosts', async () => {
    runtime.allowed.and.returnValue(false);
    TestBed.inject(Analytics).track('$pageview');
    await flush();
    expect(runtime.config).not.toHaveBeenCalled();
    expect(runtime.client).not.toHaveBeenCalled();
  });
  it('skips invalid config and tolerates config, SDK and capture failures', async () => {
    runtime.config.and.resolveTo({ token: '', host: 'https://eu.i.posthog.com' });
    TestBed.inject(Analytics).track('workspace_opened');
    await flush();
    expect(runtime.client).not.toHaveBeenCalled();
  });
  for (const failure of ['config', 'client', 'capture'] as const) {
    it(`does not reject application actions when ${failure} fails`, async () => {
      if (failure === 'capture') client.capture.and.throwError('blocked');
      else runtime[failure].and.rejectWith(new Error('blocked'));
      expect(() => TestBed.inject(Analytics).track('workspace_opened')).not.toThrow();
      await flush();
    });
  }
  it('excludes local traffic, GPC and DNT and validates ingestion configuration', () => {
    const site = { hostname: 'example.com', protocol: 'https:' };
    for (const hostname of ['localhost', '127.0.0.1', '[::1]', 'test.localhost'])
      expect(analyticsAllowed({ hostname, protocol: 'https:' }, {})).toBeFalse();
    expect(analyticsAllowed(site, { globalPrivacyControl: true })).toBeFalse();
    expect(analyticsAllowed(site, { doNotTrack: '1' })).toBeFalse();
    expect(analyticsAllowed(site, { globalPrivacyControl: false, doNotTrack: '0' })).toBeTrue();
    expect(analyticsAllowed(site, { doNotTrack: null })).toBeTrue();
    expect(
      parseAnalyticsConfig({ token: 'phx_private', host: 'https://eu.i.posthog.com' }),
    ).toBeNull();
  });
  it('strips automatic URL/referrer properties and arbitrary application data before sending', () => {
    const filter = POSTHOG_OPTIONS.before_send;
    if (typeof filter !== 'function') throw new Error('Expected one event filter');
    const result = filter({
      uuid: 'test',
      event: 'training_completed',
      properties: {
        token: 'phc_test',
        distinct_id: 'temporary',
        dataset_id: 'mnist',
        accuracy: 0.8,
        $current_url: 'https://example.com/?private=value',
        $referrer: 'https://private.example',
        drawing: [1, 2, 3],
        board: { nodes: [] },
        error: 'sensitive detail',
        duration_ms: Infinity,
      },
    });
    expect(result?.properties).toEqual({
      token: 'phc_test',
      distinct_id: 'temporary',
      dataset_id: 'mnist',
      accuracy: 0.8,
      $geoip_disable: true,
    });
    expect(filter({ uuid: 'test', event: '$autocapture', properties: {} })).toBeNull();
    const page = filter({
      uuid: 'test',
      event: '$pageview',
      properties: { $current_url: 'https://example.com/level?secret=yes#drawing' },
    });
    expect(page?.properties['$current_url']).toBe('https://example.com/level');
    expect(page?.properties['$pathname']).toBe('/level');
  });
});
