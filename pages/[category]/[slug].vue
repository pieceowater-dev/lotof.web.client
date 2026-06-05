<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import type { HomeFeedPost } from '@/components/HomePostsFeed.vue';
import { capitalGetPublicPublicationByRoute } from '@/api/publications';

definePageMeta({
  viewTransition: false,
  path: '/:category(blog|whatsnew|articles|learning|news)/:slug',
});

type ArticleMeta = Record<string, string | string[]>;

type ArticleDoc = {
  slug: string;
  category: string;
  meta: ArticleMeta;
  body: string;
};

type PublicationArticleDoc = {
  slug: string;
  category: string;
  meta: ArticleMeta;
  body: string;
};

type PublicationsAllResponse = {
  items?: PublicationArticleDoc[];
};

const { t, locale } = useI18n();
const route = useRoute();
const config = useRuntimeConfig();
const authToken = useCookie<string | null>('auth_token');
const legacyToken = useCookie<string | null>('token');

const SUPPORTED_PUBLICATION_CATEGORIES = new Set(['blog', 'whatsnew', 'articles', 'learning', 'news']);

const mdFiles = import.meta.glob('../../public/content/publications/**/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

function parseFrontMatter(raw: string): { meta: ArticleMeta; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };

  const metaLines = match[1].split('\n');
  const body = match[2] || '';
  const meta: ArticleMeta = {};

  let currentArrayKey = '';
  for (const line of metaLines) {
    if (!line.trim()) continue;

    const keyMatch = line.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
    if (keyMatch) {
      currentArrayKey = '';
      const key = keyMatch[1];
      const value = keyMatch[2]?.trim() || '';
      if (!value) {
        currentArrayKey = key;
        meta[key] = [];
        continue;
      }
      meta[key] = value.replace(/^"|"$/g, '');
      continue;
    }

    const arrayMatch = line.match(/^\s*-\s*(.*)$/);
    if (arrayMatch && currentArrayKey) {
      const arr = Array.isArray(meta[currentArrayKey]) ? (meta[currentArrayKey] as string[]) : [];
      arr.push((arrayMatch[1] || '').replace(/^"|"$/g, ''));
      meta[currentArrayKey] = arr;
    }
  }

  return { meta, body };
}

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeCategoryFromPath(filePath: string): string {
  // Extract category from path like ../../public/content/publications/news/slug.md
  const parts = filePath.split('/');
  const pubIdx = parts.lastIndexOf('publications');
  if (pubIdx !== -1 && parts[pubIdx + 1]) {
    return parts[pubIdx + 1].toLowerCase();
  }
  return '';
}

const allArticles = computed<ArticleDoc[]>(() => {
  return Object.entries(mdFiles)
    .map(([filePath, raw]) => {
      const { meta, body } = parseFrontMatter(raw);
      const slug = normalizeSlug(String(meta.slug || ''));
      if (!slug) return null;
      const category = normalizeSlug(String(meta.category || normalizeCategoryFromPath(filePath)));
      return { slug, category, meta, body };
    })
    .filter((item): item is ArticleDoc => !!item);
});

const pathSegments = computed(() => {
  const raw = String(route.path || '').split('?')[0];
  return raw.split('/').filter(Boolean).map((segment) => normalizeSlug(segment));
});

const categoryParam = computed(() => {
  const fromParams = normalizeSlug(String(route.params.category || ''));
  if (fromParams) return fromParams;
  return pathSegments.value.length >= 2 ? pathSegments.value[0] : '';
});

const slugParam = computed(() => {
  const fromParams = normalizeSlug(String(route.params.slug || ''));
  if (fromParams) return fromParams;
  if (pathSegments.value.length >= 2) return pathSegments.value[1];
  return pathSegments.value[0] || '';
});

function normalizeSiteUrl(raw: string): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return 'https://lota.tools';
  if (/^https?:\/\//i.test(trimmed)) return trimmed.replace(/\/$/, '');
  return `https://${trimmed.replace(/^\/+/, '').replace(/\/$/, '')}`;
}

const routeAsyncKey = `public-publication-route:${categoryParam.value}:${slugParam.value}`;

