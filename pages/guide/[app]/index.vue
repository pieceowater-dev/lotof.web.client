<template>
  <div v-if="!app" class="mx-auto max-w-2xl px-4 py-24 text-center">
    <p class="text-gray-500">{{ t('guide.notFound') }}</p>
    <NuxtLink to="/guide" class="mt-3 inline-block text-primary hover:underline">{{ t('guide.title') }}</NuxtLink>
  </div>
  <div v-else class="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10 lg:px-8">
    <div class="lg:grid lg:grid-cols-[14.5rem_minmax(0,1fr)] lg:gap-10">
      <aside class="lg:sticky lg:top-4 lg:self-start">
        <GuideProductNav :current="appParam" />
      </aside>

      <main class="mt-5 min-w-0 lg:mt-0">
        <!-- header: product-coloured panel -->
        <div v-reveal class="bezel">
          <div class="bezel-core relative overflow-hidden p-6 text-white sm:p-8" :style="entry ? guideGradientStyle(entry.gradient) : undefined">
            <UIcon :name="entry?.icon || 'lucide:help-circle'" class="pointer-events-none absolute -bottom-10 -right-8 h-52 w-52" style="opacity: 0.16; transform: rotate(-12deg)" />
            <div class="relative flex flex-col gap-5 sm:flex-row sm:items-center">
              <span class="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-[22%]" style="background: rgba(255, 255, 255, 0.2); box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.4)">
                <UIcon :name="entry?.icon || 'lucide:help-circle'" class="h-8 w-8" />
              </span>
              <div class="min-w-0">
                <span class="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]" style="background: rgba(255, 255, 255, 0.18)">
                  <UIcon name="lucide:book-open" class="h-3.5 w-3.5" />lota {{ t('guide.title') }}
                </span>
                <h1 class="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">{{ resolvedAppLabel }}</h1>
                <p v-if="entry?.description" class="mt-1.5 max-w-xl text-sm leading-6 sm:text-base" style="opacity: 0.92">{{ entry.description }}</p>
                <p v-if="!loading" class="mt-3 text-xs font-medium" style="opacity: 0.8">{{ articleCount(totalCount) }}</p>
              </div>
            </div>
          </div>
        </div>

        <div v-if="loading" class="py-12 text-center text-sm text-gray-400">{{ t('app.loading') }}</div>

        <div v-else class="mt-8 space-y-8">
          <section v-for="(group, gi) in groups" :key="group.key" v-reveal="gi * 60">
            <h2 class="mb-3 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
              <UIcon v-if="group.icon" :name="group.icon" class="h-3.5 w-3.5" />
              {{ group.title }}
              <span class="font-medium normal-case tracking-normal text-gray-400 dark:text-gray-500">{{ group.articles.length }}</span>
            </h2>
            <div class="bezel">
              <ul class="bezel-core space-y-1 p-2">
                <li v-for="article in group.articles" :key="article.id">
                  <NuxtLink :to="`/guide/${appParam}/${article.slug}`" class="guide-row group">
                    <span class="guide-row-icon"><UIcon name="lucide:file-text" class="h-4 w-4" /></span>
                    <span class="min-w-0 flex-1">
                      <span class="block text-sm font-semibold text-gray-900 dark:text-gray-100">{{ localeTitle(article) }}</span>
                      <span v-if="localeExcerpt(article)" class="mt-0.5 line-clamp-2 block text-xs leading-5 text-gray-500 dark:text-gray-400">{{ localeExcerpt(article) }}</span>
                    </span>
                    <UIcon name="lucide:arrow-up-right" class="h-4 w-4 flex-shrink-0 text-gray-300 transition-all duration-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-blue-500 dark:text-gray-600" />
                  </NuxtLink>
                </li>
              </ul>
            </div>
          </section>
          <p v-if="!groups.length" class="py-8 text-center text-sm text-gray-400">{{ t('guide.noArticles') }}</p>
        </div>

        <div class="mt-10">
          <GuideContactBar variant="card" />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'full' });

import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import { guideAppFromParam } from '@/composables/useGuideContext';
import { useGuideApps, guideGradientStyle } from '@/composables/useGuideApps';
import { guideListArticles, guideListCategories } from '@/api/guide/public';
import type { GuideArticleListItem, GuideCategory } from '@/api/guide/public';

const route = useRoute();
const { t } = useI18n();

const appParam = computed(() => String(route.params.app || '').toLowerCase());
const app = computed(() => guideAppFromParam(appParam.value));

const { entryByParam, field, articleCount } = useGuideApps();
const entry = computed(() => entryByParam(appParam.value));
const resolvedAppLabel = computed(() => entry.value?.label || t('guide.appGlobal'));

