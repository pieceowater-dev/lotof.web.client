<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import type { HomeFeedPost } from '@/components/HomePostsFeed.vue';
import { capitalGetPublicPublicationByRoute, publicationBlocksToHtml } from '@/api/publications';
import { refreshAccessToken } from '@/api/auth/tokenRefresh';
import { formatPublishedDate, estimateReadTimeMinutes } from '@/utils/markdown';
import { toGqlCategory, fromGqlCategory, CATEGORY_TO_GQL } from '@/utils/publicationCategory';

definePageMeta({
  viewTransition: false,
  path: '/:category(blog|whatsnew|articles|academy|news)/:slug',
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

const { data: sidebarWhatsNewData } = await useFetch<PublicationsAllResponse>('/api/publications/all', {
  query: { category: 'whatsnew', includeDraft: 'false' },
  default: () => ({ items: [] }),
});

type DirectPublicByRouteResponse = {
  data?: {
    publicPublicationByRoute?: {
      slug?: string;
      category?: string;
      title?: string;
      excerpt?: string;
      author?: string;
      authorRole?: string;
      publishedAtUnix?: string;
      tags?: string[];
      ogImage?: string;
      featuredImageAlt?: string;
      schemaType?: string;
      sourceUrl?: string;
      sourceName?: string;
      reviewedBy?: string;
      reviewedByUrl?: string;
      reviewedDateUnix?: string;
      publisherName?: string;
      publisherUrl?: string;
      publisherLogo?: string;
      canonicalUrl?: string;
      robots?: string;
      blocks?: Array<{
        id?: string;
        type?: string;
        content?: string;
        attrsJson?: string;
      }>;
    } | null;
  };
  errors?: Array<{ message?: string }>;
};

const DIRECT_PUBLIC_PUBLICATION_BY_ROUTE_QUERY = `
  query PublicPublicationByRoute($category: PublicationCategory!, $slug: String!, $includeBlocks: Boolean!) {
    publicPublicationByRoute(category: $category, slug: $slug, includeBlocks: $includeBlocks) {
      slug
      category
      title
      excerpt
      author
      authorRole
      publishedAtUnix
      tags
      ogImage
      featuredImageAlt
      schemaType
      sourceUrl
      sourceName
      reviewedBy
      reviewedByUrl
      reviewedDateUnix
      publisherName
      publisherUrl
      publisherLogo
      canonicalUrl
      robots
      blocks @include(if: $includeBlocks) {
        id
        type
        content
        attrsJson
      }
    }
  }
`;

const DIRECT_GQL_CATEGORIES = Object.values(CATEGORY_TO_GQL);

const { t, locale } = useI18n();
const route = useRoute();
const requestFetch = useRequestFetch();
const config = useRuntimeConfig();
const authToken = useCookie<string | null>('auth_token');
const legacyToken = useCookie<string | null>('token');

const SUPPORTED_PUBLICATION_CATEGORIES = new Set(['blog', 'whatsnew', 'articles', 'academy', 'news']);

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

function unixLikeToIso(raw: unknown): string {
  const value = String(raw || '').trim();
  if (!value) return '';

  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && asNumber > 0) {
    const millis = value.length <= 10 ? asNumber * 1000 : asNumber;
    const fromUnix = new Date(millis);
    if (!Number.isNaN(fromUnix.getTime())) return fromUnix.toISOString();
  }

  const fromNative = new Date(value);
  if (!Number.isNaN(fromNative.getTime())) return fromNative.toISOString();

  return '';
}

const routeAsyncKey = `public-publication-route:${categoryParam.value}:${slugParam.value}`;

const { data: routePublication, refresh: refreshRoutePublication } = await useAsyncData<PublicationArticleDoc | null>(
  routeAsyncKey,
  async () => {
    if (!slugParam.value) return null;

    // Prefer slug-based server fallback first: it already handles category probing
    // and is resilient to upstream public list auth limitations.
    try {
      const all = await requestFetch<PublicationsAllResponse>('/api/publications/all', {
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

    try {
      const preferred = categoryParam.value ? toGqlCategory(categoryParam.value) : '';
      const categories = [preferred, ...DIRECT_GQL_CATEGORIES].filter((value, index, arr) => !!value && arr.indexOf(value) === index);
      const isAuthorized = !!String(authToken.value || legacyToken.value || '').trim();

      for (const gqlCategory of categories) {
        const response = await $fetch<DirectPublicByRouteResponse>('/api-capital/query', {
          method: 'POST',
          body: {
            query: DIRECT_PUBLIC_PUBLICATION_BY_ROUTE_QUERY,
            variables: {
              category: gqlCategory,
              slug: slugParam.value,
              includeBlocks: true,
            },
          },
        });

        if (response?.errors?.length) continue;
        const publication = response?.data?.publicPublicationByRoute;
        if (!publication) continue;

        const resolvedSlug = normalizeSlug(String(publication.slug || slugParam.value));
        const resolvedCategory = publication.category ? fromGqlCategory(publication.category) : (categoryParam.value || 'news');

        return {
          slug: resolvedSlug,
          category: resolvedCategory,
          meta: {
            slug: resolvedSlug,
            category: resolvedCategory,
            title: String(publication.title || '').trim(),
            description: String(publication.excerpt || '').trim(),
            author: String(publication.author || 'Lota Team').trim(),
            author_role: String(publication.authorRole || '').trim(),
            date: unixLikeToIso(publication.publishedAtUnix),
            tags: Array.isArray(publication.tags) ? publication.tags : [],
            og_image: String(publication.ogImage || '').trim(),
            featured_image_alt: String(publication.featuredImageAlt || '').trim(),
            schema_type: String(publication.schemaType || '').trim(),
            source_url: String(publication.sourceUrl || '').trim(),
            source_name: String(publication.sourceName || '').trim(),
            reviewed_by: String(publication.reviewedBy || '').trim(),
            reviewed_by_url: String(publication.reviewedByUrl || '').trim(),
            reviewed_date: unixLikeToIso(publication.reviewedDateUnix),
            publisher_name: String(publication.publisherName || '').trim(),
            publisher_url: String(publication.publisherUrl || '').trim(),
            publisher_logo: String(publication.publisherLogo || '').trim(),
            canonical: String(publication.canonicalUrl || '').trim(),
            robots: String(publication.robots || '').trim(),
          },
          body: publicationBlocksToHtml(publication.blocks as any, { isAuthorized }) || String(publication.excerpt || '').trim(),
        };
      }
    } catch {
      // Continue with client helper and local fallbacks below.
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

if (process.client) {
  const refreshedForAuth = useState<boolean>('publication-route-auth-refresh-done', () => false);
  onMounted(async () => {
    if (refreshedForAuth.value) return;
    refreshedForAuth.value = true;

    let hasToken = !!String(authToken.value || legacyToken.value || '').trim();
    if (!hasToken) {
      try {
        await refreshAccessToken();
      } catch {
        // Ignore silent refresh errors for public pages.
      }
      hasToken = !!String(authToken.value || legacyToken.value || '').trim();
    }

    if (!hasToken) return;

    try {
      await refreshRoutePublication();
    } catch {
      // Keep prerendered content if runtime refresh fails.
    }
  });
}

if (!routePublication.value) {
  throw createError({ statusCode: 404, statusMessage: 'Article not found' });
}

const article = computed<PublicationArticleDoc | null>(() => routePublication.value);

const articleTitle = computed(() => String(article.value?.meta.title || 'Article'));
const articleDescription = computed(() => String(article.value?.meta.description || ''));
const articleAuthor = computed(() => String(article.value?.meta.author || 'Lota Team'));
const articleAuthorRole = computed(() => String(article.value?.meta.author_role || '').trim());
const articleOgImage = computed(() => {
  const ogImage = String(article.value?.meta.og_image || '').trim();
  const featuredImage = String(article.value?.meta.featured_image || '').trim();
  return ogImage || featuredImage || undefined;
});
const articleFirstBodyImageAlt = computed(() => {
  const body = String(article.value?.body || '');

  const markdownImage = body.match(/!\[([^\]]*)\]\(([^)]+)\)/);
  const markdownAlt = String(markdownImage?.[1] || '').trim();
  if (markdownAlt) return markdownAlt;

  const htmlAlt = body.match(/<img\s+[^>]*alt=["']([^"']*)["'][^>]*>/i);
  const rawHtmlAlt = String(htmlAlt?.[1] || '').trim();
  if (!rawHtmlAlt) return '';

  return rawHtmlAlt
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
});

const articleOgImageAlt = computed(() => {
  const featuredAlt = String(article.value?.meta.featured_image_alt || '').trim();
  const ogAlt = String(article.value?.meta.og_image_alt || '').trim();
  return featuredAlt || ogAlt || articleFirstBodyImageAlt.value || articleTitle.value;
});
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
const articlePublisherLogo = computed(() => {
  const logo = String(article.value?.meta.publisher_logo || '').trim();
  return logo || undefined;
});

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
  // Prefer the article's own resolved category over the raw route param: a
  // stale/aliased link (e.g. an old category segment) should still canonicalize
  // to where the article actually lives, not to whatever URL it was reached by.
  const resolvedCategory = String(article.value?.category || categoryParam.value || 'news').trim();
  return `${siteUrl.value}/${resolvedCategory}/${slugParam.value}`;
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
  return formatPublishedDate(dateISO, locale.value);
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
  const minutes = estimateReadTimeMinutes(markdown);
  return t('app.readTimeMinutes', { minutes }) || `${minutes} min read`;
}

const sidebarSearch = ref('');
const sidebarSelectedTag = ref('');
const WHATS_NEW_SIDEBAR_LIMIT = 5;
const isMobileSidebarViewport = ref(false);
const isArticleInView = ref(true);
let sidebarMediaQuery: MediaQueryList | null = null;

const sidebarBasePosts = computed<HomeFeedPost[]>(() => {
  const apiItems = sidebarWhatsNewData.value?.items || [];
  if (apiItems.length > 0) {
    return apiItems
      .filter((doc) => String(doc.slug || '') !== slugParam.value)
      .map((doc) => {
        const meta = doc.meta || {};
        const body = String(doc.body || '');
        const slug = String(doc.slug || '').trim();
        const title = String(meta.title || slug);
        const imgMatch = body.match(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/);
        const imgSrc = String(meta.og_image || meta.featured_image || imgMatch?.[2] || '/og-image.png');
        return {
          id: slug,
          href: `/whatsnew/${slug}`,
          category: t('app.whatsNew') || "What's New",
          title,
          excerpt: String(meta.description || '').trim(),
          author: String(meta.author || 'Lota Team'),
          publishedAt: toDateLabel(String(meta.date || '')),
          readTime: estimateReadTime(body),
          image: imgSrc,
          imageAlt: title,
          tags: Array.isArray(meta.tags) ? meta.tags.map(String) : [],
        } as HomeFeedPost;
      });
  }
  // fallback to local markdown files
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

const articleHtml = computed(() => sanitizedArticleBody.value);

function stripHtmlTags(value: string): string {
  return String(value || '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

const faqItems = computed(() => {
  const html = String(articleHtml.value || '');
  if (!html.includes('data-faq-item')) return [] as Array<{ question: string; answer: string }>;

  const items: Array<{ question: string; answer: string }> = [];
  const re = /<details[^>]*data-faq-item[^>]*>[\s\S]*?<summary[^>]*data-faq-question[^>]*>([\s\S]*?)<\/summary>[\s\S]*?<div[^>]*data-faq-answer[^>]*>([\s\S]*?)<\/div>[\s\S]*?<\/details>/gi;

  let match: RegExpExecArray | null = re.exec(html);
  while (match) {
    const question = stripHtmlTags(match[1]);
    const answer = stripHtmlTags(match[2]);
    if (question && answer) {
      items.push({ question, answer });
    }
    match = re.exec(html);
  }

  return items;
});

const faqJsonLd = computed(() => {
  if (!faqItems.value.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.value.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
});

function setupFaqAccordion() {
  if (!process.client) return;

  const root = document.querySelector('.article-content');
  if (!root) return;

  const items = Array.from(root.querySelectorAll<HTMLDetailsElement>('details[data-faq-item]'));
  if (!items.length) return;

  let isSyncing = false;
  items.forEach((item, index) => {
    item.open = index === 0;
  });

  items.forEach((item) => {
    item.ontoggle = () => {
      if (isSyncing || !item.open) return;
      isSyncing = true;
      for (const other of items) {
        if (other !== item) other.open = false;
      }
      isSyncing = false;
    };
  });
}

useSeoMeta({
  title: () => articleTitle.value,
  description: () => articleDescription.value,
  ogTitle: () => articleTitle.value,
  ogDescription: () => articleDescription.value,
  ogType: 'article',
  ogUrl: () => articleCanonical.value,
  ogImage: () => articleOgImage.value,
  ogImageAlt: () => articleOgImageAlt.value,
  twitterCard: 'summary_large_image',
  twitterTitle: () => articleTitle.value,
  twitterDescription: () => articleDescription.value,
  twitterImage: () => articleOgImage.value,
  twitterImageAlt: () => articleOgImageAlt.value,
});

useHead(() => ({
  title: articleTitle.value,
  link: [
    { rel: 'canonical', href: articleCanonical.value },
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
    ...(faqJsonLd.value ? [{ type: 'application/ld+json', children: JSON.stringify(faqJsonLd.value) }] : []),
  ],
}));

function setupAnchorScroll() {
  if (!process.client) return;

  function resolveHashId(rawHash: string): string {
    const clean = String(rawHash || '').replace(/^#/, '');
    if (!clean) return '';
    try { return decodeURIComponent(clean); } catch { return clean; }
  }

  // Return the element the page actually scrolls in (may be <main>, not window).
  function getScrollContainer(): HTMLElement {
    return (
      (document.querySelector('main.main-scroll') as HTMLElement | null)
      ?? (document.querySelector('main') as HTMLElement | null)
      ?? document.documentElement
    );
  }

  function getHeaderOffset(): number {
    let maxBottom = 0;
    for (const header of Array.from(document.querySelectorAll('header'))) {
      const style = window.getComputedStyle(header);
      if (style.position !== 'fixed' && style.position !== 'sticky') continue;
      const rect = header.getBoundingClientRect();
      if (rect.bottom <= 0 || rect.top > 120) continue;
      maxBottom = Math.max(maxBottom, rect.bottom);
    }
    return Math.max(0, Math.round(maxBottom + 8));
  }

  function scrollToHash(rawHash: string, behavior: ScrollBehavior = 'smooth'): boolean {
    const id = resolveHashId(rawHash);
    if (!id) return false;

    let el = document.getElementById(id);
    if (!el && typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
      el = document.querySelector(`#${CSS.escape(id)}`) as HTMLElement | null;
    }
    if (!el) return false;

    const container = getScrollContainer();
    const isDocRoot = container === document.documentElement || container === document.body;
    const currentScroll = isDocRoot ? window.scrollY : container.scrollTop;
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const headerOffset = getHeaderOffset();

    const top = Math.max(
      0,
      Math.round(elRect.top - containerRect.top + currentScroll - headerOffset),
    );

    if (isDocRoot) {
      window.scrollTo({ top, behavior });
    } else {
      container.scrollTo({ top, behavior });
    }

    return true;
  }

  function findAnchorFromEvent(e: MouseEvent): HTMLAnchorElement | null {
    const direct = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (direct) return direct;
    const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
    for (const node of path) {
      if (node instanceof HTMLAnchorElement && node.hasAttribute('href')) return node;
      if (node instanceof HTMLElement) {
        const nested = node.closest('a[href]') as HTMLAnchorElement | null;
        if (nested) return nested;
      }
    }
    return null;
  }

  function handleAnchorClick(e: MouseEvent) {
    const anchor = findAnchorFromEvent(e);
    if (!anchor) return;

    const href = anchor.getAttribute('href') || '';
    if (!href) return;

    let resolvedUrl: URL;
    try { resolvedUrl = new URL(href, window.location.href); } catch { return; }

    if (!resolvedUrl.hash) return;

    const norm = (v: string) => String(v || '').replace(/\/+$/, '') || '/';
    const samePage =
      resolvedUrl.origin === window.location.origin &&
      norm(resolvedUrl.pathname) === norm(window.location.pathname) &&
      resolvedUrl.search === window.location.search;

    if (!samePage) return;

    // Prevent browser default FIRST so it doesn't also jump/snap.
    e.preventDefault();

    scrollToHash(resolvedUrl.hash, 'smooth');

    if (window.location.hash !== resolvedUrl.hash) {
      window.history.pushState(null, '', resolvedUrl.hash);
    }
  }

  function handleHashChange() {
    scrollToHash(window.location.hash, 'smooth');
  }

  document.addEventListener('click', handleAnchorClick, true);
  window.addEventListener('hashchange', handleHashChange);
  return () => {
    document.removeEventListener('click', handleAnchorClick, true);
    window.removeEventListener('hashchange', handleHashChange);
  };
}

let cleanupAnchorScroll: (() => void) | undefined;

onMounted(() => {
  if (!process.client) return;
  document.documentElement.classList.add('article-slug-page');
  document.body.classList.add('article-slug-page');
  nextTick(() => {
    setupFaqAccordion();
  });
  cleanupAnchorScroll = setupAnchorScroll();

  // Scroll to hash on initial load using the same container-aware logic.
  if (window.location.hash) {
    nextTick(() => {
      const rawHash = String(window.location.hash || '').replace(/^#/, '');
      if (!rawHash) return;
      let id = rawHash;
      try { id = decodeURIComponent(rawHash); } catch { id = rawHash; }

      let el = document.getElementById(id);
      if (!el && typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
        el = document.querySelector(`#${CSS.escape(id)}`) as HTMLElement | null;
      }
      if (!el) return;

      const container: HTMLElement =
        (document.querySelector('main.main-scroll') as HTMLElement | null)
        ?? (document.querySelector('main') as HTMLElement | null)
        ?? document.documentElement;

      const isDocRoot = container === document.documentElement || container === document.body;
      const currentScroll = isDocRoot ? window.scrollY : container.scrollTop;
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();

      // Measure fixed header height.
      let maxBottom = 0;
      for (const header of Array.from(document.querySelectorAll('header'))) {
        const style = window.getComputedStyle(header);
        if (style.position !== 'fixed' && style.position !== 'sticky') continue;
        const rect = header.getBoundingClientRect();
        if (rect.bottom <= 0 || rect.top > 120) continue;
        maxBottom = Math.max(maxBottom, rect.bottom);
      }
      const headerOffset = Math.max(0, Math.round(maxBottom + 8));

      const top = Math.max(
        0,
        Math.round(elRect.top - containerRect.top + currentScroll - headerOffset),
      );

      if (isDocRoot) {
        window.scrollTo({ top, behavior: 'smooth' });
      } else {
        container.scrollTo({ top, behavior: 'smooth' });
      }
    });
  }

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
    setupFaqAccordion();
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }
);

watch(articleHtml, async () => {
  if (!process.client) return;
  await nextTick();
  setupFaqAccordion();
});

onBeforeUnmount(() => {
  cleanupAnchorScroll?.();
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
