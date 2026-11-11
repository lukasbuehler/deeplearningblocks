import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';

// Deployment environment variables win over an optional, untracked local file.
if (existsSync('.env.local')) process.loadEnvFile('.env.local');
const defaults = JSON.parse(
  await readFile(new URL('../config/analytics.json', import.meta.url), 'utf8'),
);
const token = process.env.POSTHOG_PROJECT_TOKEN?.trim() ?? defaults.token;
const host = process.env.POSTHOG_API_HOST?.trim() || defaults.host;
if (token && !/^phc_[A-Za-z0-9_-]+$/.test(token)) {
  throw new Error(
    'POSTHOG_PROJECT_TOKEN must be a public phc_ project token, not a personal API key.',
  );
}
if (!['https://eu.i.posthog.com', 'https://us.i.posthog.com'].includes(host)) {
  throw new Error('POSTHOG_API_HOST must be the EU or US PostHog ingestion host.');
}
await writeFile('public/analytics-config.json', JSON.stringify({ token, host }) + '\n');
console.log(`PostHog: ${token ? 'configured for ' + host : 'disabled (no project token)'}`);
