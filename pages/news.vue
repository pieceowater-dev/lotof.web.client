<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import type { HomeFeedPost } from '@/components/HomePostsFeed.vue';

const { t, locale } = useI18n();

type ProcessedMarkdownPost = HomeFeedPost & {
  categorySlug: string;
  dateISO: string;
};

type PublicationApiDoc = {
  slug?: string;
  category?: string;
  meta?: Record<string, string | string[] | undefined>;
  body?: string;
};

const { data: publicationDocsData, refresh: refreshPublicationDocs } = await useFetch<{ items: PublicationApiDoc[] }>('/api/publications/all', {
  query: {
    category: 'news',
    includeDraft: 'false',
  },
  default: () => ({ items: [] }),
});

const { data: whatsNewDocsData, refresh: refreshWhatsNewDocs } = await useFetch<{ items: PublicationApiDoc[] }>('/api/publications/all', {
  query: {
    category: 'whatsnew',
    includeDraft: 'false',
  },
  default: () => ({ items: [] }),
});

const authToken = useCookie<string | null>('token', { path: '/' });
const legacyToken = useCookie<string | null>('auth_token', { path: '/' });
const newsAuthRefreshDone = useState<boolean>('news-auth-refresh-done', () => false);

function markdownToText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[>*_~#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstImage(markdown: string): { src: string; alt: string } | null {
  const markdownMatch = markdown.match(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/);
  if (markdownMatch) {
    return { src: markdownMatch[2], alt: markdownMatch[1] || '' };
  }

  const htmlMatch = markdown.match(/<img\s+[^>]*src=["']([^"']+)["'][^>]*>/i);
  if (!htmlMatch) return null;
  const altMatch = markdown.match(/<img\s+[^>]*alt=["']([^"']*)["'][^>]*>/i);
  return { src: htmlMatch[1], alt: altMatch?.[1] || '' };
}

function excerptFromBody(markdown: string): string {
  const lines = markdown.split('\n').map((line) => line.trim());
  for (const line of lines) {
    if (!line || line.startsWith('#') || line.startsWith('![') || line.startsWith('---')) continue;
    const txt = markdownToText(line);
    if (txt) return txt;
  }
  return markdownToText(markdown).slice(0, 180);
}

function readTimeLabel(markdown: string): string {
  const words = markdownToText(markdown).split(' ').filter(Boolean).length;
  const mins = Math.max(1, Math.ceil(words / 220));
  return t('app.readTimeMinutes', { minutes: mins }) || `${mins} min read`;
}

function formatDate(dateISO: string): string {
  const dt = new Date(dateISO);
  if (Number.isNaN(dt.getTime())) return dateISO;

  const intlLocale = locale.value === 'ru'
    ? 'ru-RU'
    : locale.value === 'kk'
      ? 'kk-KZ'
      : 'en-GB';

  return dt.toLocaleDateString(intlLocale, { day: '2-digit', month: 'short', year: 'numeric' });
}

