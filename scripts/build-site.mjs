import { readFile, rm, writeFile } from 'node:fs/promises';
import { crawlFiles, loadSiteSettings, siteHead } from './site-html.mjs';
import { structuredData } from './structured-data.mjs';

const output = new URL('../dist/deeplearningblocks/browser/', import.meta.url);
const index = new URL('index.html', output);
const site = loadSiteSettings();
const [appHtml, template, home] = await Promise.all([
  readFile(index, 'utf8'),
  readFile(new URL('../src/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/site/home.html', import.meta.url), 'utf8'),
]);
const landing = template
  .replace(
    '</head>',
    () => '<link rel="stylesheet" href="/landing.css" />\n' + structuredData(site) + '  </head>',
  )
  .replace('<app-root></app-root>', () => home);
const play = appHtml
  .replace('<title>Deep Learning Blocks</title>', '<title>Play | Deep Learning Blocks</title>')
  .replace(
    '<app-root></app-root>',
    '<app-root></app-root><noscript>Enable JavaScript to use the playground. <a href="/">Back to lessons</a></noscript>',
  );
const notFound = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Page not found | Deep Learning Blocks</title>
    <link rel="stylesheet" href="/landing.css" />
  </head>
  <body>
    <main><h1>Page not found</h1><p><a href="/">Back to Deep Learning Blocks</a></p></main>
  </body>
</html>
`;
const { robots, sitemap } = crawlFiles(site);
const sitemapFile = new URL('sitemap.xml', output);

await Promise.all([
  writeFile(index, siteHead(landing, site)),
  writeFile(new URL('play.html', output), siteHead(play, { ...site, indexable: false }, '/play')),
  writeFile(new URL('404.html', output), notFound),
  writeFile(new URL('robots.txt', output), robots),
  sitemap ? writeFile(sitemapFile, sitemap) : rm(sitemapFile, { force: true }),
]);
