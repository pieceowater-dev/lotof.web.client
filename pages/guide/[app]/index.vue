<template>
  <div v-if="!app" class="mx-auto max-w-2xl px-4 py-24 text-center">
    <p class="text-gray-500">{{ t('guide.notFound') }}</p>
    <NuxtLink to="/guide" class="mt-3 inline-block text-primary hover:underline">{{ t('guide.title') }}</NuxtLink>
  </div>
  <div v-else class="min-h-screen bg-gray-50 dark:bg-gray-950">
    <div class="border-b border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div class="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <NuxtLink to="/guide" class="mb-5 inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-900 dark:hover:text-white">
          <UIcon name="lucide:arrow-left" class="h-3.5 w-3.5" />
          lota {{ t('guide.title') }}
        </NuxtLink>
        <div class="flex items-center gap-3">
          <span class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary dark:bg-primary-900/20">
            <UIcon :name="resolvedAppIcon" class="h-5 w-5" />
          </span>
          <h1 class="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">{{ resolvedAppLabel }}</h1>
        </div>
      </div>
    </div>

    <div class="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div v-if="loading" class="py-10 text-sm text-gray-400">{{ t('app.loading') }}</div>

      <div v-else class="space-y-8">
        <section v-for="group in groups" :key="group.key">
          <h2 class="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <UIcon v-if="group.icon" :name="group.icon" class="h-3.5 w-3.5" />
            {{ group.title }}
          </h2>
          <div class="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
            <NuxtLink
              v-for="article in group.articles"
              :key="article.id"
              :to="`/guide/${appParam}/${article.slug}`"
              class="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 sm:px-5"
            >
              <span class="min-w-0">
                <span class="block text-sm font-medium text-gray-900 dark:text-gray-100">{{ localeTitle(article) }}</span>
                <span v-if="localeExcerpt(article)" class="mt-0.5 block truncate text-xs text-gray-400 dark:text-gray-500">{{ localeExcerpt(article) }}</span>
              </span>
              <UIcon name="lucide:chevron-right" class="h-4 w-4 flex-shrink-0 text-gray-300 dark:text-gray-600" />
            </NuxtLink>
          </div>
        </section>
        <p v-if="!groups.length" class="text-sm text-gray-400">{{ t('guide.noArticles') }}</p>
      </div>

      <div class="mt-8 overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
        <GuideContactBar variant="card" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import { guideAppFromParam } from '@/composables/useGuideContext';
import { guideListArticles, guideListCategories } from '@/api/guide/public';
import type { GuideArticleListItem, GuideCategory } from '@/api/guide/public';

const route = useRoute();
const { t, locale } = useI18n();

const appParam = computed(() => String(route.params.app || '').toLowerCase());
const app = computed(() => guideAppFromParam(appParam.value));

const resolvedAppLabel = computed(() => {
  switch (app.value) {
    case 'ISSUES': return t('app.tasks');
    case 'MENU': return t('app.menu');
    case 'CONTACTS': return t('app.clients');
    case 'ATRACE': return t('app.attendance');
    case 'LANDING': return t('guide.appLanding');
    default: return t('guide.appGlobal');
  }
});

const resolvedAppIcon = computed(() => {
  switch (app.value) {
    case 'ISSUES': return 'lucide:clipboard-check';
    case 'MENU': return 'lucide:receipt-text';
    case 'CONTACTS': return 'lucide:briefcase';
    case 'ATRACE': return 'lucide:qr-code';
    case 'LANDING': return 'lucide:home';
    default: return 'lucide:help-circle';
  }
});

useHead(() => ({ title: app.value ? `${resolvedAppLabel.value} — lota Гид` : 'lota Гид' }));

const loading = ref(true);
const categories = ref<GuideCategory[]>([]);
const articles = ref<GuideArticleListItem[]>([]);

function localeSuffix(): 'Ru' | 'Kk' | 'En' {
  if (locale.value === 'kk') return 'Kk';
  if (locale.value === 'en') return 'En';
  return 'Ru';
}

function localeTitle(article: GuideArticleListItem): string {
  const suffix = localeSuffix();
  return (article[`title${suffix}` as 'titleRu'] || article.titleRu || article.slug) as string;
}

function localeExcerpt(article: GuideArticleListItem): string {
  const suffix = localeSuffix();
  return (article[`excerpt${suffix}` as 'excerptRu'] || article.excerptRu || '') as string;
}

function localeName(category: GuideCategory): string {
  const suffix = localeSuffix();
  return (category[`name${suffix}` as 'nameRu'] || category.nameRu || category.slug) as string;
}

async function load() {
  if (!app.value) {
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    const [cats, arts] = await Promise.all([
      guideListCategories(app.value),
      guideListArticles(app.value),
    ]);
    categories.value = cats;
    articles.value = arts;
  } finally {
    loading.value = false;
  }
}

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

// Awaited at the top level (not via watch immediate) so Nuxt's automatic
// page-level <Suspense> waits for it during SSR -- otherwise the server
// sends down the loading skeleton and real content only appears after
// client hydration fetches it.
watch(appParam, load);
await load();
</script>
