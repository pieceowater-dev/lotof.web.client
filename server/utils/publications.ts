import { promises as fs } from 'node:fs';
import path from 'node:path';

export type EditorBlock = {
  id: string;
  type: string;
  content: string;
  attrs: Record<string, any>;
};

export type EditorArticle = {
  title: string;
  slug: string;
  status: 'draft' | 'published';
  category: string;
  author: string;
  authorUrl?: string;
  authorRole?: string;
  publishedAt: string;
  updatedAt?: string;
  featuredImage?: string;
  tags: string[];
  metaTitle?: string;
  metaDescription?: string;
  canonicalUrl?: string;
  ogImage?: string;
  schemaType?: 'Article' | 'NewsArticle' | 'BlogPosting';
  sourceUrl?: string;
  sourceName?: string;
  reviewedBy?: string;
  reviewedByUrl?: string;
  reviewedDate?: string;
  publisherName?: string;
  publisherUrl?: string;
  publisherLogo?: string;
  robots?: string;
};

export type PublicationFile = {
  filePath: string;
  category: string;
  slug: string;
  article: EditorArticle;
  blocks: EditorBlock[];
  body: string;
};

export type PublicationListItem = {
  title: string;
  slug: string;
  category: string;
  status: 'draft' | 'published';
  author: string;
  publishedAt: string;
  updatedAt: string;
};

export type PublicationDocument = {
  slug: string;
  category: string;
  status: 'draft' | 'published';
  meta: Record<string, string | string[]>;
  body: string;
};

export type PublicationDocumentsQuery = {
  includeDraft?: boolean;
  category?: string;
};

const ROOT = path.join(process.cwd(), 'public/content/publications');

const CATEGORY_DIRS: Record<string, string> = {
  news: 'news',
  whatsnew: 'whatsnew',
  articles: 'articles',
  academy: 'academy',
  blog: 'blog',
};

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

function normalizeCategory(raw: string): string {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return 'news';
  if (CATEGORY_DIRS[value]) return value;
  return 'news';
}

export function sanitizeSlug(raw: string): string {
  const source = String(raw || '').trim().toLowerCase();
  if (!source) return '';

  let transliterated = '';
  for (const ch of source) {
    transliterated += CYRILLIC_TO_LATIN[ch] ?? ch;
  }

  return transliterated
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
}

function normalizeDate(raw?: string): string {
  const value = String(raw || '').trim();
  if (!value) return new Date().toISOString().slice(0, 10);
  return value;
}

function escapeYamlValue(raw: string): string {
  return String(raw || '').replace(/"/g, '\\"');
}

function parseFrontMatter(raw: string): { meta: Record<string, any>; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };

  const lines = match[1].split('\n');
  const meta: Record<string, any> = {};
  let currentArrayKey = '';

  for (const line of lines) {
    if (!line.trim()) continue;

    const keyMatch = line.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
    if (keyMatch) {
      const key = keyMatch[1];
      const value = keyMatch[2] || '';
      if (!value.trim()) {
        currentArrayKey = key;
        meta[key] = [];
      } else {
        currentArrayKey = '';
        meta[key] = value.trim().replace(/^"|"$/g, '');
      }
      continue;
    }

    const arrayMatch = line.match(/^\s*-\s*(.*)$/);
    if (arrayMatch && currentArrayKey) {
      if (!Array.isArray(meta[currentArrayKey])) meta[currentArrayKey] = [];
      meta[currentArrayKey].push((arrayMatch[1] || '').trim().replace(/^"|"$/g, ''));
    }
  }

  return { meta, body: match[2] || '' };
}

function decodeBlocks(meta: Record<string, any>, body: string): EditorBlock[] {
  const encoded = String(meta.editor_blocks_b64 || '').trim();
  if (encoded) {
    try {
      const json = Buffer.from(encoded, 'base64').toString('utf-8');
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed)) return parsed.map((block) => normalizeEditorBlock(block));
    } catch {
      // Ignore malformed editor payload and fallback to body conversion.
    }
  }

  const plain = body.trim();
  if (!plain) {
    return [
      { id: `b_${Date.now()}_1`, type: 'paragraph', content: '', attrs: {} },
    ];
  }

  return [
    {
      id: `b_${Date.now()}_1`,
      type: 'paragraph',
      content: plain
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>'),
      attrs: {},
    },
  ];
}

