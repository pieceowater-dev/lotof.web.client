<template>
  <USlideover
    v-model="isOpen"
    :ui="{ width: 'w-screen max-w-full sm:max-w-md', background: 'bg-white dark:bg-[#1a1a1a]', ring: 'ring-1 ring-black/5 dark:ring-white/10', rounded: 'sm:rounded-l-[2rem]', shadow: 'shadow-2xl' }"
  >
    <div class="gw flex h-full flex-col">
      <!-- header -->
      <div class="flex items-center justify-between px-5 pb-3 pt-5">
        <div class="flex items-center gap-2.5">
          <picture>
            <source srcset="/assets/logo.webp" type="image/webp">
            <img src="/assets/logo.png" alt="lota" width="22" height="22" class="h-[22px] w-[22px]">
          </picture>
          <h2 class="text-lg font-extrabold tracking-tight text-gray-900 dark:text-white">lota <span class="grad-text">{{ t('guide.title') }}</span></h2>
        </div>
        <button type="button" class="gw-icon-btn" :aria-label="t('app.cancel')" @click="isOpen = false">
          <UIcon name="lucide:x" class="h-4 w-4" />
        </button>
      </div>

      <div class="flex-1 space-y-6 overflow-y-auto px-5 pb-5 pt-2">
        <!-- tour -->
        <button v-if="currentTour" type="button" class="gw-tour group" @click="startCurrentTour">
          <span class="gw-tour__glow" />
          <span class="relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-white/20 text-white">
            <UIcon name="lucide:play-circle" class="h-6 w-6" />
          </span>
          <span class="relative min-w-0 flex-1 text-left">
            <span class="block text-sm font-bold text-white">{{ t('guide.startTour') }}</span>
            <span class="block truncate text-xs text-white/80">{{ currentAppName }}</span>
          </span>
          <span class="relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/20 text-white transition-transform duration-500 group-hover:translate-x-0.5">
            <UIcon name="lucide:arrow-right" class="h-4 w-4" />
          </span>
        </button>

        <!-- faq -->
        <div v-if="faqItems.length">
          <h3 class="sf-label mb-2.5 px-1">{{ t('guide.faqTitle') }}</h3>
          <div class="gw-card gw-faq p-1.5">
            <UAccordion :items="faqAccordionItems" multiple>
              <template #item="{ item }">
                <div class="gw-prose px-3 pb-3" v-html="item.contentHtml" />
              </template>
            </UAccordion>
          </div>
        </div>

        <!-- browse -->
        <div>
          <div class="mb-2.5 flex items-center gap-2 px-1">
            <button v-if="navStack.length > 1" type="button" class="gw-icon-btn !h-7 !w-7" :aria-label="t('common.back') || 'Back'" @click="goBack">
              <UIcon name="lucide:arrow-left" class="h-3.5 w-3.5" />
            </button>
            <h3 class="sf-label truncate">{{ navTitle }}</h3>
          </div>

          <!-- Level: apps -->
          <div v-if="level.type === 'apps'" class="gw-card p-1.5">
            <button
              v-for="app in browsableApps"
              :key="app.id"
              type="button"
              class="gw-row"
              :class="app.isCurrent ? 'gw-row--current' : ''"
              @click="openCategories(app)"
            >
              <GuideAppIcon :icon="app.icon" :gradient="app.gradient" size="sm" />
              <span class="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{{ app.label }}</span>
              <span v-if="app.isCurrent" class="gw-here">{{ t('guide.currentApp') }}</span>
              <UIcon name="lucide:chevron-right" class="h-4 w-4 flex-shrink-0 text-gray-300 dark:text-gray-600" />
            </button>
          </div>

          <!-- Level: categories -->
          <div v-else-if="level.type === 'categories'">
            <div v-if="categoriesLoading" class="py-3"><AppSkeleton variant="list" :rows="4" /></div>
            <div v-else class="gw-card p-1.5">
              <button type="button" class="gw-row" @click="openArticles(level, null)">
                <span class="gw-row-icon"><UIcon name="lucide:layout-list" class="h-4 w-4" /></span>
                <span class="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{{ t('guide.allArticles') }}</span>
                <UIcon name="lucide:chevron-right" class="h-4 w-4 flex-shrink-0 text-gray-300 dark:text-gray-600" />
              </button>
              <button
                v-for="row in categoryRows"
                :key="row.category.id"
                type="button"
                class="gw-row"
                :style="{ paddingLeft: `${0.7 + row.depth * 1}rem` }"
                @click="openArticles(level, row.category)"
              >
                <span class="gw-row-icon"><UIcon name="lucide:folder" class="h-4 w-4" /></span>
                <span class="min-w-0 flex-1 truncate text-sm font-medium text-gray-800 dark:text-gray-100">{{ localeName(row.category) }}</span>
                <UIcon name="lucide:chevron-right" class="h-4 w-4 flex-shrink-0 text-gray-300 dark:text-gray-600" />
              </button>
              <p v-if="!categoryRows.length" class="px-3 py-3 text-sm text-gray-400">{{ t('guide.noCategories') }}</p>
            </div>
          </div>

          <!-- Level: articles -->
          <div v-else-if="level.type === 'articles'">
            <div v-if="articlesLoading" class="py-3"><AppSkeleton variant="list" :rows="4" /></div>
            <div v-else class="gw-card p-1.5">
              <button v-for="article in currentArticles" :key="article.id" type="button" class="gw-row" @click="openArticle(level, article)">
                <span class="gw-row-icon"><UIcon name="lucide:file-text" class="h-4 w-4" /></span>
                <span class="min-w-0 flex-1 text-sm font-medium text-gray-800 dark:text-gray-100">{{ localeTitle(article) }}</span>
                <UIcon name="lucide:chevron-right" class="h-4 w-4 flex-shrink-0 text-gray-300 dark:text-gray-600" />
              </button>
              <p v-if="!currentArticles.length" class="px-3 py-3 text-sm text-gray-400">{{ t('guide.noArticles') }}</p>
            </div>
          </div>

          <!-- Level: article -->
          <div v-else-if="level.type === 'article'">
            <div v-if="articleLoading" class="py-3"><AppSkeleton variant="list" :rows="4" /></div>
            <div v-else-if="currentArticle" class="gw-card p-5">
              <h4 class="mb-3 text-xl font-extrabold leading-tight tracking-tight text-gray-900 dark:text-white">{{ localeTitle(currentArticle) }}</h4>
              <div class="gw-prose" v-html="localeContentHtml(currentArticle)" />
              <NuxtLink
                :to="`/guide/${level.app.toLowerCase()}/${currentArticle.slug}`"
                target="_blank"
                class="gw-link mt-4"
              >
                {{ t('guide.openFullPage') }}
                <UIcon name="lucide:arrow-up-right" class="h-3.5 w-3.5" />
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>

      <!-- footer -->
      <div class="px-5 pb-4 pt-3">
        <NuxtLink :to="`/guide/${currentGuideApp.toLowerCase()}`" class="gw-open group" @click="isOpen = false">
          <span class="min-w-0 truncate">{{ t('guide.openGuideFor') }} {{ currentAppName || appLabel(currentGuideApp) }}</span>
          <span class="gw-open__arrow"><UIcon name="lucide:arrow-up-right" class="h-4 w-4" /></span>
        </NuxtLink>
      </div>

      <GuideContactBar />
    </div>
  </USlideover>
