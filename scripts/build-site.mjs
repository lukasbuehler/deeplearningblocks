import { readFile, rm, writeFile } from 'node:fs/promises';
import { crawlFiles, loadSiteSettings, siteHead } from './site-html.mjs';

const output = new URL('../dist/deeplearningblocks/browser/', import.meta.url);
const index = new URL('index.html', output);
const site = loadSiteSettings();
const html = await readFile(index, 'utf8');
const { robots, sitemap } = crawlFiles(site);
const sitemapFile = new URL('sitemap.xml', output);

await Promise.all([
  writeFile(index, siteHead(html, site)),
  writeFile(new URL('robots.txt', output), robots),
  sitemap ? writeFile(sitemapFile, sitemap) : rm(sitemapFile, { force: true }),
]);