const { data: routePublication } = await useAsyncData<PublicationArticleDoc | null>(
  routeAsyncKey,
  async () => {
    if (!slugParam.value) return null;

    // Prefer slug-based server fallback first: it already handles category probing
    // and is resilient to upstream public list auth limitations.
    try {
      const all = await $fetch<PublicationsAllResponse>('/api/publications/all', {
        query: {
          includeDraft: 'false',
          slug: slugParam.value,
          category: categoryParam.value,
        },
      });
      const bySlug = Array.isArray(all?.items)
        ? all.items.find((item) => normalizeSlug(String(item?.slug || '')) === slugParam.value)
        : null;
      if (bySlug) {
        return {
          slug: normalizeSlug(String(bySlug.slug || '')),
          category: normalizeSlug(String(bySlug.category || 'news')),
          meta: bySlug.meta || {},
          body: String(bySlug.body || ''),
        };
      }
    } catch {
      // Continue with direct route and local fallbacks below.
    }

    if (categoryParam.value && SUPPORTED_PUBLICATION_CATEGORIES.has(categoryParam.value)) {
      try {
        const viewerToken = String(authToken.value || legacyToken.value || '').trim();
        const publication = await capitalGetPublicPublicationByRoute(viewerToken, categoryParam.value, slugParam.value);
        if (publication) return publication;
      } catch (error: any) {
        const message = String(error?.message || '');
        if (!message.includes('code = NotFound') && !message.includes('not found')) {
          throw error;
        }
      }
    }

    const localExact = allArticles.value.find((item) => {
      return item.slug === slugParam.value && item.category === categoryParam.value;
    });
    if (localExact) {
      return {
        slug: localExact.slug,
        category: localExact.category,
        meta: localExact.meta,
        body: localExact.body,
      };
    }

    // Fallback for legacy/aliased links where category in URL may not match actual article category.
    const localBySlug = allArticles.value.find((item) => item.slug === slugParam.value);
    if (localBySlug) {
      return {
        slug: localBySlug.slug,
        category: localBySlug.category,
        meta: localBySlug.meta,
        body: localBySlug.body,
      };
    }

    return null;
  },
  { watch: [categoryParam, slugParam] }
);

if (!routePublication.value) {
  throw createError({ statusCode: 404, statusMessage: 'Article not found' });
}

const article = computed<PublicationArticleDoc | null>(() => routePublication.value);

const articleTitle = computed(() => String(article.value?.meta.title || 'Article'));
const articleDescription = computed(() => String(article.value?.meta.description || ''));
const articleAuthor = computed(() => String(article.value?.meta.author || 'Lota Team'));
const articleAuthorRole = computed(() => String(article.value?.meta.author_role || '').trim());
const articleOgImage = computed(() => String(article.value?.meta.og_image || '/og-image.png'));
const articleOgImageAlt = computed(() => String(article.value?.meta.og_image_alt || articleTitle.value));
const articleSourceUrl = computed(() => String(article.value?.meta.source_url || '').trim());
const articleSourceName = computed(() => String(article.value?.meta.source_name || '').trim());
const articleAuthorUrl = computed(() => String(article.value?.meta.author_url || '').trim());
const articleReviewer = computed(() => String(article.value?.meta.reviewed_by || '').trim());
const articleReviewerUrl = computed(() => String(article.value?.meta.reviewed_by_url || '').trim());
const articleUpdatedRaw = computed(() => String(article.value?.meta.updated_at || '').trim());
const articleReviewedRaw = computed(() => String(article.value?.meta.reviewed_date || '').trim());
const articleSchemaType = computed(() => {
  const raw = String(article.value?.meta.schema_type || '').trim();
  if (raw === 'NewsArticle' || raw === 'BlogPosting' || raw === 'Article') return raw;
  return isNews.value ? 'NewsArticle' : 'Article';
});
const articlePublisherName = computed(() => String(article.value?.meta.publisher_name || 'Lota').trim() || 'Lota');
const articlePublisherUrl = computed(() => String(article.value?.meta.publisher_url || siteUrl.value).trim() || siteUrl.value);
const articlePublisherLogo = computed(() => String(article.value?.meta.publisher_logo || `${siteUrl.value}/og-image.png`).trim() || `${siteUrl.value}/og-image.png`);

const articleTags = computed(() => {
  const tags = article.value?.meta.tags;
  return Array.isArray(tags) ? tags : [];
});

const articleDate = computed(() => {
  const raw = String(article.value?.meta.date || '');
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return raw;
  const intlLocale = locale.value === 'ru' ? 'ru-RU' : locale.value === 'kk' ? 'kk-KZ' : 'en-GB';
  return dt.toLocaleDateString(intlLocale, { day: '2-digit', month: 'long', year: 'numeric' });
});

function toLocalizedDate(raw: string): string {
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return raw;
  const intlLocale = locale.value === 'ru' ? 'ru-RU' : locale.value === 'kk' ? 'kk-KZ' : 'en-GB';
  return dt.toLocaleDateString(intlLocale, { day: '2-digit', month: 'long', year: 'numeric' });
}

