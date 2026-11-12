import { readFile } from 'node:fs/promises';
import legal from '../config/legal.json' with { type: 'json' };

export const LEGAL_PAGES = [
  {
    path: '/privacy',
    file: 'privacy',
    title: 'Privacy Policy',
    description: 'What data Deep Learning Blocks processes, why, and your rights.',
  },
  {
    path: '/terms',
    file: 'terms',
    title: 'Terms of Use',
    description: 'Terms and licence for using Deep Learning Blocks.',
  },
  {
    path: '/imprint',
    file: 'imprint',
    title: 'Imprint',
    description: 'Who operates Deep Learning Blocks and how to reach them.',
  },
];

const escape = (value) =>
  String(value).replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
  );

/**
 * Fills {{name}}, {{email}}, {{address}}, {{updated}} and {{year}} in legal and footer markup.
 * Spaces inside the braces are allowed because Prettier's Angular formatter adds them.
 */
export function fillLegal(html, info = legal, year = new Date().getFullYear()) {
  const lines = [info.name, ...info.address, info.country].filter(Boolean).map(escape);
  const values = {
    name: escape(info.name),
    email: `<a href="mailto:${escape(info.email)}">${escape(info.email)}</a>`,
    address: lines.join('<br />'),
    updated: escape(info.updated),
    year: String(year),
  };
  return html.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
    if (!(key in values)) throw new Error(`Unknown legal placeholder ${match}`);
    return values[key];
  });
}

export function siteFooter(info = legal, year) {
  return fillLegal(
    `<footer class="site-footer">
  <p>© {{year}} {{name}}. All rights reserved.</p>
  <nav aria-label="Legal">
    <a href="/privacy">Privacy</a>
    <a href="/terms">Terms</a>
    <a href="/imprint">Imprint</a>
  </nav>
</footer>`,
    info,
    year,
  );
}

export function legalPage(page, body, info = legal, year) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${page.title} | Deep Learning Blocks</title>
    <meta name="description" content="${escape(page.description)}" />
    <link rel="icon" href="/favicon.ico" sizes="48x48" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/site.webmanifest" />
    <meta name="theme-color" content="#fffdf1" />
    <link rel="stylesheet" href="/landing.css" />
  </head>
  <body>
    <header class="site-header">
      <a class="wordmark" href="/" aria-label="Deep Learning Blocks home">
        <span>deep learning</span>
        <strong aria-hidden="true"><i>B</i><i>L</i><i>O</i><i>C</i><i>K</i><i>S</i></strong>
      </a>
      <a href="/play">Open the playground</a>
    </header>
    <main class="legal">
${fillLegal(body, info, year)}
    </main>
${siteFooter(info, year)}
  </body>
</html>
`;
}

export async function renderLegalPages(info = legal) {
  if (!info.address.length) {
    console.warn(
      'Legal pages: config/legal.json has no postal address. The imprint is incomplete.',
    );
  }
  return Promise.all(
    LEGAL_PAGES.map(async (page) => ({
      ...page,
      html: legalPage(
        page,
        await readFile(new URL(`../src/site/legal/${page.file}.html`, import.meta.url), 'utf8'),
        info,
      ),
    })),
  );
}
