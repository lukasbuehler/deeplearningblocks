import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./analytics-config.mjs', import.meta.url));
test('public config supports disable, EU/US overrides and rejects personal keys or bad hosts', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dlb-config-'));
  await mkdir(join(dir, 'public'));
  const env = { ...process.env };
  delete env.POSTHOG_PROJECT_TOKEN;
  delete env.POSTHOG_API_HOST;
  const run = (values = {}) =>
    execFileSync(process.execPath, [script], {
      cwd: dir,
      env: { ...env, ...values },
      stdio: 'pipe',
    });
  const config = async () =>
    JSON.parse(await readFile(join(dir, 'public/analytics-config.json'), 'utf8'));
  try {
    run();
    assert.match((await config()).token, /^phc_/);
    assert.equal((await config()).host, 'https://eu.i.posthog.com');
    run({ POSTHOG_PROJECT_TOKEN: '' });
    assert.equal((await config()).token, '');
    await writeFile(join(dir, '.env.local'), 'POSTHOG_PROJECT_TOKEN=phc_local\n');
    run({ POSTHOG_PROJECT_TOKEN: 'phc_override', POSTHOG_API_HOST: 'https://us.i.posthog.com' });
    assert.deepEqual(await config(), { token: 'phc_override', host: 'https://us.i.posthog.com' });
    assert.throws(() => run({ POSTHOG_PROJECT_TOKEN: 'phx_personal' }), /public phc_/);
    assert.throws(() => run({ POSTHOG_API_HOST: 'https://wrong.example' }), /ingestion host/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