const siteUrl = computed(() => normalizeSiteUrl(String(config.public.siteUrl || 'https://lota.tools')));
const isNews = computed(() => article.value?.category === 'news');
const isWhatsNew = computed(() => article.value?.category === 'whatsnew');
const backHref = computed(() => isNews.value ? '/news' : '/feed');

const articleCanonical = computed(() => {
  const canonical = String(article.value?.meta.canonical || '').trim();
  if (canonical) return canonical;
  return `${siteUrl.value}/${categoryParam.value}/${slugParam.value}`;
});

const articleHreflangLinks = computed(() => {
  const normalized = articleCanonical.value.replace(/\?.*$/, '');
  const absolute = /^https?:\/\//i.test(normalized) ? normalized : `${siteUrl.value}${normalized.startsWith('/') ? '' : '/'}${normalized}`;
  const links = [{ rel: 'alternate', hreflang: 'x-default', href: absolute }];
  for (const lang of ['ru', 'en', 'kk']) {
    const url = new URL(absolute);
    url.searchParams.set('lang', lang);
    links.push({ rel: 'alternate', hreflang: lang, href: url.toString() });
  }
  return links;
});

const articleRobots = computed(() => String(article.value?.meta.robots || 'index,follow'));

const articlePublishedIso = computed(() => {
  const raw = String(article.value?.meta.date || '');
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toISOString();
});

const articleUpdatedIso = computed(() => {
  if (!articleUpdatedRaw.value) return '';
  const dt = new Date(articleUpdatedRaw.value);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toISOString();
});

const articleReviewedIso = computed(() => {
  if (!articleReviewedRaw.value) return '';
  const dt = new Date(articleReviewedRaw.value);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toISOString();
});

const articleUpdatedLabel = computed(() => articleUpdatedRaw.value ? toLocalizedDate(articleUpdatedRaw.value) : '');
const articleReviewedLabel = computed(() => articleReviewedRaw.value ? toLocalizedDate(articleReviewedRaw.value) : '');
const articleSectionLabel = computed(() => isNews.value ? 'News' : 'Articles');

const articleJsonLd = computed(() => {
  const authorObj: Record<string, unknown> = {
    '@type': 'Person',
    name: articleAuthor.value,
  };

  if (articleAuthorUrl.value) authorObj.url = articleAuthorUrl.value;
  if (articleAuthorRole.value) authorObj.jobTitle = articleAuthorRole.value;

  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': articleSchemaType.value,
    url: articleCanonical.value,
    headline: articleTitle.value,
    description: articleDescription.value,
    image: [articleOgImage.value],
    author: authorObj,
    publisher: {
      '@type': 'Organization',
      name: articlePublisherName.value,
      url: articlePublisherUrl.value,
      logo: { '@type': 'ImageObject', url: articlePublisherLogo.value },
    },
    datePublished: articlePublishedIso.value || undefined,
    dateModified: articleUpdatedIso.value || articlePublishedIso.value || undefined,
    mainEntityOfPage: { '@type': 'WebPage', '@id': articleCanonical.value },
    inLanguage: String(locale.value || 'ru'),
    articleSection: articleSectionLabel.value,
    about: articleTags.value.length
      ? articleTags.value.map((tag) => ({ '@type': 'DefinedTerm', name: tag }))
      : undefined,
    keywords: articleTags.value.join(', ') || undefined,
    citation: articleSourceUrl.value
      ? [{ '@type': 'CreativeWork', url: articleSourceUrl.value, name: articleSourceName.value || articleSourceUrl.value }]
      : undefined,
  };

  if (isNews.value && articleSourceUrl.value) {
    ld.isBasedOn = {
      '@type': 'NewsArticle',
      url: articleSourceUrl.value,
      name: articleSourceName.value || articleSourceUrl.value,
    };
  }

  if (articleReviewer.value) {
    ld.reviewedBy = {
      '@type': 'Person',
      name: articleReviewer.value,
      url: articleReviewerUrl.value || undefined,
    };
    ld.dateReviewed = articleReviewedIso.value || undefined;
  }

  return ld;
});

const breadcrumbJsonLd = computed(() => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'lota', item: siteUrl.value },
    {
      '@type': 'ListItem',
      position: 2,
      name: isNews.value ? (t('app.news') || 'News') : (t('app.feed') || 'Feed'),
      item: isNews.value ? `${siteUrl.value}/news` : `${siteUrl.value}/feed`,
    },
    { '@type': 'ListItem', position: 3, name: articleTitle.value, item: articleCanonical.value },
  ],
}));

