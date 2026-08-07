<template>
  <USlideover v-model="isOpen" :ui="{ width: 'w-screen max-w-full sm:max-w-md' }">
    <div class="flex h-full flex-col bg-white dark:bg-gray-900">
      <div class="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
        <div class="flex items-center gap-2">
          <picture>
            <source srcset="/assets/logo.webp" type="image/webp">
            <img
              src="/assets/logo.png"
              alt="lota"
              width="20"
              height="20"
              class="h-5 w-5"
            >
          </picture>
          <h2 class="text-base font-semibold text-gray-900 dark:text-white">lota {{ t('guide.title') }}</h2>
        </div>
        <UButton variant="ghost" size="sm" icon="lucide:x" :aria-label="t('app.cancel')" @click="isOpen = false" />
      </div>

      <div class="flex-1 overflow-y-auto px-5 py-4 space-y-6">
        <UButton
          v-if="currentTour"
          block
          size="lg"
          icon="lucide:play-circle"
          @click="startCurrentTour"
        >
          {{ t('guide.startTour') }} — {{ currentAppName }}
        </UButton>

        <div v-if="faqItems.length">
          <h3 class="mb-2 text-sm font-semibold text-gray-500 dark:text-gray-400">{{ t('guide.faqTitle') }}</h3>
          <UAccordion :items="faqAccordionItems" multiple>
            <template #item="{ item }">
              <div class="prose prose-sm dark:prose-invert max-w-none px-1 pb-3" v-html="item.contentHtml" />
            </template>
          </UAccordion>
        </div>

        <div>
          <div class="mb-2 flex items-center gap-2">
            <UButton
              v-if="navStack.length > 1"
              variant="ghost"
              size="xs"
              icon="lucide:arrow-left"
              @click="goBack"
            />
            <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400">{{ navTitle }}</h3>
          </div>

          <!-- Level: apps -->
          <div v-if="level.type === 'apps'" class="space-y-1">
            <button
              v-for="app in browsableApps"
              :key="app.id"
              type="button"
              class="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm"
              :class="app.isCurrent
                ? 'bg-primary-50 dark:bg-primary-900/20'
                : 'hover:bg-gray-50 dark:hover:bg-gray-800'"
              @click="openCategories(app)"
            >
              <span
                class="flex items-center gap-2 font-medium"
                :class="app.isCurrent ? 'text-primary' : 'text-gray-800 dark:text-gray-100'"
              >
                <UIcon :name="app.icon" class="h-4 w-4 text-primary" />
                {{ app.label }}
                <span
                  v-if="app.isCurrent"
                  class="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary dark:bg-primary-900/40"
                >
                  {{ t('guide.currentApp') }}
                </span>
              </span>
              <UIcon name="lucide:chevron-right" class="h-4 w-4 text-gray-400" />
            </button>
          </div>

          <!-- Level: categories -->
          <div v-else-if="level.type === 'categories'">
            <div v-if="categoriesLoading" class="py-4 text-sm text-gray-400">{{ t('app.loading') }}</div>
            <div v-else class="space-y-1">
              <button
                type="button"
                class="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                @click="openArticles(level, null)"
              >
                <span class="font-medium text-gray-800 dark:text-gray-100">{{ t('guide.allArticles') }}</span>
                <UIcon name="lucide:chevron-right" class="h-4 w-4 text-gray-400" />
              </button>
              <button
                v-for="row in categoryRows"
                :key="row.category.id"
                type="button"
                class="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                :style="{ paddingLeft: `${0.75 + row.depth * 1}rem` }"
                @click="openArticles(level, row.category)"
              >
                <span class="text-gray-800 dark:text-gray-100">{{ localeName(row.category) }}</span>
                <UIcon name="lucide:chevron-right" class="h-4 w-4 text-gray-400" />
              </button>
              <p v-if="!categoryRows.length" class="px-3 py-2 text-sm text-gray-400">{{ t('guide.noCategories') }}</p>
            </div>
          </div>

          <!-- Level: articles -->
          <div v-else-if="level.type === 'articles'">
            <div v-if="articlesLoading" class="py-4 text-sm text-gray-400">{{ t('app.loading') }}</div>
            <div v-else class="space-y-1">
              <button
                v-for="article in currentArticles"
                :key="article.id"
                type="button"
                class="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                @click="openArticle(level, article)"
              >
                <span class="text-gray-800 dark:text-gray-100">{{ localeTitle(article) }}</span>
                <UIcon name="lucide:chevron-right" class="h-4 w-4 text-gray-400" />
              </button>
              <p v-if="!currentArticles.length" class="px-3 py-2 text-sm text-gray-400">{{ t('guide.noArticles') }}</p>
            </div>
          </div>

          <!-- Level: article -->
          <div v-else-if="level.type === 'article'">
            <div v-if="articleLoading" class="py-4 text-sm text-gray-400">{{ t('app.loading') }}</div>
            <template v-else-if="currentArticle">
              <h4 class="mb-2 text-base font-semibold text-gray-900 dark:text-white">{{ localeTitle(currentArticle) }}</h4>
              <div class="prose prose-sm dark:prose-invert max-w-none" v-html="localeContentHtml(currentArticle)" />
              <NuxtLink
                :to="`/guide/${level.app.toLowerCase()}/${currentArticle.slug}`"
                target="_blank"
                class="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                {{ t('guide.openFullPage') }}
                <UIcon name="lucide:arrow-up-right" class="h-3.5 w-3.5" />
              </NuxtLink>
            </template>
          </div>
        </div>
      </div>

      <div class="border-t border-gray-100 px-5 py-4 dark:border-gray-800">
        <NuxtLink
          :to="`/guide/${currentGuideApp.toLowerCase()}`"
          class="flex items-center justify-between rounded-lg bg-primary-50 px-3 py-2.5 text-sm font-medium text-primary hover:bg-primary-100 dark:bg-primary-900/20 dark:hover:bg-primary-900/30"
          @click="isOpen = false"
        >
          {{ t('guide.openGuideFor') }} {{ currentAppName || appLabel(currentGuideApp) }}
          <UIcon name="lucide:arrow-up-right" class="h-4 w-4" />
        </NuxtLink>
      </div>

      <GuideContactBar />
    </div>
  </USlideover>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useOnboarding } from '@/composables/useOnboarding';
