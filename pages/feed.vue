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
  query: { includeDraft: 'false' },
  default: () => ({ items: [] }),
});

const authToken = useCookie<string | null>('token', { path: '/' });
const legacyToken = useCookie<string | null>('auth_token', { path: '/' });
const feedAuthRefreshDone = useState<boolean>('feed-auth-refresh-done', () => false);

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

function processMarkdownPosts(): ProcessedMarkdownPost[] {
  const posts: ProcessedMarkdownPost[] = [];

  const categoryLabel = (slug: string): string => {
    if (slug === 'whatsnew') return t('app.whatsNew') || "What's New";
    if (slug === 'news') return t('app.news') || 'News';
    if (slug === 'blog') return t('app.blog') || 'Blog';
    if (slug === 'learning') return t('app.learning') || 'Learning';
    if (slug === 'articles') return t('app.articles') || 'Articles';
    return t('app.articles') || 'Articles';
  };

  for (const doc of publicationDocsData.value?.items || []) {
    const meta = doc.meta || {};
    const body = String(doc.body || '');
    const categorySlug = String(doc.category || meta.category || '').toLowerCase();
    const slug = String(doc.slug || meta.slug || '').trim();
    const title = String(meta.title || '').trim();
    const dateISO = String(meta.date || '').trim();

    if (!slug || !title || !categorySlug) continue;

    const imgFromBody = firstImage(body);
    const image = String(meta.og_image || meta.featured_image || imgFromBody?.src || '').trim();
    const imageAlt = imgFromBody?.alt || title;
    const tags = Array.isArray(meta.tags) ? meta.tags.map((tag) => String(tag)) : [];
    const author = String(meta.author || 'Lota Team');
    const resolvedDate = dateISO || new Date().toISOString();

    posts.push({
      id: `${categorySlug}:${slug}`,
      href: `/${categorySlug}/${slug}`,
      category: categoryLabel(categorySlug),
      categorySlug,
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

const allProcessedPosts = computed(() => processMarkdownPosts());
const articleFeedPosts = computed(() => allProcessedPosts.value.filter((post) => post.categorySlug !== 'news' && post.categorySlug !== 'whatsnew'));
const allWhatsNewPosts = computed(() => allProcessedPosts.value.filter((post) => post.categorySlug === 'whatsnew'));
const WHATS_NEW_SIDEBAR_LIMIT = 5;
const whatsNewSidebarPosts = computed(() => allWhatsNewPosts.value.slice(0, WHATS_NEW_SIDEBAR_LIMIT));

const articlesSearch = ref('');
const selectedArticleTag = ref('');
const popularArticleTags = computed(() => {
  const counts = new Map<string, number>();
  for (const post of articleFeedPosts.value) {
    for (const tag of post.tags) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([tag]) => tag);
});

const filteredArticleFeedPosts = computed(() => {
  const q = articlesSearch.value.trim().toLowerCase();
  return articleFeedPosts.value.filter((post) => {
    const tagMatches = !selectedArticleTag.value || post.tags.includes(selectedArticleTag.value);
    if (!tagMatches) return false;
    if (!q) return true;
    const haystack = `${post.title} ${post.excerpt} ${post.tags.join(' ')}`.toLowerCase();
    return haystack.includes(q);
  });
});

const DESKTOP_FEED_LIMIT = 60;
const MOBILE_INITIAL_FEED_LIMIT = 5;
const MOBILE_FEED_STEP = 5;

const isMobileFeedViewport = ref(false);
const mobileFeedVisibleCount = ref(MOBILE_INITIAL_FEED_LIMIT);
let mobileFeedMediaQuery: MediaQueryList | null = null;

const mobileFeedSentinel = ref<HTMLElement | null>(null);
let mobileFeedObserver: IntersectionObserver | null = null;
let mobileFeedAdvanceLocked = false;

const feedSectionRef = ref<HTMLElement | null>(null);
const isFeedSectionInView = ref(false);
let feedSectionObserver: IntersectionObserver | null = null;

const maxFeedCards = computed(() => Math.min(DESKTOP_FEED_LIMIT, filteredArticleFeedPosts.value.length));
const maxVisibleFeedCards = computed(() => maxFeedCards.value);

const visibleArticleFeedPosts = computed(() => {
  if (!isMobileFeedViewport.value) {
    return filteredArticleFeedPosts.value.slice(0, maxVisibleFeedCards.value);
  }
  const limit = Math.min(maxVisibleFeedCards.value, mobileFeedVisibleCount.value);
  return filteredArticleFeedPosts.value.slice(0, limit);
});

const localizedVisibleArticleFeedPosts = computed(() => visibleArticleFeedPosts.value);

const canAutoLoadMoreMobilePosts = computed(() => {
  if (!isMobileFeedViewport.value) return false;
  return visibleArticleFeedPosts.value.length < maxVisibleFeedCards.value;
});

function handleOpenPost(post: HomeFeedPost) {
  if (!post.href) return;
  if (process.client) {
    window.location.assign(post.href);
  }
}

function onMobileFeedMediaChange(event: MediaQueryListEvent) {
  isMobileFeedViewport.value = event.matches;
  if (event.matches) {
    mobileFeedVisibleCount.value = Math.min(MOBILE_INITIAL_FEED_LIMIT, maxFeedCards.value);
  }
}

function loadMoreMobileFeedPosts() {
  mobileFeedVisibleCount.value = Math.min(maxVisibleFeedCards.value, mobileFeedVisibleCount.value + MOBILE_FEED_STEP);
}

function maybeLoadMoreMobileFeedByScroll() {
  if (!process.client || !isMobileFeedViewport.value || mobileFeedAdvanceLocked || !canAutoLoadMoreMobilePosts.value) {
    return;
  }

  const scrollBottom = window.scrollY + window.innerHeight;
  const pageBottom = document.documentElement.scrollHeight;
  if (scrollBottom < pageBottom - 220) return;

  mobileFeedAdvanceLocked = true;
  loadMoreMobileFeedPosts();
  nextTick(() => {
    mobileFeedAdvanceLocked = false;
  });
}

function disconnectMobileFeedObserver() {
  if (mobileFeedObserver) {
    mobileFeedObserver.disconnect();
    mobileFeedObserver = null;
  }
}

function disconnectFeedSectionObserver() {
  if (feedSectionObserver) {
    feedSectionObserver.disconnect();
    feedSectionObserver = null;
  }
}

async function ensureFeedSectionObserver() {
  if (!process.client || !isMobileFeedViewport.value) {
    isFeedSectionInView.value = false;
    disconnectFeedSectionObserver();
    return;
  }

  await nextTick();
  const feedSectionEl = feedSectionRef.value;
  if (!feedSectionEl) {
    isFeedSectionInView.value = false;
    disconnectFeedSectionObserver();
    return;
  }

  if (!feedSectionObserver) {
    feedSectionObserver = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        isFeedSectionInView.value = !!first?.isIntersecting;
      },
      {
        root: null,
        rootMargin: '-10% 0px -25% 0px',
        threshold: 0.08,
      }
    );
  }

  feedSectionObserver.disconnect();
  feedSectionObserver.observe(feedSectionEl);
}

async function ensureMobileFeedObserver() {
  if (!process.client || !isMobileFeedViewport.value || !canAutoLoadMoreMobilePosts.value) {
    disconnectMobileFeedObserver();
    return;
  }

  await nextTick();
  const sentinelEl = mobileFeedSentinel.value;
  if (!sentinelEl) return;

  if (!mobileFeedObserver) {
    mobileFeedObserver = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting || mobileFeedAdvanceLocked || !canAutoLoadMoreMobilePosts.value) return;

        mobileFeedAdvanceLocked = true;
        loadMoreMobileFeedPosts();
        nextTick(() => {
          mobileFeedAdvanceLocked = false;
        });
      },
      {
        root: null,
        rootMargin: '140px 0px',
        threshold: 0.05,
      }
    );
  }

  mobileFeedObserver.disconnect();
  mobileFeedObserver.observe(sentinelEl);
}