type SuggestedArticle = {
  slug: string;
  category: string;
  title: string;
  description: string;
  dateISO: string;
  dateLabel: string;
  tags: string[];
  image: string;
  sharedTags: number;
};

function toTags(value: string | string[] | undefined): string[] {
  return Array.isArray(value) ? value : [];
}

function toDateLabel(dateISO: string): string {
  const dt = new Date(dateISO);
  if (Number.isNaN(dt.getTime())) return dateISO;
  const intlLocale = locale.value === 'ru' ? 'ru-RU' : locale.value === 'kk' ? 'kk-KZ' : 'en-GB';
  return dt.toLocaleDateString(intlLocale, { day: '2-digit', month: 'short', year: 'numeric' });
}

const suggestedArticles = computed<SuggestedArticle[]>(() => {
  if (!article.value) return [];
  const currentTags = new Set(toTags(article.value.meta.tags));
  return allArticles.value
    .filter((item) => item.slug !== article.value?.slug)
    .filter((item) => item.category === article.value?.category)
    .map((item) => {
      const title = String(item.meta.title || item.slug);
      const description = String(item.meta.description || '').trim();
      const dateISO = String(item.meta.date || '');
      const tags = toTags(item.meta.tags);
      const image = String(item.meta.og_image || '/og-image.png');
      const sharedTags = tags.reduce((acc, tag) => acc + (currentTags.has(tag) ? 1 : 0), 0);
      return { slug: item.slug, category: item.category, title, description, dateISO, dateLabel: toDateLabel(dateISO), tags, image, sharedTags };
    })
    .sort((a, b) => b.sharedTags !== a.sharedTags ? b.sharedTags - a.sharedTags : new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime())
    .slice(0, 3);
});

function estimateReadTime(markdown: string): string {
  const words = markdown.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`]*`/g, ' ').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[[^\]]*\]\([^)]*\)/g, ' ').replace(/^#{1,6}\s+/gm, '').replace(/[>*_~#-]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 220));
  return t('app.readTimeMinutes', { minutes }) || `${minutes} min read`;
}

const sidebarSearch = ref('');
const sidebarSelectedTag = ref('');
const WHATS_NEW_SIDEBAR_LIMIT = 5;
const isMobileSidebarViewport = ref(false);
const isArticleInView = ref(true);
let sidebarMediaQuery: MediaQueryList | null = null;

const sidebarBasePosts = computed<HomeFeedPost[]>(() => {
  if (!article.value) return [];
  return allArticles.value
    .filter((item) => item.slug !== article.value?.slug && item.category === 'whatsnew')
    .map((item) => ({
      id: item.slug,
      href: `/whatsnew/${item.slug}`,
      category: t('app.whatsNew') || "What's New",
      title: String(item.meta.title || item.slug),
      excerpt: String(item.meta.description || '').trim(),
      author: String(item.meta.author || 'Lota Team'),
      publishedAt: toDateLabel(String(item.meta.date || '')),
      readTime: estimateReadTime(item.body),
      image: String(item.meta.og_image || '/og-image.png'),
      imageAlt: String(item.meta.title || item.slug),
      tags: toTags(item.meta.tags),
    } as HomeFeedPost));
});

const sidebarPopularTags = computed(() => {
  const counts = new Map<string, number>();
  for (const post of sidebarBasePosts.value) {
    for (const tag of post.tags) counts.set(tag, (counts.get(tag) || 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 10).map(([tag]) => tag);
});

const sidebarPosts = computed(() => {
  const query = sidebarSearch.value.trim().toLowerCase();
  return sidebarBasePosts.value
    .filter((post) => {
      const tagMatches = !sidebarSelectedTag.value || post.tags.includes(sidebarSelectedTag.value);
      if (!tagMatches) return false;
      if (!query) return true;
      return `${post.title} ${post.excerpt} ${post.tags.join(' ')}`.toLowerCase().includes(query);
    })
    .slice(0, WHATS_NEW_SIDEBAR_LIMIT);
});

function handleSidebarOpen(post: HomeFeedPost) {
  if (!post.href || !process.client) return;
  window.location.assign(post.href);
}

function onSidebarMediaChange(event: MediaQueryListEvent) {
  isMobileSidebarViewport.value = event.matches;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripDuplicatedLead(markdown: string, title: string): string {
  let normalized = markdown.replace(/\r\n/g, '\n').trimStart();
  const cleanTitle = title.trim();
  if (!cleanTitle) return normalized;
  normalized = normalized.replace(new RegExp(`^#\\s+${escapeRegExp(cleanTitle)}\\s*\\n+`, 'i'), '');
  return normalized.trimStart();
}

const sanitizedArticleBody = computed(() => stripDuplicatedLead(article.value?.body || '', articleTitle.value));

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function sanitizeUrl(url: string): string {
  const trimmed = url.trim();
  return (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) ? trimmed : '#';
}

function renderInline(text: string): string {
  let safe = escapeHtml(text);
  safe = safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  safe = safe.replace(/\*(.+?)\*/g, '<em>$1</em>');
  safe = safe.replace(/`([^`]+)`/g, '<code class="rounded bg-gray-100 px-1 py-0.5 text-[0.9em] dark:bg-gray-800">$1</code>');
  safe = safe.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label: string, href: string) => {
    const link = sanitizeUrl(href);
    const target = link.startsWith('http') ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a href="${escapeHtml(link)}" class="text-blue-600 underline underline-offset-2 dark:text-blue-300"${target}>${label}</a>`;
  });
  return safe;
}

