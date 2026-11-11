import { loadEnvFile } from 'node:process';
import defaults from '../config/site.json' with { type: 'json' };

export function siteSettings(env = process.env) {
  const value = env.SITE_URL?.trim();
  const url = value ? URL.parse(value) : null;
  if (
    value &&
    (!url ||
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.href !== url.origin + '/' ||
      !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(url.hostname) ||
      url.port)
  ) {
    throw new Error('SITE_URL must be a public HTTPS origin without a path, port or credentials.');
  }
  const preview =
    env.SITE_PREVIEW === '1' ||
    (env.WORKERS_CI === '1' && env.WORKERS_CI_BRANCH !== (env.SITE_PRODUCTION_BRANCH || 'main'));
  return { origin: url?.origin, indexable: Boolean(url && !preview) };
}

export function loadSiteSettings() {
  try {
    loadEnvFile('.env.local');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return siteSettings({ SITE_URL: defaults.origin, ...process.env });
}

export function siteHead(html, site, path = '/') {
  const canonical = site.origin && new URL(path, site.origin).href;
  const tags = [];
  if (canonical) {
    html = html.replace('content="/share-card.png"', `content="${site.origin}/share-card.png"`);
    tags.push(`<meta property="og:url" content="${canonical}" />`);
    if (site.indexable) tags.push(`<link rel="canonical" href="${canonical}" />`);
  }
  if (!site.indexable) tags.push('<meta name="robots" content="noindex" />');
  return html.replace('</head>', () => tags.join('\n    ') + '\n  </head>');
}

export function crawlFiles(site, paths = []) {
  const sitemapUrl = site.indexable ? `${site.origin}/sitemap.xml` : null;
  return {
    robots: 'User-agent: *\nAllow: /\n' + (sitemapUrl ? `Sitemap: ${sitemapUrl}\n` : ''),
    sitemap: sitemapUrl
      ? `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[
          '/',
          ...paths,
        ]
          .map((path) => `<url><loc>${new URL(path, site.origin).href}</loc></url>`)
          .join('')}</urlset>\n`
      : null,
  };
}