function normalizeEditorBlock(block: any): EditorBlock {
  const attrs = { ...(block?.attrs || {}) };
  if (String(block?.type || '') === 'image') {
    const legacySrc = String(attrs.s || '').trim();
    if (legacySrc && !String(attrs.src || '').trim()) {
      attrs.src = legacySrc;
    }
    const legacyAssetId = String(attrs.ai || '').trim();
    if (legacyAssetId && !String(attrs.assetId || '').trim()) {
      attrs.assetId = legacyAssetId;
    }

    const legacyAlt = String(attrs.a || attrs.imageAlt || '').trim();
    if (legacyAlt && !String(attrs.alt || '').trim()) {
      attrs.alt = legacyAlt;
    }
  }

  return {
    id: String(block?.id || `b_${Date.now()}_x`),
    type: String(block?.type || 'paragraph'),
    content: String(block?.content || ''),
    attrs,
  };
}

function stripHtml(raw: string): string {
  return String(raw || '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function blockToMarkdown(block: EditorBlock): string {
  const type = String(block.type || 'paragraph');
  const content = String(block.content || '');

  if (type === 'divider') return '\n---\n';
  if (type === 'html') return content;
  if (type === 'image') {
    const alt = String(block.attrs?.alt || '');
    const src = String(block.attrs?.src || '').trim();
    if (!src) return '';
    return `![${alt}](${src})`;
  }

  const text = stripHtml(content);
  if (!text) return '';

  if (type === 'h2') return `## ${text}`;
  if (type === 'h3') return `### ${text}`;
  if (type === 'h4') return `#### ${text}`;
  if (type === 'h5') return `##### ${text}`;
  if (type === 'quote') return `> ${text}`;

  if (type === 'ul' || type === 'ol') {
    const liMatches = content.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];
    const items = liMatches.map((li) => stripHtml(li.replace(/<\/?li[^>]*>/gi, ''))).filter(Boolean);
    if (items.length === 0) return '';
    if (type === 'ul') return items.map((i) => `- ${i}`).join('\n');
    return items.map((i, idx) => `${idx + 1}. ${i}`).join('\n');
  }

  if (type === 'callout') {
    const calloutType = String(block.attrs?.calloutType || 'info').toUpperCase();
    return `> [!${calloutType}]\n> ${text.replace(/\n/g, '\n> ')}`;
  }

  if (type === 'button') {
    const kind = String(block.attrs?.kind || 'custom').trim().toLowerCase();
    const label = String(block.attrs?.text || '').trim() || (kind === 'login' ? 'Войти' : 'Подробнее');
    const href = kind === 'login'
      ? '/?auth-needed=true'
      : String(block.attrs?.href || '').trim();
    if (!href) return '';
    return `[${label}](${href})`;
  }

  if (type === 'faq') {
    const items = Array.isArray(block.attrs?.items) ? block.attrs.items : [];
    const lines = items
      .map((item: any) => {
        const q = String(item?.q || '').trim();
        const a = String(item?.a || '').trim();
        if (!q || !a) return '';
        return `Q: ${q}\nA: ${a}`;
      })
      .filter(Boolean);
    return lines.join('\n\n');
  }

  return text;
}

export function renderMarkdown(article: EditorArticle, blocks: EditorBlock[]): string {
  const nowDate = new Date().toISOString().slice(0, 10);
  const safeSlug = sanitizeSlug(article.slug || article.title || 'untitled');
  const category = normalizeCategory(article.category);
  const tags = Array.isArray(article.tags) ? article.tags.filter(Boolean) : [];
  const encodedBlocks = Buffer.from(JSON.stringify(blocks || []), 'utf-8').toString('base64');

  const lines: string[] = [
    '---',
    `title: "${escapeYamlValue(article.title || '')}"`,
    `description: "${escapeYamlValue(article.metaDescription || '')}"`,
    `slug: "${escapeYamlValue(safeSlug)}"`,
    `date: "${escapeYamlValue(normalizeDate(article.publishedAt || nowDate))}"`,
    `author: "${escapeYamlValue(article.author || 'Редакция Lota')}"`,
    `author_role: "${escapeYamlValue(article.authorRole || '')}"`,
    `author_url: "${escapeYamlValue(article.authorUrl || '')}"`,
    `reviewed_by: "${escapeYamlValue(article.reviewedBy || '')}"`,
    `reviewed_by_url: "${escapeYamlValue(article.reviewedByUrl || '')}"`,
    `reviewed_date: "${escapeYamlValue(article.reviewedDate || '')}"`,
    `updated_at: "${escapeYamlValue(article.updatedAt || nowDate)}"`,
    `category: "${escapeYamlValue(category)}"`,
  ];

  if (tags.length > 0) {
    lines.push('tags:');
    for (const tag of tags) lines.push(`  - "${escapeYamlValue(tag)}"`);
  } else {
    lines.push('tags: []');
  }

  lines.push(
    `canonical: "${escapeYamlValue(article.canonicalUrl || '')}"`,
    `og_image: "${escapeYamlValue(article.ogImage || article.featuredImage || '')}"`,
    `robots: "${escapeYamlValue(article.robots || 'index,follow')}"`,
    `source_url: "${escapeYamlValue(article.sourceUrl || '')}"`,
    `source_name: "${escapeYamlValue(article.sourceName || '')}"`,
    `status: "${escapeYamlValue(article.status || 'draft')}"`,
    `editor_schema_type: "${escapeYamlValue(article.schemaType || 'Article')}"`,
    `editor_meta_title: "${escapeYamlValue(article.metaTitle || '')}"`,
    `editor_blocks_b64: "${encodedBlocks}"`,
    '---',
    '',
  );

  const markdownBody = (blocks || [])
    .map((block) => blockToMarkdown(block))
    .filter(Boolean)
    .join('\n\n')
    .trim();

  lines.push(markdownBody || '');
  lines.push('');

  return lines.join('\n');
}