function inferImageDimensions(url: string): { width: number; height: number } {
  const match = url.match(/\/(\d{2,5})\/(\d{2,5})(?:[/?]|$)/);
  if (match) {
    const w = Number(match[1]); const h = Number(match[2]);
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) return { width: w, height: h };
  }
  return { width: 1200, height: 630 };
}

function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];
  let index = 0;
  let imageIndex = 0;

  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) { index++; continue; }

    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) { html.push(`<h3 class="mt-8 mb-3 text-xl font-semibold text-gray-900 dark:text-gray-100">${renderInline(h3[1])}</h3>`); index++; continue; }

    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) { html.push(`<h2 class="mt-10 mb-3 text-2xl font-semibold text-gray-900 dark:text-gray-100">${renderInline(h2[1])}</h2>`); index++; continue; }

    const h1 = line.match(/^#\s+(.+)$/);
    if (h1) { html.push(`<h1 class="mt-10 mb-3 text-3xl font-semibold text-gray-900 dark:text-gray-100">${renderInline(h1[1])}</h1>`); index++; continue; }

    const image = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (image) {
      const rawSrc = sanitizeUrl(image[2]);
      const dims = inferImageDimensions(rawSrc);
      const isFirst = imageIndex === 0;
      html.push(`<figure class="my-6"><img src="${escapeHtml(rawSrc)}" alt="${escapeHtml(image[1] || '')}" width="${dims.width}" height="${dims.height}" class="w-full rounded-2xl border border-gray-200 object-cover dark:border-gray-700" loading="${isFirst ? 'eager' : 'lazy'}" fetchpriority="${isFirst ? 'high' : 'low'}" decoding="async" /></figure>`);
      imageIndex++; index++; continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) { items.push(lines[index].trim().replace(/^\d+\.\s+/, '')); index++; }
      html.push(`<ol class="my-4 list-decimal space-y-1 pl-6 text-base leading-7 text-gray-700 dark:text-gray-300">${items.map((i) => `<li>${renderInline(i)}</li>`).join('')}</ol>`);
      continue;
    }

    if (/^-\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^-\s+/.test(lines[index].trim())) { items.push(lines[index].trim().replace(/^-\s+/, '')); index++; }
      html.push(`<ul class="my-4 list-disc space-y-1 pl-6 text-base leading-7 text-gray-700 dark:text-gray-300">${items.map((i) => `<li>${renderInline(i)}</li>`).join('')}</ul>`);
      continue;
    }

    if (line.startsWith('>')) {
      const items: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith('>')) { items.push(lines[index].trim().replace(/^>\s?/, '')); index++; }
      html.push(`<blockquote class="my-6 border-l-4 border-blue-300 pl-5 italic text-gray-600 dark:border-blue-600 dark:text-gray-400">${items.map((i) => `<p>${renderInline(i)}</p>`).join('')}</blockquote>`);
      continue;
    }

    const paragraph: string[] = [line];
    index++;
    while (index < lines.length) {
      const next = lines[index].trim();
      if (!next || /^(#{1,3}|!?\[|>\s|\d+\.\s|-\s)/.test(next)) break;
      paragraph.push(next); index++;
    }
    html.push(`<p class="my-4 text-base leading-7 text-gray-700 dark:text-gray-300">${renderInline(paragraph.join(' '))}</p>`);
  }

  return html.join('');
}

const articleHtml = computed(() => sanitizedArticleBody.value);