function processNewsPosts(): ProcessedMarkdownPost[] {
  const posts: ProcessedMarkdownPost[] = [];

  for (const doc of publicationDocsData.value?.items || []) {
    const meta = doc.meta || {};
    const body = String(doc.body || '');
    const categorySlug = String(doc.category || meta.category || '').toLowerCase();
    const slug = String(doc.slug || meta.slug || '').trim();
    const title = String(meta.title || '').trim();
    const dateISO = String(meta.date || '').trim();

    if (!slug || !title || categorySlug !== 'news') continue;

    const imgFromBody = firstImage(body);
    const image = String(meta.og_image || meta.featured_image || imgFromBody?.src || '/og-image.png');
    const imageAlt = imgFromBody?.alt || title;
    const tags = Array.isArray(meta.tags) ? meta.tags.map((tag) => String(tag)) : [];
    const author = String(meta.author || 'Lota Team');
    const resolvedDate = dateISO || new Date().toISOString();

    posts.push({
      id: slug,
      href: `/news/${slug}`,
      category: t('app.news') || 'News',
      categorySlug: 'news',
      title,
      excerpt: String(meta.description || '').trim() || excerptFromBody(body),
      preview: String(meta.description || '').trim() ? excerptFromBody(body) : '',
      author,
      publishedAt: formatDate(resolvedDate),
      dateISO: resolvedDate,
      readTime: readTimeLabel(body),
      image,
      imageAlt,
      tags,
    });
  }

  return posts.sort((a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime());
}

function processWhatsNewPosts(): ProcessedMarkdownPost[] {
  const posts: ProcessedMarkdownPost[] = [];

  for (const doc of whatsNewDocsData.value?.items || []) {
    const meta = doc.meta || {};
    const body = String(doc.body || '');
    const categorySlug = String(doc.category || meta.category || '').toLowerCase();
    const slug = String(doc.slug || meta.slug || '').trim();
    const title = String(meta.title || '').trim();
    const dateISO = String(meta.date || '').trim();

    if (!slug || !title || categorySlug !== 'whatsnew') continue;

    const imgFromBody = firstImage(body);
    const image = String(meta.og_image || meta.featured_image || imgFromBody?.src || '/og-image.png');
    const imageAlt = imgFromBody?.alt || title;
    const tags = Array.isArray(meta.tags) ? meta.tags.map((tag) => String(tag)) : [];
    const author = String(meta.author || 'Lota Team');
    const resolvedDate = dateISO || new Date().toISOString();

    posts.push({
      id: slug,
      href: `/whatsnew/${slug}`,
      category: t('app.whatsNew') || "What's New",
      categorySlug: 'whatsnew',
      title,
      excerpt: String(meta.description || '').trim() || excerptFromBody(body),
      preview: String(meta.description || '').trim() ? excerptFromBody(body) : '',
      author,
      publishedAt: formatDate(resolvedDate),
      dateISO: resolvedDate,
      readTime: readTimeLabel(body),
      image,
      imageAlt,
      tags,
    });
  }

  return posts.sort((a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime());
}

const allNewsPosts = computed(() => processNewsPosts());
const allWhatsNewPosts = computed(() => processWhatsNewPosts());
const WHATS_NEW_SIDEBAR_LIMIT = 5;
const whatsNewSidebarPosts = computed(() => allWhatsNewPosts.value.slice(0, WHATS_NEW_SIDEBAR_LIMIT));

const newsSearch = ref('');
const selectedNewsTag = ref('');
const popularNewsTags = computed(() => {
  const counts = new Map<string, number>();
  for (const post of allNewsPosts.value) {
    for (const tag of post.tags) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([tag]) => tag);
});

const filteredNewsPosts = computed(() => {
  const q = newsSearch.value.trim().toLowerCase();
  return allNewsPosts.value.filter((post) => {
    const tagMatches = !selectedNewsTag.value || post.tags.includes(selectedNewsTag.value);
    if (!tagMatches) return false;
    if (!q) return true;
    const haystack = `${post.title} ${post.excerpt} ${post.tags.join(' ')}`.toLowerCase();
    return haystack.includes(q);
  });
});

const INITIAL_LIMIT = 12;
const STEP = 8;
const visibleCount = ref(INITIAL_LIMIT);

const visibleNewsPosts = computed(() => filteredNewsPosts.value.slice(0, visibleCount.value));
const canLoadMore = computed(() => visibleNewsPosts.value.length < filteredNewsPosts.value.length);

const isMobileFeedViewport = ref(false);
const newsSectionRef = ref<HTMLElement | null>(null);
const isNewsSectionInView = ref(false);
let mobileFeedMediaQuery: MediaQueryList | null = null;
let newsSectionObserver: IntersectionObserver | null = null;

const sentinelRef = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;
let loadLocked = false;

function onMobileFeedMediaChange(event: MediaQueryListEvent) {
  isMobileFeedViewport.value = event.matches;
}

function disconnectNewsSectionObserver() {
  if (newsSectionObserver) {
    newsSectionObserver.disconnect();
    newsSectionObserver = null;
  }
}

async function ensureNewsSectionObserver() {
  if (!process.client || !isMobileFeedViewport.value) {
    isNewsSectionInView.value = false;
    disconnectNewsSectionObserver();
    return;
  }

  await nextTick();
  const sectionEl = newsSectionRef.value;
  if (!sectionEl) {
    isNewsSectionInView.value = false;
    disconnectNewsSectionObserver();
    return;
  }

  if (!newsSectionObserver) {
    newsSectionObserver = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        isNewsSectionInView.value = !!first?.isIntersecting;
      },
      {
        root: null,
        rootMargin: '-10% 0px -25% 0px',
        threshold: 0.08,
      }
    );
  }

  newsSectionObserver.disconnect();
  newsSectionObserver.observe(sectionEl);
}

function loadMore() {
  visibleCount.value = Math.min(filteredNewsPosts.value.length, visibleCount.value + STEP);
}