</template>

<script setup lang="ts">
import AppSkeleton from '@/components/ui/AppSkeleton.vue';
import { computed, ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useOnboarding } from '@/composables/useOnboarding';
import { GUIDE_APP_BY_ID, GUIDE_APP_IDS, useGuideContext } from '@/composables/useGuideContext';
import { ALL_APPS } from '@/config/apps';
import { useGuideApps } from '@/composables/useGuideApps';
import GuideAppIcon from '@/components/guide/GuideAppIcon.vue';
import { renderMarkdownSafe, stripLeadingHeading } from '@/utils/renderMarkdown';
import { guideGetArticleBySlug, guideListArticles, guideListCategories } from '@/api/guide/public';
import type { GuideApp, GuideArticle, GuideArticleListItem, GuideCategory } from '@/api/guide/public';

const isOpen = defineModel<boolean>({ default: false });

const { t, locale } = useI18n();
// Legal docs embed a `{{site}}` token so the rendered text names the host
// the visitor is on (lota.tools / lota.kz / a mirror).
const currentHost = import.meta.client ? window.location.host : useRequestURL({ xForwardedHost: true }).host;
const { currentAppId, currentTour, currentAppName, currentGuideApp } = useGuideContext();
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
  return renderMarkdownSafe(stripLeadingHeading(fillSiteHost(raw, currentHost)));
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

const { entryByParam } = useGuideApps();

const browsableApps = computed(() => GUIDE_APP_IDS.map((id) => {
  const app = ALL_APPS.find((a) => a.address === id);
  return {
    id,
    gradient: (entryByParam(id)?.gradient || ['#2563eb', '#10b981']) as [string, string],
    guideApp: GUIDE_APP_BY_ID[id],
    label: app ? t(app.titleKey) : id,
    icon: app?.icon || 'lucide:layout-grid',
    // Compare the concrete app id, not the mapped GuideApp: Goods maps to
    // GLOBAL (it has no dedicated GuideApp), so `=== currentGuideApp` marked
    // Goods "current" on every non-app page (/hub, /, guide) where
    // currentGuideApp falls back to GLOBAL.
    isCurrent: id === currentAppId.value,
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
      // localeExcerpt is plain admin-authored text (a <UTextarea>, not the
      // markdown editor localeContentHtml's source goes through) but this
      // whole cache feeds a v-html sink either way -- sanitize it too, or a
      // compromised/careless console-Editor account could inject a
      // <script> here (this is the fallback used while/if the full
      // article body fails to load).
      return [item.id, full ? localeContentHtml(full) : sanitizeHtml(localeExcerpt(item))] as const;
    }));
    faqContentCache.value = Object.fromEntries(entries);
  } catch {
    faqItems.value = [];
  }
}

const faqAccordionItems = computed(() => faqItems.value.map((item) => ({
  label: localeTitle(item),
  // Same v-html sink as above -- same sanitize-the-raw-excerpt rule.
  contentHtml: faqContentCache.value[item.id] || sanitizeHtml(localeExcerpt(item)),
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
  // Land straight in the current app's section instead of the flat app
  // list the visitor would otherwise have to click through -- they're
  // already marked "current" there (see browsableApps' isCurrent), so
  // starting collapsed just added a click. openCategories pushes on top
  // of the 'apps' level already set above, so the back arrow still
  // returns to the full list for browsing other apps.
  const current = browsableApps.value.find((a) => a.isCurrent);
  if (current) openCategories(current);
  loadFaq();
}, { immediate: true });
</script>
