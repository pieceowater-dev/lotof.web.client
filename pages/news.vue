<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import type { HomeFeedPost } from '@/components/HomePostsFeed.vue';

const { t, locale } = useI18n();

type ProcessedMarkdownPost = HomeFeedPost & {
  categorySlug: string;
  dateISO: string;
};

const mdFiles = import.meta.glob('../public/content/publications/news/**/*.md', {
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

  const intlLocale = locale.value === 'ru'
    ? 'ru-RU'
    : locale.value === 'kk'
      ? 'kk-KZ'
      : 'en-GB';

  return dt.toLocaleDateString(intlLocale, { day: '2-digit', month: 'short', year: 'numeric' });
}

function processNewsPosts(): ProcessedMarkdownPost[] {
  const posts: ProcessedMarkdownPost[] = [];

  for (const [, raw] of Object.entries(mdFiles)) {
    const { meta, body } = parseFrontMatter(raw);
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
      href: `/news/${slug}`,
      category: t('app.news') || 'News',
      categorySlug: 'news',
      title,
      excerpt: String(meta.description || '').trim() || excerptFromBody(body),
      preview: String(meta.description || '').trim() ? excerptFromBody(body) : '',
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

const allNewsPosts = computed(() => processNewsPosts());

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
const newsImagesBroken = ref<Record<string, boolean>>({});

function handleNewsImageError(postId: string) {
  newsImagesBroken.value[postId] = true;
}

const visibleNewsPosts = computed(() => filteredNewsPosts.value.slice(0, visibleCount.value));
const canLoadMore = computed(() => visibleNewsPosts.value.length < filteredNewsPosts.value.length);

const sentinelRef = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;
let loadLocked = false;

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
  setupObserver();
});

onBeforeUnmount(() => {
  observer?.disconnect();
  observer = null;
});

watch([canLoadMore, () => visibleNewsPosts.value.length], () => {
  setupObserver();
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

watch(
  () => allNewsPosts.value.length,
  (count) => {
    if (count === 0 && process.client) {
      navigateTo('/');
    }
  },
  { immediate: true }
);
</script>

<template>
  <div class="min-h-screen bg-white dark:bg-gray-900 flex flex-col">
    <div class="flex-1">
      <div class="mx-auto w-full max-w-[1180px] px-3 md:px-6 py-5 md:py-8 text-gray-700 dark:text-gray-300">
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

          <!-- Sidebar -->
          <aside class="hidden lg:block lg:sticky lg:top-3 self-start">
            <div class="rounded-3xl border border-blue-100/80 bg-white/90 p-4 shadow-sm backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800/90">
              <div class="relative mb-4">
                <UIcon name="lucide:search" class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  v-model="newsSearch"
                  type="text"
                  :placeholder="t('app.searchArticles') || 'Поиск новостей'"
                  class="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-800 outline-none transition focus:border-blue-300 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                />
              </div>

              <div v-if="popularNewsTags.length">
                <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {{ t('app.popularTags') || 'Популярные теги' }}
                </p>
                <div class="flex flex-wrap gap-2">
                  <button
                    type="button"
                    class="rounded-lg border px-2 py-1 text-xs transition"
                    :class="selectedNewsTag === ''
                      ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-blue-200 dark:border-gray-600 dark:bg-gray-700/60 dark:text-gray-200'"
                    @click="selectedNewsTag = ''"
                  >
                    {{ t('app.all') || 'Все' }}
                  </button>
                  <button
                    v-for="tag in popularNewsTags"
                    :key="tag"
                    type="button"
                    class="rounded-lg border px-2 py-1 text-xs transition"
                    :class="selectedNewsTag === tag
                      ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-blue-200 dark:border-gray-600 dark:bg-gray-700/60 dark:text-gray-200'"
                    @click="selectedNewsTag = tag"
                  >
                    #{{ tag }}
                  </button>
                </div>
              </div>

              <div class="mt-5 pt-5 border-t border-gray-100 dark:border-gray-700">
                <div class="space-y-2">
                  <NuxtLink
                    to="/feed"
                    class="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <UIcon name="lucide:newspaper" class="h-4 w-4" />
                    {{ t('app.feed') || 'Блог / Статьи' }}
                  </NuxtLink>
                  <NuxtLink
                    to="/feed"
                    class="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    <UIcon name="lucide:sparkles" class="h-4 w-4" />
                    {{ t('app.whatsNew') || 'Что нового' }}
                  </NuxtLink>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>

    <div class="m-4 mt-auto">
      <AppFooter />
    </div>
  </div>
</template>