const config = useRuntimeConfig();
const siteUrl = String(config.public.siteUrl || DEFAULT_SITE_URL).replace(/\/$/, '');
const pageTitle = computed(() => app.value ? `${resolvedAppLabel.value} — lota Гид` : 'lota Гид');
const pageDescription = computed(() => app.value
  ? `Инструкции и ответы на вопросы по ${resolvedAppLabel.value} в lota.`
  : (t('guide.homeTagline') || 'Ответы на вопросы и инструкции по каждому продукту lota.'));

useSeoMeta({
  title: () => pageTitle.value,
  description: () => pageDescription.value,
  ogTitle: () => pageTitle.value,
  ogDescription: () => pageDescription.value,
  ogType: 'website',
  ogUrl: () => `${siteUrl}/guide/${appParam.value}`,
  ogImage: `${siteUrl}/og-image.png`,
  twitterCard: 'summary_large_image',
});

useHead(() => ({
  link: app.value ? [{ rel: 'canonical', href: `${siteUrl}/guide/${appParam.value}` }] : [],
  // An unknown app param renders a "not found" placeholder, not real
  // content -- indexing that page would be a soft-404.
  meta: !app.value ? [{ name: 'robots', content: 'noindex, follow' }] : [],
}));

// B1: useAsyncData (not onMounted) so the server actually renders the
// article list instead of an empty shell, and the SSR result rides the
// Nuxt payload instead of hydration silently re-fetching it (same
// pattern as pages/guide/[app]/[slug].vue). Static key is correct: this
// page component is reused across app-to-app navigation, so `watch:
// [appParam]` is what triggers the refetch, not the key.
const { data: guideData, pending: loading } = await useAsyncData(
  'guide-categories-articles',
  async () => {
    if (!app.value) return { categories: [] as GuideCategory[], articles: [] as GuideArticleListItem[] };
    try {
      const [cats, arts] = await Promise.all([
        guideListCategories(app.value),
        guideListArticles(app.value),
      ]);
      return { categories: cats, articles: arts };
    } catch {
      // A backend hiccup should render the existing "no articles" empty state,
      // not crash SSR to a 500 -- a page that's supposed to be in the sitemap
      // must never hard-fail just because the upstream gateway blipped.
      return { categories: [] as GuideCategory[], articles: [] as GuideArticleListItem[] };
    }
  },
  { watch: [appParam] },
);
const categories = computed(() => guideData.value?.categories ?? []);
const articles = computed(() => guideData.value?.articles ?? []);
const totalCount = computed(() => articles.value.length);

const localeTitle = (article: GuideArticleListItem) => field(article, 'title') || article.slug;
const localeExcerpt = (article: GuideArticleListItem) => field(article, 'excerpt');
const localeName = (category: GuideCategory) => field(category, 'name') || category.slug;

type Group = { key: string; title: string; icon: string; articles: GuideArticleListItem[] };

const groups = computed<Group[]>(() => {
  const byCategory = new Map<string, GuideArticleListItem[]>();
  for (const a of articles.value) {
    const key = a.categoryId || '';
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key)!.push(a);
  }

  const sortedCategories = [...categories.value].sort((a, b) => a.sortOrder - b.sortOrder);
  const result: Group[] = [];
  for (const c of sortedCategories) {
    const items = byCategory.get(c.id);
    if (items?.length) result.push({ key: c.id, title: localeName(c), icon: c.icon, articles: items });
  }
  const uncategorized = byCategory.get('');
  if (uncategorized?.length) {
    result.push({ key: 'uncategorized', title: t('guide.uncategorized'), icon: '', articles: uncategorized });
  }
  return result;
});

</script>

<style scoped>
.guide-row {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  border-radius: 1.4rem;
  padding: 0.8rem 1rem 0.8rem 0.8rem;
  transition: background 0.4s cubic-bezier(0.32, 0.72, 0, 1), transform 0.5s cubic-bezier(0.32, 0.72, 0, 1);
}
.guide-row:hover { background: rgba(37, 99, 235, 0.07); transform: translateX(3px); }
.guide-row-icon { display: flex; height: 2.25rem; width: 2.25rem; flex-shrink: 0; align-items: center; justify-content: center; border-radius: 0.8rem; color: #2563eb; background: rgba(37, 99, 235, 0.08); }
.dark .guide-row:hover { background: rgba(255, 255, 255, 0.07); }
.dark .guide-row-icon { color: #93c5fd; background: rgba(255, 255, 255, 0.07); }
</style>