useSeoMeta({
  title: () => articleTitle.value,
  description: () => articleDescription.value,
  ogTitle: () => articleTitle.value,
  ogDescription: () => articleDescription.value,
  ogType: 'article',
  ogUrl: () => articleCanonical.value,
  ogImage: () => articleOgImage.value,
  twitterCard: 'summary_large_image',
  twitterTitle: () => articleTitle.value,
  twitterDescription: () => articleDescription.value,
  twitterImage: () => articleOgImage.value,
});

useHead(() => ({
  title: articleTitle.value,
  link: [
    { rel: 'canonical', href: articleCanonical.value },
    ...articleHreflangLinks.value,
  ],
  meta: [
    { name: 'robots', content: articleRobots.value },
    { name: 'author', content: articleAuthor.value },
    { property: 'og:url', content: articleCanonical.value },
    { property: 'article:author', content: articleAuthor.value },
    { property: 'article:published_time', content: articlePublishedIso.value },
    { property: 'article:modified_time', content: articleUpdatedIso.value || articlePublishedIso.value },
    ...articleTags.value.map((tag) => ({ property: 'article:tag', content: tag })),
  ],
  script: [
    { type: 'application/ld+json', children: JSON.stringify(articleJsonLd.value) },
    { type: 'application/ld+json', children: JSON.stringify(breadcrumbJsonLd.value) },
  ],
}));

onMounted(() => {
  if (!process.client) return;
  document.documentElement.classList.add('article-slug-page');
  document.body.classList.add('article-slug-page');

  sidebarMediaQuery = window.matchMedia('(max-width: 1023px)');
  isMobileSidebarViewport.value = sidebarMediaQuery.matches;
  if (typeof sidebarMediaQuery.addEventListener === 'function') {
    sidebarMediaQuery.addEventListener('change', onSidebarMediaChange);
  } else {
    sidebarMediaQuery.addListener(onSidebarMediaChange);
  }
});

watch(
  () => route.params.slug,
  async () => {
    if (!process.client) return;
    await nextTick();
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }
);

onBeforeUnmount(() => {
  if (!process.client) return;
  if (sidebarMediaQuery) {
    if (typeof sidebarMediaQuery.removeEventListener === 'function') {
      sidebarMediaQuery.removeEventListener('change', onSidebarMediaChange);
    } else {
      sidebarMediaQuery.removeListener(onSidebarMediaChange);
    }
    sidebarMediaQuery = null;
  }
  document.documentElement.classList.remove('article-slug-page');
  document.body.classList.remove('article-slug-page');
});
</script>

