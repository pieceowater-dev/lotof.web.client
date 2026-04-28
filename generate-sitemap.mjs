import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const PUBLICATIONS_DIR = join(ROOT, 'public', 'content', 'publications');
const SITEMAP_PATH = join(ROOT, 'public', 'sitemap.xml');

const SITE_URL = String(process.env.SITE_URL || process.env.NUXT_PUBLIC_SITE_URL || 'https://lota.tools').replace(/\/$/, '');

function collectMarkdownFiles(dirPath) {
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    return entries.flatMap((entry) => {
      const fullPath = join(dirPath, entry.name);
      if (entry.isDirectory()) return collectMarkdownFiles(fullPath);
      if (entry.isFile() && entry.name.endsWith('.md')) return [fullPath];
      return [];
    });
  } catch {
    return [];
  }
}

function parseFrontMatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  const frontMatter = match?.[1] || '';

  const slugMatch = frontMatter.match(/^slug:\s*"?([^"\n]+)"?\s*$/m);
  const dateMatch = frontMatter.match(/^date:\s*"?([^"\n]+)"?\s*$/m);

  const slug = String(slugMatch?.[1] || '').trim().toLowerCase();
  const date = String(dateMatch?.[1] || '').trim();

  return { slug, date };
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function makeUrl(path, lastmod, changefreq, priority) {
  return [
    '  <url>',
    `    <loc>${SITE_URL}${path}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    '  </url>',
  ].join('\n');
}

function buildSitemapXml() {
  const markdownFiles = collectMarkdownFiles(PUBLICATIONS_DIR);
  const posts = [];

  for (const filePath of markdownFiles) {
    try {
      const raw = readFileSync(filePath, 'utf-8');
      const { slug, date } = parseFrontMatter(raw);
      if (!slug || !isIsoDate(date)) continue;
      posts.push({ slug, date });
    } catch {
      // Skip invalid files
    }
  }

  posts.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));

  const latestDate = posts[0]?.date || new Date().toISOString().slice(0, 10);
  const urls = [
    makeUrl('/', latestDate, 'daily', '1.0'),
    makeUrl('/feed', latestDate, 'daily', '0.9'),
    ...posts.map((post) => makeUrl(`/${post.slug}`, post.date, 'monthly', '0.8')),
  ];

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}

const xml = buildSitemapXml();
writeFileSync(SITEMAP_PATH, xml, 'utf-8');
console.log(`[sitemap] Generated ${SITEMAP_PATH}`);