import { GUIDE_APP_BY_ID, GUIDE_APP_IDS, useGuideContext } from '@/composables/useGuideContext';
import { ALL_APPS } from '@/config/apps';
import { renderMarkdownSafe } from '@/utils/renderMarkdown';
import { guideGetArticleBySlug, guideListArticles, guideListCategories } from '@/api/guide/public';
import type { GuideApp, GuideArticle, GuideArticleListItem, GuideCategory } from '@/api/guide/public';

const isOpen = defineModel<boolean>({ default: false });

const { t, locale } = useI18n();
const { currentTour, currentAppName, currentGuideApp } = useGuideContext();
const { startTour, reset } = useOnboarding();

function localeSuffix(): 'Ru' | 'Kk' | 'En' {
  if (locale.value === 'kk') return 'Kk';
  if (locale.value === 'en') return 'En';
  return 'Ru';
}

function localeName(category: GuideCategory): string {
  const suffix = localeSuffix();
  return (category[`name${suffix}` as 'nameRu'] || category.nameRu || category.slug) as string;
}

function localeTitle(article: GuideArticleListItem): string {
  const suffix = localeSuffix();
  return (article[`title${suffix}` as 'titleRu'] || article.titleRu || article.slug) as string;
}

function localeExcerpt(article: GuideArticleListItem): string {
  const suffix = localeSuffix();
  return (article[`excerpt${suffix}` as 'excerptRu'] || article.excerptRu || '') as string;
}

function localeContentHtml(article: GuideArticle): string {
  const suffix = localeSuffix();
  const raw = (article[`content${suffix}` as 'contentRu'] || article.contentRu || '') as string;
  return renderMarkdownSafe(raw);
}

function appLabel(app: GuideApp): string {
  switch (app) {
    case 'ISSUES': return t('app.tasks');
    case 'MENU': return t('app.menu');
    case 'CONTACTS': return t('app.clients');
    case 'ATRACE': return t('app.attendance');
    case 'LANDING': return t('guide.appLanding');
    default: return t('guide.appGlobal');
  }
}

const browsableApps = computed(() => GUIDE_APP_IDS.map((id) => {
  const app = ALL_APPS.find((a) => a.address === id);
  return {
    id,
    guideApp: GUIDE_APP_BY_ID[id],
    label: app ? t(app.titleKey) : id,
    icon: app?.icon || 'lucide:layout-grid',
    isCurrent: GUIDE_APP_BY_ID[id] === currentGuideApp.value,
  };
}));