<template>
  <main class="relative min-h-screen overflow-x-clip bg-gradient-to-b from-white via-emerald-50/45 to-cyan-50/45 px-4 py-7 pb-24 md:px-6 md:py-10 dark:from-slate-900 dark:via-emerald-950/18 dark:to-blue-950/26 lg:pb-10">
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 -z-0"
      style="
        background:
          radial-gradient(920px 430px at 10% -10%, rgba(16, 185, 129, 0.11), transparent 66%),
          radial-gradient(780px 360px at 92% 8%, rgba(6, 182, 212, 0.09), transparent 69%),
          radial-gradient(700px 340px at 55% 100%, rgba(59, 130, 246, 0.075), transparent 71%);
      "
    />

    <section class="relative z-10 mx-auto w-full max-w-[1280px] lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-6">
      <article>
        <div class="rounded-[28px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_16px_50px_-28px_rgba(15,23,42,0.35)] backdrop-blur sm:p-7 md:p-10 dark:border-gray-700 dark:bg-gray-900/95 dark:shadow-[0_20px_60px_-30px_rgba(0,0,0,0.7)]">
          <div class="mx-auto w-full max-w-[720px]">
            <NuxtLink
              :to="backHref"
              class="mb-7 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-blue-300 hover:text-blue-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-blue-500 dark:hover:text-blue-300"
            >
              <UIcon name="lucide:arrow-left" class="h-4 w-4" />
              {{ t('app.back') || 'Назад' }}
            </NuxtLink>

            <header class="mb-8 border-b border-slate-100 pb-6 dark:border-gray-800">
              <p class="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-300">
                {{ isNews ? (t('app.news') || 'Новости') : isWhatsNew ? (t('app.whatsNew') || "What's New") : (t('app.articles') || 'Articles') }}
              </p>

              <h1 class="text-balance text-3xl font-semibold leading-tight text-slate-900 md:text-4xl dark:text-gray-100">
                {{ articleTitle }}
              </h1>

              <p v-if="articleDescription" class="mt-4 text-lg leading-relaxed text-slate-600 dark:text-gray-300">
                {{ articleDescription }}
              </p>

              <div class="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500 dark:text-gray-400">
                <span>{{ articleAuthor }}</span>
                <span aria-hidden="true">•</span>
                <span>{{ articleDate }}</span>
              </div>

              <div v-if="articleTags.length" class="mt-4 flex flex-wrap gap-2">
                <span
                  v-for="tag in articleTags"
                  :key="tag"
                  class="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
                >
                  #{{ tag }}
                </span>
              </div>
            </header>

            <img
              v-if="articleOgImage"
              :src="articleOgImage"
              :alt="articleOgImageAlt"
              width="1200"
              height="630"
              class="mb-8 w-full rounded-3xl border border-slate-200 object-cover shadow-sm dark:border-gray-700"
              loading="eager"
              fetchpriority="high"
              decoding="async"
            />

            <div v-html="articleHtml" class="article-content mb-10" />

            <aside
              aria-labelledby="article-trust-heading"
              class="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50/70 to-cyan-50/40 shadow-sm dark:border-gray-700 dark:from-gray-900 dark:via-gray-900 dark:to-cyan-950/20"
            >
              <div class="flex items-center gap-2 border-b border-slate-100/90 px-5 py-3 dark:border-gray-700/80">
                <span class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                  <UIcon name="lucide:shield-check" class="h-4 w-4" />
                </span>
                <h2 id="article-trust-heading" class="text-sm font-semibold tracking-[0.04em] text-slate-800 dark:text-gray-100">
                  Авторство и проверка
                </h2>
              </div>

              <p class="px-5 pt-4 text-sm leading-6 text-slate-600 dark:text-gray-300">
                Материал подготовлен и проверен редакцией. Ключевые факты сопоставлены с первоисточником.
              </p>

              <dl class="grid gap-3 px-5 py-4 text-sm text-slate-700 dark:text-gray-300 sm:grid-cols-2">
                <div class="rounded-xl bg-slate-50 px-3 py-2 dark:bg-gray-900/50">
                  <dt class="text-xs font-medium uppercase tracking-[0.08em] text-slate-500 dark:text-gray-400">Автор материала</dt>
                  <dd class="mt-1 font-medium text-slate-900 dark:text-gray-100">
                    <a
                      v-if="articleAuthorUrl"
                      :href="articleAuthorUrl"
                      target="_blank"
                      rel="author noopener noreferrer"
                      class="underline underline-offset-2 hover:text-blue-700 dark:hover:text-blue-300"
                    >
                      {{ articleAuthor }}
                    </a>
                    <span v-else>{{ articleAuthor }}</span>
                    <span v-if="articleAuthorRole" class="font-normal text-slate-600 dark:text-gray-300"> — {{ articleAuthorRole }}</span>
                  </dd>
                </div>

                <div class="rounded-xl bg-slate-50 px-3 py-2 dark:bg-gray-900/50">
                  <dt class="text-xs font-medium uppercase tracking-[0.08em] text-slate-500 dark:text-gray-400">Дата публикации</dt>
                  <dd class="mt-1 font-medium text-slate-900 dark:text-gray-100">
                    <time :datetime="articlePublishedIso || undefined">{{ articleDate }}</time>
                  </dd>
                </div>

                <div v-if="articleReviewer" class="rounded-xl bg-slate-50 px-3 py-2 dark:bg-gray-900/50">
                  <dt class="text-xs font-medium uppercase tracking-[0.08em] text-slate-500 dark:text-gray-400">Проверено</dt>
                  <dd class="mt-1 font-medium text-slate-900 dark:text-gray-100">
                    <a
                      v-if="articleReviewerUrl"
                      :href="articleReviewerUrl"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="underline underline-offset-2 hover:text-blue-700 dark:hover:text-blue-300"
                    >
                      {{ articleReviewer }}
                    </a>
                    <span v-else>{{ articleReviewer }}</span>
                    <span v-if="articleReviewedLabel" class="font-normal text-slate-600 dark:text-gray-300">
                      · <time :datetime="articleReviewedIso || undefined">{{ articleReviewedLabel }}</time>
                    </span>
                  </dd>
                </div>

                <div v-if="articleUpdatedLabel" class="rounded-xl bg-slate-50 px-3 py-2 dark:bg-gray-900/50">
                  <dt class="text-xs font-medium uppercase tracking-[0.08em] text-slate-500 dark:text-gray-400">Дата изменения</dt>
                  <dd class="mt-1 font-medium text-slate-900 dark:text-gray-100">
                    <time :datetime="articleUpdatedIso || undefined">{{ articleUpdatedLabel }}</time>
                  </dd>
                </div>

                <div v-if="articleSourceUrl" class="rounded-xl bg-slate-50 px-3 py-2 dark:bg-gray-900/50">
                  <dt class="text-xs font-medium uppercase tracking-[0.08em] text-slate-500 dark:text-gray-400">Источник</dt>
                  <dd class="mt-1">
                    <a
                      :href="articleSourceUrl"
                      target="_blank"
                      rel="nofollow noopener noreferrer"
                      class="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-100 hover:text-blue-800 dark:border-blue-800/70 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:border-blue-700 dark:hover:bg-blue-900/40 dark:hover:text-blue-200"
                    >
                      <span>{{ articleSourceName || articleSourceUrl }}</span>
                      <UIcon name="lucide:arrow-up-right" class="h-3.5 w-3.5" />
                    </a>
                  </dd>
                </div>
              </dl>
            </aside>

            <section v-if="suggestedArticles.length" class="mt-12 border-t border-slate-200 pt-8 dark:border-gray-800">
              <div class="mb-5 flex items-center justify-between gap-3">
                <h2 class="text-xl font-semibold text-slate-900 dark:text-gray-100">
                  {{ t('app.continueReading') || 'Continue reading' }}
                </h2>
                <NuxtLink
                  :to="backHref"
                  class="text-sm font-medium text-blue-600 transition hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
                >
                  {{ isNews ? (t('app.allNews') || 'Все новости') : (t('app.moreArticles') || 'More articles') }}
                </NuxtLink>
              </div>

              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <a
                  v-for="nextArticle in suggestedArticles"
                  :key="nextArticle.slug"
                  :href="`/${nextArticle.category}/${nextArticle.slug}`"
                  class="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800/80 dark:hover:border-blue-500"
                >
                  <img
                    :src="nextArticle.image"
                    :alt="nextArticle.title"
                    width="480"
                    height="224"
                    class="h-28 w-full object-cover"
                    loading="lazy"
                  />
                  <div class="p-3">
                    <p class="mb-1 text-xs text-slate-500 dark:text-gray-400">{{ nextArticle.dateLabel }}</p>
                    <h3 class="line-clamp-2 text-sm font-semibold leading-5 text-slate-900 group-hover:text-blue-700 dark:text-gray-100 dark:group-hover:text-blue-300">
                      {{ nextArticle.title }}
                    </h3>
                    <p v-if="nextArticle.description" class="mt-2 line-clamp-2 text-xs leading-5 text-slate-600 dark:text-gray-300">
                      {{ nextArticle.description }}
                    </p>
                  </div>
                </a>
              </div>
            </section>
          </div>
        </div>
      </article>

      <FeedSidebarWidget
        :articles-search="sidebarSearch"
        :selected-tag="sidebarSelectedTag"
        :popular-tags="sidebarPopularTags"
        :whats-new-posts="sidebarPosts"
        :is-mobile-viewport="isMobileSidebarViewport"
        :is-feed-section-in-view="isArticleInView"
        @update:articles-search="sidebarSearch = $event"
        @update:selected-tag="sidebarSelectedTag = $event"
        @open="handleSidebarOpen"
      />
    </section>

    <div class="relative z-10 mx-auto mt-10 w-full max-w-[1280px]">
      <AppFooter />
    </div>
  </main>
</template>

<style scoped>
:global(html.article-slug-page) {
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
  scrollbar-gutter: stable;
}

:global(body.article-slug-page) {
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
}

:global(body.article-slug-page #__nuxt) {
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
}

.article-content {
  color: rgb(51 65 85);
  overflow-wrap: anywhere;
  word-break: break-word;
}

.article-content :deep(a) { transition: color 0.15s ease; }
.article-content :deep(img), .article-content :deep(video), .article-content :deep(iframe), .article-content :deep(table), .article-content :deep(pre) { max-width: 100%; }
.article-content :deep(pre), .article-content :deep(code) { white-space: pre-wrap; word-break: break-word; }
.article-content :deep(a:hover) { color: rgb(29 78 216); }
.article-content :deep(strong) { color: inherit; font-weight: 700; background-image: none !important; -webkit-background-clip: border-box !important; background-clip: border-box !important; -webkit-text-fill-color: currentColor; }

:global(.dark) .article-content { color: rgb(209 213 219); }
:global(.dark) .article-content :deep(strong) { color: inherit; }
</style>
