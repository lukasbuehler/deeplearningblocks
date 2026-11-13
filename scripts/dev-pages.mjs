import { readFile } from 'node:fs/promises';
import { renderLegalPages } from './legal-pages.mjs';
import { renderHomePage } from './site-pages.mjs';
import { siteHead } from './site-html.mjs';

const site = { indexable: false };

export async function renderDevPage(pathname) {
  const path = pathname.replace(/\/$/, '').replace(/\.html$/, '') || '/';
  if (path === '/' || path === '/index') {
    const [template, home] = await Promise.all([
      readFile(new URL('../src/index.html', import.meta.url), 'utf8'),
      readFile(new URL('../src/site/home.html', import.meta.url), 'utf8'),
    ]);
    return renderHomePage(template, home, site);
  }
  if (!['/privacy', '/terms', '/imprint'].includes(path)) return null;
  const page = (await renderLegalPages()).find((page) => page.path === path);
  return siteHead(page.html, site, path);
}

// Exact page routes only: /play, assets and the dev server's own endpoints stay with Angular.
export default {
  '^/(?:index\\.html|(?:privacy|terms|imprint)(?:\\.html)?/?)?(?:\\?.*)?$': {
    async bypass(request, response) {
      if (!response || !['GET', 'HEAD'].includes(request.method)) return request.url;
      const html = await renderDevPage(new URL(request.url, 'http://localhost').pathname);
      if (html !== null) {
        response.statusCode = 200;
        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        response.end(request.method === 'HEAD' ? undefined : html);
      }
      // Vite stops here when the response ended, otherwise it continues its normal pipeline.
      return request.url;
    },
  },
};