async function collectMarkdownFiles(dirPath: string): Promise<string[]> {
  let entries: Array<import('node:fs').Dirent> = [];
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const result: string[] = [];
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      result.push(...await collectMarkdownFiles(full));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.md')) result.push(full);
  }
  return result;
}

function toArticle(meta: Record<string, any>, slugFallback: string, categoryFallback: string): EditorArticle {
  return {
    title: String(meta.title || ''),
    slug: sanitizeSlug(String(meta.slug || slugFallback)),
    status: String(meta.status || 'draft') === 'published' ? 'published' : 'draft',
    category: normalizeCategory(String(meta.category || categoryFallback)),
    author: String(meta.author || ''),
    authorUrl: String(meta.author_url || ''),
    authorRole: String(meta.author_role || ''),
    publishedAt: normalizeDate(String(meta.date || '')),
    updatedAt: String(meta.updated_at || ''),
    featuredImage: String(meta.featuredImage || ''),
    tags: Array.isArray(meta.tags) ? meta.tags.map((v) => String(v)) : [],
    metaTitle: String(meta.editor_meta_title || ''),
    metaDescription: String(meta.description || meta.metaDescription || ''),
    canonicalUrl: String(meta.canonical || ''),
    ogImage: String(meta.og_image || ''),
    schemaType: (String(meta.editor_schema_type || 'Article') as any),
    sourceUrl: String(meta.source_url || ''),
    sourceName: String(meta.source_name || ''),
    reviewedBy: String(meta.reviewed_by || ''),
    reviewedByUrl: String(meta.reviewed_by_url || ''),
    reviewedDate: String(meta.reviewed_date || ''),
    publisherName: String(meta.publisher_name || 'Lota'),
    publisherUrl: String(meta.publisher_url || ''),
    publisherLogo: String(meta.publisher_logo || ''),
    robots: String(meta.robots || 'index,follow'),
  };
}

function toPublicMeta(meta: Record<string, any>): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (Array.isArray(value)) {
      out[key] = value.map((v) => String(v));
      continue;
    }
    out[key] = String(value ?? '');
  }
  return out;
}

export async function listPublicationDocuments(options?: { includeDraft?: boolean; category?: string }): Promise<PublicationDocument[]> {
  const includeDraft = !!options?.includeDraft;
  const categoryFilter = String(options?.category || '').trim().toLowerCase();

  const files = await collectMarkdownFiles(ROOT);
  const docs: PublicationDocument[] = [];

  for (const filePath of files) {
    const raw = await fs.readFile(filePath, 'utf-8');
    const { meta, body } = parseFrontMatter(raw);
    const category = normalizeCategory(String(meta.category || path.basename(path.dirname(filePath))));
    if (categoryFilter && category !== categoryFilter) continue;

    const slug = sanitizeSlug(String(meta.slug || path.basename(filePath, '.md')));
    if (!slug) continue;

    const status = String(meta.status || 'draft') === 'published' ? 'published' : 'draft';
    if (!includeDraft && status !== 'published') continue;

    docs.push({
      slug,
      category,
      status,
      meta: toPublicMeta(meta),
      body,
    });
  }

  docs.sort((a, b) => {
    const ad = String(a.meta.updated_at || a.meta.date || '');
    const bd = String(b.meta.updated_at || b.meta.date || '');
    return bd.localeCompare(ad);
  });

  return docs;
}

