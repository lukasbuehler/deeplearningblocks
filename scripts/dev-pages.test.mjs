import assert from 'node:assert/strict';
import { test } from 'node:test';
import proxy, { renderDevPage } from './dev-pages.mjs';

test('local home and legal routes render the actual static pages', async () => {
  const home = await renderDevPage('/');
  assert.match(home, /Build your first/);
  assert.match(home, /href="\/play"/);
  assert.doesNotMatch(home, /<app-root|main[^<]*\.js/);
  for (const [path, title] of [
    ['/privacy', 'Privacy Policy'],
    ['/terms', 'Terms of Use'],
    ['/imprint', 'Imprint'],
  ]) {
    const html = await renderDevPage(path);
    assert.ok(html.includes(`<title>${title}`));
    assert.doesNotMatch(html, /<app-root|\{\{/);
    assert.equal(await renderDevPage(path + '.html'), html);
  }
});

test('development page routing leaves the playground, assets and live-reload endpoints alone', async () => {
  const pattern = new RegExp(Object.keys(proxy)[0]);
  for (const path of ['/', '/?hello=1', '/privacy', '/terms/', '/imprint.html'])
    assert.ok(pattern.test(path), path);
  for (const path of [
    '/play',
    '/main.js',
    '/landing.css',
    '/@vite/client',
    '/data/mnist-test.bin.gz',
    '/src/main.ts',
  ]) {
    assert.equal(pattern.test(path), false, path);
    assert.equal(await renderDevPage(path), null);
  }
});
