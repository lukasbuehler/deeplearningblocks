import assert from 'node:assert/strict';
import { test } from 'node:test';
import { crawlFiles, siteHead, siteSettings } from './site-html.mjs';

const origin = 'https://blocks.example';
const html = '<head><meta property="og:image" content="/share-card.png" /></head>';

test('production uses one public origin for canonical, social metadata and the sitemap', () => {
  const site = siteSettings({ SITE_URL: origin + '/', WORKERS_CI: '1', WORKERS_CI_BRANCH: 'main' });
  const head = siteHead(html, site);
  assert.ok(head.includes(`rel="canonical" href="${origin}/"`));
  assert.ok(head.includes(`content="${origin}/share-card.png"`));
  assert.ok(crawlFiles(site).robots.includes(`Sitemap: ${origin}/sitemap.xml`));
  assert.ok(crawlFiles(site).sitemap.includes(`<loc>${origin}/</loc>`));
});

test('local, preview and non-production builds cannot advertise an indexable sitemap', () => {
  for (const env of [
    {},
    { SITE_URL: origin, SITE_PREVIEW: '1' },
    { SITE_URL: origin, WORKERS_CI: '1', WORKERS_CI_BRANCH: 'feature/card' },
  ]) {
    const site = siteSettings(env);
    assert.match(siteHead(html, site), /name="robots" content="noindex"/);
    assert.equal(crawlFiles(site).sitemap, null);
  }
  assert.throws(() => siteSettings({ SITE_URL: origin + '/play' }), /SITE_URL/);
});