export async function fetchPublicationDocumentsFromUpstream(
  upstreamBaseUrl: string,
  options?: PublicationDocumentsQuery,
): Promise<PublicationDocument[] | null> {
  const base = String(upstreamBaseUrl || '').trim().replace(/\/$/, '');
  if (!base) return null;

  try {
    const url = new URL(`${base}/publications`);
    if (options?.category) url.searchParams.set('category', String(options.category));
    if (typeof options?.includeDraft === 'boolean') {
      url.searchParams.set('includeDraft', options.includeDraft ? 'true' : 'false');
    }

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
    });
    if (!res.ok) return null;

    const data = await res.json() as { items?: Array<PublicationDocument> };
    if (!Array.isArray(data?.items)) return null;

    return data.items
      .map((item) => ({
        slug: sanitizeSlug(String(item?.slug || '')),
        category: normalizeCategory(String(item?.category || 'news')),
        status: (String(item?.status || 'draft') === 'published' ? 'published' : 'draft') as 'draft' | 'published',
        meta: item?.meta && typeof item.meta === 'object' ? item.meta : {},
        body: String(item?.body || ''),
      }))
      .filter((item) => !!item.slug);
  } catch {
    return null;
  }
}

export async function readPublicationBySlug(slug: string): Promise<PublicationFile | null> {
  const safeSlug = sanitizeSlug(slug);
  if (!safeSlug) return null;

  const files = await collectMarkdownFiles(ROOT);
  for (const filePath of files) {
    const raw = await fs.readFile(filePath, 'utf-8');
    const { meta, body } = parseFrontMatter(raw);
    const fromMeta = sanitizeSlug(String(meta.slug || ''));
    const fromFile = sanitizeSlug(path.basename(filePath, '.md'));
    const resolvedSlug = fromMeta || fromFile;
    if (resolvedSlug !== safeSlug) continue;

    const category = normalizeCategory(String(meta.category || path.basename(path.dirname(filePath))));
    const article = toArticle(meta, resolvedSlug, category);
    const blocks = decodeBlocks(meta, body);

    return {
      filePath,
      category,
      slug: resolvedSlug,
      article,
      blocks,
      body,
    };
  }

  return null;
}

export async function listPublications(): Promise<PublicationListItem[]> {
  const files = await collectMarkdownFiles(ROOT);
  const rows: PublicationListItem[] = [];

  for (const filePath of files) {
    const raw = await fs.readFile(filePath, 'utf-8');
    const { meta } = parseFrontMatter(raw);
    const category = normalizeCategory(String(meta.category || path.basename(path.dirname(filePath))));
    const slug = sanitizeSlug(String(meta.slug || path.basename(filePath, '.md')));
    if (!slug) continue;

    rows.push({
      title: String(meta.title || slug),
      slug,
      category,
      status: String(meta.status || 'draft') === 'published' ? 'published' : 'draft',
      author: String(meta.author || '-'),
      publishedAt: normalizeDate(String(meta.date || '')),
      updatedAt: String(meta.updated_at || normalizeDate(String(meta.date || ''))),
    });
  }

  rows.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return rows;
}

export function getPublicationTargetPath(categoryRaw: string, slugRaw: string): string {
  const category = normalizeCategory(categoryRaw);
  const slug = sanitizeSlug(slugRaw);
  if (!slug) throw new Error('Invalid slug');

  return path.join(ROOT, CATEGORY_DIRS[category], `${slug}.md`);
}

export async function writePublicationFile(filePath: string, markdown: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, markdown, 'utf-8');
}

export async function removePublicationFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch {
    // Ignore remove failures for non-existent files.
  }
}

export function buildListResponse(items: PublicationListItem[], categoryRaw: string, searchRaw: string, pageRaw: string, pageSizeRaw: string) {
  const category = String(categoryRaw || 'all').trim().toLowerCase();
  const search = String(searchRaw || '').trim().toLowerCase();
  const page = Math.max(1, Number.parseInt(String(pageRaw || '1'), 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(String(pageSizeRaw || '10'), 10) || 10));

  const counts = {
    all: items.length,
    blog: items.filter((i) => i.category === 'blog').length,
    whatsnew: items.filter((i) => i.category === 'whatsnew').length,
    articles: items.filter((i) => i.category === 'articles').length,
    academy: items.filter((i) => i.category === 'academy').length,
    news: items.filter((i) => i.category === 'news').length,
  };

  const filtered = items.filter((item) => {
    const categoryMatch = category === 'all' || item.category === category;
    if (!categoryMatch) return false;
    if (!search) return true;
    const hay = `${item.title} ${item.slug}`.toLowerCase();
    return hay.includes(search);
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * pageSize;

  return {
    items: filtered.slice(offset, offset + pageSize),
    total,
    page: safePage,
    pageSize,
    totalPages,
    counts,
  };
}
