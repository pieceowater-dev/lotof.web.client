<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import type { HomeFeedPost } from '@/components/HomePostsFeed.vue';

const { t } = useI18n();

type ProcessedMarkdownPost = HomeFeedPost & {
  categorySlug: string;
  dateISO: string;
};

const mdFiles = import.meta.glob('../public/content/publications/**/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

function parseFrontMatter(raw: string): { meta: Record<string, string | string[]>; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };

  const metaLines = match[1].split('\n');
  const body = match[2] || '';
  const meta: Record<string, string | string[]> = {};

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
  const match = markdown.match(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/);
  if (!match) return null;
  return { src: match[2], alt: match[1] || '' };
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
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function processMarkdownPosts(): ProcessedMarkdownPost[] {
  const posts: ProcessedMarkdownPost[] = [];

  for (const [, raw] of Object.entries(mdFiles)) {
    const { meta, body } = parseFrontMatter(raw);
    const categorySlug = String(meta.category || '').toLowerCase();
    const slug = String(meta.slug || '').trim();
    const title = String(meta.title || '').trim();
    const dateISO = String(meta.date || '').trim();

    if (!slug || !title || !dateISO) continue;

    const imgFromBody = firstImage(body);
    const image = String(meta.og_image || imgFromBody?.src || '/og-image.png');
    const imageAlt = imgFromBody?.alt || title;
    const tags = Array.isArray(meta.tags) ? meta.tags : [];
    const author = String(meta.author || 'Lota Team');

    posts.push({
      id: slug,
      href: `/${slug}`,
      category: categorySlug === 'whatsnew' ? "What's New" : 'Articles',
      categorySlug,
      title,
      excerpt: excerptFromBody(body),
      author,
      publishedAt: formatDate(dateISO),
      dateISO,
      readTime: readTimeLabel(body),
      image,
      imageAlt,
      tags,
    });
  }

  return posts.sort((a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime());
}

const allProcessedPosts = computed(() => processMarkdownPosts());
const articleFeedPosts = computed(() => allProcessedPosts.value.filter((post) => post.categorySlug === 'articles'));
const allWhatsNewPosts = computed(() => allProcessedPosts.value.filter((post) => post.categorySlug === 'whatsnew'));
const whatsNewSidebarPosts = computed(() => allWhatsNewPosts.value.slice(0, 3));

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
const mobileSidebarMenuOpen = ref(false);

const maxFeedCards = computed(() => Math.min(DESKTOP_FEED_LIMIT, filteredArticleFeedPosts.value.length));
const maxVisibleFeedCards = computed(() => maxFeedCards.value);

const visibleArticleFeedPosts = computed(() => {
  if (!isMobileFeedViewport.value) {
    return filteredArticleFeedPosts.value.slice(0, maxVisibleFeedCards.value);
  }
  const limit = Math.min(maxVisibleFeedCards.value, mobileFeedVisibleCount.value);
  return filteredArticleFeedPosts.value.slice(0, limit);
});

const localizedVisibleArticleFeedPosts = computed(() => {
  const articleLabel = t('app.articles') || 'Articles';
  return visibleArticleFeedPosts.value.map((post) => ({
    ...post,
    category: articleLabel,
  }));
});

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

watch([isMobileFeedViewport, isFeedSectionInView], ([isMobile, inView]) => {
  if (!isMobile || !inView) mobileSidebarMenuOpen.value = false;
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
  <div class="min-h-screen bg-white dark:bg-gray-900">
    <div ref="feedSectionRef" class="mx-auto w-full max-w-[1180px] px-3 md:px-6 py-5 md:py-8 text-gray-700 dark:text-gray-300">
      <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 md:gap-8 items-start">
        <section>
          <div class="mb-5 flex items-center gap-2">
            <UIcon name="lucide:newspaper" class="h-5 w-5 text-blue-600 dark:text-blue-300" />
            <h1 class="text-xl font-semibold text-gray-900 dark:text-gray-100">{{ t('app.feed') || 'Feed' }}</h1>
          </div>

          <div v-if="localizedVisibleArticleFeedPosts.length === 0" class="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center dark:border-gray-700 dark:bg-gray-800">
            <p class="text-gray-600 dark:text-gray-400">{{ t('app.noArticlesYet') || 'Пока пусто' }}</p>
          </div>
          <HomePostsFeed v-else :posts="localizedVisibleArticleFeedPosts" @open="handleOpenPost" />

          <div
            v-if="isMobileFeedViewport && canAutoLoadMoreMobilePosts"
            ref="mobileFeedSentinel"
            class="h-px w-full"
            aria-hidden="true"
          />
        </section>

        <aside class="hidden lg:block lg:sticky lg:top-3 self-start flex flex-col h-[calc(100vh-2rem)]">
          <div class="mb-6 rounded-3xl border border-blue-100/80 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
            <div class="relative">
              <UIcon
                name="lucide:search"
                class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              />
              <input
                v-model="articlesSearch"
                type="text"
                :placeholder="t('app.searchArticles') || 'Search articles'"
                class="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-800 outline-none transition focus:border-emerald-300 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              />
            </div>

            <div v-if="popularArticleTags.length" class="mt-3">
              <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t('app.popularTags') || 'Popular tags' }}</p>
              <div class="flex flex-wrap gap-2">
                <button
                  type="button"
                  class="rounded-lg border px-2 py-1 text-xs transition"
                  :class="selectedArticleTag === ''
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                    : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-emerald-200 dark:border-gray-600 dark:bg-gray-700/60 dark:text-gray-200'"
                  @click="selectedArticleTag = ''"
                >
                  {{ t('app.all') || 'All' }}
                </button>
                <button
                  v-for="tag in popularArticleTags"
                  :key="tag"
                  type="button"
                  class="rounded-lg border px-2 py-1 text-xs transition"
                  :class="selectedArticleTag === tag
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                    : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-emerald-200 dark:border-gray-600 dark:bg-gray-700/60 dark:text-gray-200'"
                  @click="selectedArticleTag = tag"
                >
                  #{{ tag }}
                </button>
              </div>
            </div>
          </div>

          <div class="flex flex-col flex-1 rounded-3xl border border-blue-100/80 bg-gradient-to-br from-white to-blue-50/40 p-5 shadow-sm dark:border-gray-700 dark:bg-gradient-to-br dark:from-gray-800 dark:to-gray-800/70 overflow-hidden">
            <div class="mb-4 flex items-center gap-2">
              <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <UIcon name="lucide:sparkles" class="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
              </div>
              <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">{{ t('app.whatsNew') || "What's New" }}</h3>
            </div>

            <div v-if="whatsNewSidebarPosts.length" class="flex-1 overflow-y-auto space-y-2.5 pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600">
              <button
                v-for="post in whatsNewSidebarPosts"
                :key="post.id"
                type="button"
                class="group w-full text-left rounded-xl border border-gray-150 bg-white p-3 transition-all duration-200 hover:border-emerald-300 hover:shadow-md hover:bg-white dark:border-gray-600 dark:bg-gray-700/40 dark:hover:border-emerald-600 dark:hover:bg-gray-700/60"
                @click="handleOpenPost(post)"
              >
                <div class="flex items-start gap-3">
                  <img
                    :src="post.image"
                    :alt="post.imageAlt"
                    class="h-14 w-14 rounded-lg object-cover ring-1 ring-gray-200 dark:ring-gray-600"
                    loading="lazy"
                  />

                  <div class="min-w-0 flex-1">
                    <p class="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">{{ post.publishedAt }}</p>
                    <p class="mt-1 text-sm font-semibold leading-5 text-gray-900 dark:text-gray-100 line-clamp-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{{ post.title }}</p>
                    <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{{ post.readTime }}</p>
                  </div>
                </div>
              </button>
            </div>

            <p v-else class="text-sm text-gray-500 dark:text-gray-400">
              {{ t('app.noUpdatesForCurrentFilters') || 'No updates for current filters.' }}
            </p>
          </div>
        </aside>
      </div>

      <div
        v-if="isMobileFeedViewport && isFeedSectionInView"
        class="lg:hidden fixed inset-x-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]"
        style="bottom: 0;"
      >
        <div class="mx-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800">
          <button
            type="button"
            class="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
            :aria-expanded="mobileSidebarMenuOpen"
            @click="mobileSidebarMenuOpen = !mobileSidebarMenuOpen"
          >
            <div class="flex items-center gap-2">
              <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <UIcon name="lucide:sparkles" class="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
              </div>
              <span class="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {{ t('app.feedMenu') || 'Feed menu' }}
              </span>
            </div>
            <UIcon
              name="lucide:chevron-up"
              class="h-4 w-4 text-gray-400 transition-transform dark:text-gray-500"
              :class="mobileSidebarMenuOpen ? 'rotate-180' : ''"
            />
          </button>

          <Transition name="mobile-sheet">
            <div v-if="mobileSidebarMenuOpen" class="space-y-2 border-t border-gray-200 px-4 py-3 dark:border-gray-700">
              <div class="rounded-2xl border border-gray-200 bg-gray-50 p-2.5 dark:border-gray-700 dark:bg-gray-700/40">
                <div class="relative">
                  <UIcon
                    name="lucide:search"
                    class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    v-model="articlesSearch"
                    type="text"
                    :placeholder="t('app.searchArticles') || 'Search articles'"
                    class="w-full rounded-xl border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-800 outline-none transition focus:border-emerald-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  />
                </div>
              </div>

              <div v-if="popularArticleTags.length">
                <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {{ t('app.popularTags') || 'Popular tags' }}
                </p>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    class="rounded-lg border px-2 py-1 text-xs transition"
                    :class="selectedArticleTag === ''
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                      : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-emerald-200 dark:border-gray-600 dark:bg-gray-700/60 dark:text-gray-200'"
                    @click="selectedArticleTag = ''"
                  >
                    {{ t('app.all') || 'All' }}
                  </button>
                  <button
                    v-for="tag in popularArticleTags"
                    :key="tag"
                    type="button"
                    class="rounded-lg border px-2 py-1 text-xs transition"
                    :class="selectedArticleTag === tag
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                      : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-emerald-200 dark:border-gray-600 dark:bg-gray-700/60 dark:text-gray-200'"
                    @click="selectedArticleTag = tag"
                  >
                    #{{ tag }}
                  </button>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>
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