function startCurrentTour() {
  if (!currentTour.value) return;
  reset(currentTour.value.id);
  startTour(currentTour.value, 0);
  isOpen.value = false;
}

// -- FAQ --------------------------------------------------------------

const faqItems = ref<GuideArticleListItem[]>([]);
const faqContentCache = ref<Record<string, string>>({});

async function loadFaq() {
  faqItems.value = [];
  try {
    let items = await guideListArticles(currentGuideApp.value, { onlyFaq: true });
    if (items.length < 5 && currentGuideApp.value !== 'GLOBAL') {
      const globalItems = await guideListArticles('GLOBAL', { onlyFaq: true });
      items = [...items, ...globalItems];
    }
    faqItems.value = items.slice(0, 5);

    const entries = await Promise.all(faqItems.value.map(async (item) => {
      const full = await guideGetArticleBySlug(item.app, item.slug).catch(() => null);
      return [item.id, full ? localeContentHtml(full) : localeExcerpt(item)] as const;
    }));
    faqContentCache.value = Object.fromEntries(entries);
  } catch {
    faqItems.value = [];
  }
}

const faqAccordionItems = computed(() => faqItems.value.map((item) => ({
  label: localeTitle(item),
  contentHtml: faqContentCache.value[item.id] || localeExcerpt(item),
})));

// -- Drill-down navigator ----------------------------------------------

type NavLevel =
  | { type: 'apps' }
  | { type: 'categories'; app: GuideApp; label: string }
  | { type: 'articles'; app: GuideApp; label: string; category: GuideCategory | null }
  | { type: 'article'; app: GuideApp; label: string; article: GuideArticleListItem };

const navStack = ref<NavLevel[]>([{ type: 'apps' }]);
const level = computed(() => navStack.value[navStack.value.length - 1]);

const navTitle = computed(() => {
  const l = level.value;
  if (l.type === 'apps') return t('guide.browseTitle');
  if (l.type === 'categories') return l.label;
  if (l.type === 'articles') return l.label;
  if (l.type === 'article') return l.label;
  return '';
});

function goBack() {
  if (navStack.value.length > 1) navStack.value.pop();
}

const categories = ref<GuideCategory[]>([]);
const categoriesLoading = ref(false);

type CategoryRow = { category: GuideCategory; depth: number };
const categoryRows = computed<CategoryRow[]>(() => {
  const byParent = new Map<string, GuideCategory[]>();
  for (const c of categories.value) {
    const key = c.parentId || '';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(c);
  }
  for (const list of byParent.values()) list.sort((a, b) => a.sortOrder - b.sortOrder);

  const rows: CategoryRow[] = [];
  function walk(parentKey: string, depth: number) {
    for (const c of byParent.get(parentKey) || []) {
      rows.push({ category: c, depth });
      walk(c.id, depth + 1);
    }
  }
  walk('', 0);
  return rows;
});

async function openCategories(app: { guideApp: GuideApp; label: string }) {
  navStack.value.push({ type: 'categories', app: app.guideApp, label: app.label });
  categoriesLoading.value = true;
  try {
    categories.value = await guideListCategories(app.guideApp);
  } catch {
    categories.value = [];
  } finally {
    categoriesLoading.value = false;
  }
}

const currentArticles = ref<GuideArticleListItem[]>([]);
const articlesLoading = ref(false);

async function openArticles(parentLevel: Extract<NavLevel, { type: 'categories' }>, category: GuideCategory | null) {
  navStack.value.push({
    type: 'articles',
    app: parentLevel.app,
    label: category ? localeName(category) : t('guide.allArticles'),
    category,
  });
  articlesLoading.value = true;
  try {
    currentArticles.value = await guideListArticles(parentLevel.app, { categoryId: category?.id });
  } catch {
    currentArticles.value = [];
  } finally {
    articlesLoading.value = false;
  }
}

const currentArticle = ref<GuideArticle | null>(null);
const articleLoading = ref(false);

async function openArticle(parentLevel: Extract<NavLevel, { type: 'articles' }>, article: GuideArticleListItem) {
  navStack.value.push({ type: 'article', app: parentLevel.app, label: localeTitle(article), article });
  articleLoading.value = true;
  currentArticle.value = null;
  try {
    currentArticle.value = await guideGetArticleBySlug(parentLevel.app, article.slug);
  } finally {
    articleLoading.value = false;
  }
}

watch(isOpen, (open) => {
  if (!open) return;
  navStack.value = [{ type: 'apps' }];
  loadFaq();
}, { immediate: true });
</script>