onMounted(() => {
  if (!process.client) return;

  const hasToken = !!String(authToken.value || legacyToken.value || '').trim();
  if (hasToken && !feedAuthRefreshDone.value) {
    feedAuthRefreshDone.value = true;
    refreshPublicationDocs().catch(() => {
      // Keep current payload if auth-aware refresh fails.
    });
  }

  mobileFeedMediaQuery = window.matchMedia('(max-width: 767px)');
  isMobileFeedViewport.value = mobileFeedMediaQuery.matches;
  if (mobileFeedMediaQuery.matches) {
    mobileFeedVisibleCount.value = Math.min(MOBILE_INITIAL_FEED_LIMIT, maxFeedCards.value);
  }
  mobileFeedMediaQuery.addEventListener('change', onMobileFeedMediaChange);
  window.addEventListener('scroll', maybeLoadMoreMobileFeedByScroll, { passive: true });
  ensureMobileFeedObserver();
  ensureFeedSectionObserver();
});

onBeforeUnmount(() => {
  if (mobileFeedMediaQuery) {
    mobileFeedMediaQuery.removeEventListener('change', onMobileFeedMediaChange);
    mobileFeedMediaQuery = null;
  }
  window.removeEventListener('scroll', maybeLoadMoreMobileFeedByScroll);
  disconnectMobileFeedObserver();
  disconnectFeedSectionObserver();
});

