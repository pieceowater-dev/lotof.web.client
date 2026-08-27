<template>
  <div v-if="loading" class="mx-auto max-w-2xl px-4 py-24 text-center text-sm text-gray-400">
    {{ t('app.loading') }}
  </div>
  <div v-else-if="!article" class="mx-auto max-w-2xl px-4 py-24 text-center">
    <p class="text-gray-500">{{ t('guide.notFound') }}</p>
    <NuxtLink :to="`/guide/${appParam}`" class="mt-3 inline-block text-primary hover:underline">{{ t('guide.title') }}</NuxtLink>
  </div>
  <div v-else class="min-h-screen bg-gray-50 dark:bg-gray-950">
    <div class="border-b border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div class="mx-auto max-w-2xl px-4 py-6 sm:px-6 lg:px-8">
        <NuxtLink :to="`/guide/${appParam}`" class="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-900 dark:hover:text-white">
          <UIcon name="lucide:arrow-left" class="h-3.5 w-3.5" />
          {{ resolvedAppLabel }}
        </NuxtLink>
      </div>
    </div>

    <div class="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <article class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 sm:p-8">
        <h1 class="mb-5 text-xl font-bold leading-snug text-gray-900 dark:text-white sm:text-2xl">{{ localeTitle }}</h1>
        <div class="prose prose-sm dark:prose-invert max-w-none sm:prose-base" v-html="localeContentHtml" />
      </article>

      <div class="mt-6">
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
import { guideGetArticleBySlug } from '@/api/guide/public';
import type { GuideArticle } from '@/api/guide/public';
import { renderMarkdownSafe, stripLeadingHeading } from '@/utils/renderMarkdown';

const route = useRoute();
const { t, locale } = useI18n();

const appParam = computed(() => String(route.params.app || '').toLowerCase());
const app = computed(() => guideAppFromParam(appParam.value));
const slug = computed(() => String(route.params.slug || ''));

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

const loading = ref(true);
const article = ref<GuideArticle | null>(null);

function localeSuffix(): 'Ru' | 'Kk' | 'En' {
  if (locale.value === 'kk') return 'Kk';
  if (locale.value === 'en') return 'En';
  return 'Ru';
}

const localeTitle = computed(() => {
  if (!article.value) return '';
  const suffix = localeSuffix();
  return (article.value[`title${suffix}` as 'titleRu'] || article.value.titleRu || article.value.slug) as string;
});

const localeContentHtml = computed(() => {
  if (!article.value) return '';
  const suffix = localeSuffix();
  const raw = (article.value[`content${suffix}` as 'contentRu'] || article.value.contentRu || '') as string;
  return renderMarkdownSafe(stripLeadingHeading(raw));
});

const localeExcerpt = computed(() => {
  if (!article.value) return '';
  const suffix = localeSuffix();
  return (article.value[`excerpt${suffix}` as 'excerptRu'] || article.value.excerptRu || '') as string;
});

const config = useRuntimeConfig();
const siteUrl = String(config.public.siteUrl || DEFAULT_SITE_URL).replace(/\/$/, '');
const pageTitle = computed(() => article.value ? `${localeTitle.value} — lota Гид` : 'lota Гид');
const pageDescription = computed(() => localeExcerpt.value || (article.value ? `${localeTitle.value} — инструкция lota Гид.` : ''));
const pageCanonical = computed(() => `${siteUrl}/guide/${appParam.value}/${slug.value}`);

useSeoMeta({
  title: () => pageTitle.value,
  description: () => pageDescription.value || undefined,
  ogTitle: () => pageTitle.value,
  ogDescription: () => pageDescription.value || undefined,
  ogType: 'article',
  ogUrl: () => pageCanonical.value,
  ogImage: `${siteUrl}/og-image.png`,
  twitterCard: 'summary_large_image',
});

useHead(() => ({
  link: article.value ? [{ rel: 'canonical', href: pageCanonical.value }] : [],
  // A missing/unknown slug renders a "not found" placeholder, not real
  // content -- indexing that page would be a soft-404.
  meta: (!loading.value && !article.value) ? [{ name: 'robots', content: 'noindex, follow' }] : [],
}));

async function load() {
  if (!app.value || !slug.value) {
    loading.value = false;
    article.value = null;
    return;
  }
  loading.value = true;
  try {
    article.value = await guideGetArticleBySlug(app.value, slug.value);
  } catch {
    article.value = null;
  } finally {
    loading.value = false;
  }
}

// Awaited at the top level (not via watch immediate) so Nuxt's automatic
// page-level <Suspense> waits for it during SSR -- otherwise the server
// sends down the loading skeleton and real content only appears after
// client hydration fetches it.
watch([appParam, slug], load);
await load();
</script>
