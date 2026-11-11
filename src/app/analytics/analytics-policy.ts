import type { PostHogConfig } from 'posthog-js';
import type { DatasetId } from '../learning/datasets';
import type { LevelId } from '../playground/levels';

export interface AnalyticsConfig {
  token: string;
  host: string;
}
export interface LearningEventProperties {
  mode?: 'journey' | 'sandbox';
  level_id?: LevelId | 'sandbox';
  dataset_id?: DatasetId;
  parameter_count?: number;
  dense_layers?: number;
  accuracy?: number;
  duration_ms?: number;
  format?: 'py' | 'ipynb';
}
export const EVENTS = [
  '$pageview',
  'workspace_opened',
  'level_completed',
  'training_started',
  'training_completed',
  'training_cancelled',
  'training_failed',
  'model_exported',
] as const;
export type LearningEvent = (typeof EVENTS)[number];
const properties = new Set([
  'mode',
  'level_id',
  'dataset_id',
  'parameter_count',
  'dense_layers',
  'accuracy',
  'duration_ms',
  'format',
  'token',
  'distinct_id',
  '$session_id',
  '$window_id',
  '$lib',
  '$lib_version',
  '$process_person_profile',
  '$geoip_disable',
]);

export function analyticsAllowed(
  location: Pick<Location, 'hostname' | 'protocol'>,
  doNotTrack: string | null,
): boolean {
  return (
    location.protocol === 'https:' &&
    doNotTrack !== '1' &&
    !(
      /^(localhost|127\.|\[?::1\]?)/.test(location.hostname) ||
      location.hostname.endsWith('.localhost') ||
      location.hostname.endsWith('.local')
    )
  );
}
export function parseAnalyticsConfig(value: unknown): AnalyticsConfig | null {
  if (!value || typeof value !== 'object') return null;
  const { token, host } = value as Partial<AnalyticsConfig>;
  return typeof token === 'string' &&
    /^phc_[A-Za-z0-9_-]+$/.test(token) &&
    (host === 'https://eu.i.posthog.com' || host === 'https://us.i.posthog.com')
    ? { token, host }
    : null;
}
export const POSTHOG_OPTIONS: Partial<PostHogConfig> = {
  persistence: 'memory',
  disable_persistence: true,
  person_profiles: 'never',
  autocapture: false,
  capture_pageview: false,
  capture_pageleave: false,
  capture_dead_clicks: false,
  capture_heatmaps: false,
  capture_performance: false,
  capture_exceptions: false,
  rageclick: false,
  disable_session_recording: true,
  disable_surveys: true,
  advanced_disable_flags: true,
  disable_external_dependency_loading: true,
  respect_dnt: true,
  // The SDK also supplies URL/referrer/device properties. Keep only this explicit schema.
  before_send: (event) => {
    if (!event || !EVENTS.includes(event.event as LearningEvent)) return null;
    let page: URL | undefined;
    if (event.event === '$pageview') {
      try {
        page = new URL(event.properties['$current_url']);
      } catch {
        /* URL is optional. */
      }
    }
    event.properties = Object.fromEntries(
      Object.entries(event.properties).filter(
        ([key, value]) =>
          properties.has(key) &&
          (typeof value === 'string' ||
            typeof value === 'boolean' ||
            (typeof value === 'number' && Number.isFinite(value))),
      ),
    );
    if (page && ['https:', 'http:'].includes(page.protocol)) {
      event.properties['$current_url'] = page.origin + page.pathname;
      event.properties['$pathname'] = page.pathname;
      event.properties['$host'] = page.host;
    }
    event.properties['$geoip_disable'] = true;
    return event;
  },
};
