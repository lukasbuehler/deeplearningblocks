import { structuredData } from './structured-data.mjs';
import { siteHead } from './site-html.mjs';
import { siteFooter } from './legal-pages.mjs';

/** Shared by the production build and the local development server. */
export function renderHomePage(template, home, site, footer = siteFooter()) {
  return siteHead(
    template
      .replace(
        '</head>',
        () =>
          '<link rel="stylesheet" href="/landing.css" />\n' + structuredData(site) + '  </head>',
      )
      .replace('<app-root></app-root>', () => home + footer),
    site,
  );
}