function setupObserver() {
  if (!process.client || !canLoadMore.value) {
    observer?.disconnect();
    return;
  }

  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || loadLocked || !canLoadMore.value) return;
        loadLocked = true;
        loadMore();
        loadLocked = false;
      },
      { rootMargin: '200px 0px', threshold: 0.05 }
    );
  }

  observer.disconnect();
  if (sentinelRef.value) observer.observe(sentinelRef.value);
}

onMounted(() => {
  const hasToken = !!String(authToken.value || legacyToken.value || '').trim();
  if (hasToken && !newsAuthRefreshDone.value) {
    newsAuthRefreshDone.value = true;
    Promise.allSettled([refreshPublicationDocs(), refreshWhatsNewDocs()]).catch(() => {
      // Keep current payload if auth-aware refresh fails.
    });
  }

  mobileFeedMediaQuery = window.matchMedia('(max-width: 767px)');
  isMobileFeedViewport.value = mobileFeedMediaQuery.matches;
  mobileFeedMediaQuery.addEventListener('change', onMobileFeedMediaChange);

  setupObserver();
  ensureNewsSectionObserver();
});

onBeforeUnmount(() => {
  observer?.disconnect();
  observer = null;

  if (mobileFeedMediaQuery) {
    mobileFeedMediaQuery.removeEventListener('change', onMobileFeedMediaChange);
    mobileFeedMediaQuery = null;
  }

  disconnectNewsSectionObserver();
});

watch([canLoadMore, () => visibleNewsPosts.value.length], () => {
  setupObserver();
});

watch([isMobileFeedViewport, () => visibleNewsPosts.value.length], () => {
  ensureNewsSectionObserver();
});

watch([newsSearch, selectedNewsTag], () => {
  visibleCount.value = INITIAL_LIMIT;
});

function handleOpenPost(post: HomeFeedPost) {
  if (!post.href) return;
  if (process.client) {
    window.location.assign(post.href);
    return;
  }
  navigateTo(post.href);
}

const config = useRuntimeConfig();
const siteUrl = (config.public.siteUrl || 'https://lota.tools').replace(/\/$/, '');

useHead({ title: t('app.news') || 'News' });

useSeoMeta({
  title: () => t('app.news') || 'Новости',
  description: () => 'Последние новости и анонсы платформы Lota.',
  ogTitle: () => t('app.news') || 'Новости',
  ogDescription: () => 'Последние новости и анонсы платформы Lota.',
  ogType: 'website',
  ogUrl: `${siteUrl}/news`,
  ogImage: `${siteUrl}/og-image.png`,
  twitterCard: 'summary_large_image',
});

</script>

<template>
  <div class="min-h-screen bg-white dark:bg-gray-900 flex flex-col">
    <div class="flex-1">
      <div ref="newsSectionRef" class="mx-auto w-full max-w-[1180px] px-3 md:px-6 py-5 md:py-8 text-gray-700 dark:text-gray-300">
        <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 md:gap-8 items-start">
          <section>
            <div class="mb-5 flex items-center gap-2">
              <UIcon name="lucide:radio" class="h-5 w-5 text-blue-600 dark:text-blue-300" />
              <h1 class="text-xl font-semibold text-gray-900 dark:text-gray-100">{{ t('app.news') || 'Новости' }}</h1>
            </div>

            <div v-if="visibleNewsPosts.length === 0" class="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center dark:border-gray-700 dark:bg-gray-800">
              <div class="flex flex-col items-center gap-3">
                <UIcon name="lucide:radio" class="h-10 w-10 text-blue-200 dark:text-gray-600" />
                <p class="text-gray-600 dark:text-gray-400">{{ t('app.noNewsYet') || 'Новостей пока нет' }}</p>
              </div>
            </div>
            <HomePostsFeed v-else :posts="visibleNewsPosts" @open="handleOpenPost" />

            <div v-if="canLoadMore" ref="sentinelRef" class="h-px w-full" aria-hidden="true" />
          </section>

          <FeedSidebarWidget
            :articles-search="newsSearch"
            :selected-tag="selectedNewsTag"
            :popular-tags="popularNewsTags"
            :whats-new-posts="whatsNewSidebarPosts"
            :is-mobile-viewport="isMobileFeedViewport"
            :is-feed-section-in-view="isNewsSectionInView"
            @update:articles-search="newsSearch = $event"
            @update:selected-tag="selectedNewsTag = $event"
            @open="handleOpenPost"
          />
        </div>
      </div>
    </div>

    <div class="m-4 mt-auto">
      <AppFooter />
    </div>
  </div>
</template>