watch([isMobileFeedViewport, maxVisibleFeedCards, () => visibleArticleFeedPosts.value.length], () => {
  ensureMobileFeedObserver();
  maybeLoadMoreMobileFeedByScroll();
});

watch([isMobileFeedViewport, () => visibleArticleFeedPosts.value.length], () => {
  ensureFeedSectionObserver();
});

watch([articlesSearch, selectedArticleTag], () => {
  if (!isMobileFeedViewport.value) return;
  mobileFeedVisibleCount.value = Math.min(MOBILE_INITIAL_FEED_LIMIT, maxFeedCards.value);
});

useHead({
  title: 'Feed',
});

</script>

<template>
  <div class="min-h-screen bg-white dark:bg-gray-900 flex flex-col">
    <div class="flex-1">
      <div ref="feedSectionRef" class="mx-auto w-full max-w-[1180px] px-3 md:px-6 py-5 md:py-8 text-gray-700 dark:text-gray-300">
      <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 md:gap-8 items-start">
        <section v-if="localizedVisibleArticleFeedPosts.length > 0">
          <div class="mb-5 flex items-center gap-2">
            <UIcon name="lucide:newspaper" class="h-5 w-5 text-blue-600 dark:text-blue-300" />
            <h1 class="text-xl font-semibold text-gray-900 dark:text-gray-100">{{ t('app.feed') || 'Feed' }}</h1>
          </div>

          <HomePostsFeed :posts="localizedVisibleArticleFeedPosts" @open="handleOpenPost" />

          <div
            v-if="isMobileFeedViewport && canAutoLoadMoreMobilePosts"
            ref="mobileFeedSentinel"
            class="h-px w-full"
            aria-hidden="true"
          />
        </section>

        <FeedSidebarWidget
          :articles-search="articlesSearch"
          :selected-tag="selectedArticleTag"
          :popular-tags="popularArticleTags"
          :whats-new-posts="whatsNewSidebarPosts"
          :is-mobile-viewport="isMobileFeedViewport"
          :is-feed-section-in-view="isFeedSectionInView"
          @update:articles-search="articlesSearch = $event"
          @update:selected-tag="selectedArticleTag = $event"
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

<style scoped>
.mobile-sheet-enter-active,
.mobile-sheet-leave-active {
  transition: all 0.2s ease;
}

.mobile-sheet-enter-from,
.mobile-sheet-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>
