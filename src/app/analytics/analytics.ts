import { Injectable, InjectionToken, inject } from '@angular/core';
import type { PostHog } from 'posthog-js';
import {
  LearningEvent,
  LearningEventProperties,
  POSTHOG_OPTIONS,
  analyticsAllowed,
  parseAnalyticsConfig,
} from './analytics-policy';

type Client = Pick<PostHog, 'init' | 'capture'>;
export const ANALYTICS_RUNTIME = new InjectionToken('analytics runtime', {
  providedIn: 'root',
  factory: () => ({
    allowed: () =>
      analyticsAllowed(window.location, {
        globalPrivacyControl: (navigator as Navigator & { globalPrivacyControl?: boolean })
          .globalPrivacyControl,
        doNotTrack: navigator.doNotTrack,
      }),
    config: async (): Promise<unknown> => {
      const response = await fetch('/analytics-config.json', {
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok ? response.json() : null;
    },
    client: async (): Promise<Client> => (await import('posthog-js/no-external')).default,
  }),
});

/** Best-effort usage events. Analytics never gates play, training, saving or export. */
@Injectable({ providedIn: 'root' })
export class Analytics {
  private readonly runtime = inject(ANALYTICS_RUNTIME);
  private ready?: Promise<Client | null>;

  private async initialize(): Promise<Client | null> {
    try {
      if (!this.runtime.allowed()) return null;
      const config = parseAnalyticsConfig(await this.runtime.config());
      if (!config) return null;
      const client = await this.runtime.client();
      client.init(config.token, { ...POSTHOG_OPTIONS, api_host: config.host });
      client.capture('$pageview');
      return client;
    } catch {
      return null;
    }
  }
  track(event: LearningEvent, properties: LearningEventProperties = {}): void {
    const snapshot = { ...properties };
    this.ready ??= this.initialize();
    void this.ready
      .then((client) => client?.capture(event, snapshot))
      .catch(() => {
        // SDK/network failures must not become application errors.
      });
  }
}
