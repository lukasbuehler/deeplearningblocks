import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fillLegal, LEGAL_PAGES, renderLegalPages, siteFooter } from './legal-pages.mjs';

const info = {
  name: 'Ada <Lovelace>',
  email: 'ada@example.com',
  address: ['Street 1', '8000 Zürich'],
  country: 'Switzerland',
  updated: '1 January 2026',
};

test('fills operator details and escapes them', () => {
  const html = fillLegal('{{name}}|{{address}}|{{email}}|{{year}}', info, 2026);
  assert.equal(
    html,
    'Ada &lt;Lovelace&gt;|Ada &lt;Lovelace&gt;<br />Street 1<br />8000 Zürich<br />Switzerland|' +
      '<a href="mailto:ada@example.com">ada@example.com</a>|2026',
  );
  assert.match(siteFooter(info, 2026), /© 2026 Ada &lt;Lovelace&gt;/);
});

test('every legal page renders with no unfilled placeholders', async () => {
  const pages = await renderLegalPages(info);
  assert.deepEqual(
    pages.map((page) => page.path),
    LEGAL_PAGES.map((page) => page.path),
  );
  for (const page of pages) {
    assert.doesNotMatch(page.html, /\{\{\w+\}\}/, page.path);
    assert.match(page.html, /8000 Zürich|href="\/privacy"/, page.path);
    assert.match(page.html, new RegExp(`<title>${page.title} \\|`), page.path);
  }
});
