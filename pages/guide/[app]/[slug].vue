<template>
  <div v-if="loading" class="mx-auto max-w-2xl px-4 py-16">
    <AppSkeleton variant="panel" :rows="2" />
  </div>
  <div v-else-if="!article" class="mx-auto max-w-2xl px-4 py-24 text-center">
    <p class="text-gray-500">{{ t('guide.notFound') }}</p>
    <NuxtLink :to="`/guide/${appParam}`" class="mt-3 inline-block text-primary hover:underline">{{ t('guide.title') }}</NuxtLink>
  </div>
  <div v-else class="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10 lg:px-8">
    <!-- breadcrumbs -->
    <nav class="mb-6 flex flex-wrap items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400" aria-label="breadcrumb">
      <NuxtLink to="/guide" class="crumb">lota {{ t('guide.title') }}</NuxtLink>
      <UIcon name="lucide:chevron-right" class="h-3 w-3 text-gray-300 dark:text-gray-600" />
      <NuxtLink :to="`/guide/${appParam}`" class="crumb">{{ resolvedAppLabel }}</NuxtLink>
    </nav>

    <div class="lg:grid lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-10">
      <main class="min-w-0">
        <header v-reveal class="mb-6 sm:mb-8">
          <span v-if="entry" class="inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-xs font-semibold text-white" :style="guideGradientStyle(entry.gradient)">
            <span class="flex h-5 w-5 items-center justify-center rounded-full bg-white/25"><UIcon :name="entry.icon" class="h-3 w-3" /></span>
            {{ entry.label }}
          </span>
          <h1 class="mt-4 text-3xl font-extrabold leading-[1.1] tracking-tight text-gray-900 dark:text-white sm:text-4xl md:text-5xl">{{ localeTitle }}</h1>
          <p v-if="localeExcerpt" class="mt-3 max-w-2xl text-base leading-7 text-gray-600 dark:text-gray-300 md:text-lg">{{ localeExcerpt }}</p>
          <p class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400 dark:text-gray-500">
            <span class="inline-flex items-center gap-1.5"><UIcon name="lucide:clock" class="h-3.5 w-3.5" />{{ readMinutes }} {{ t('guide.minRead') }}</span>
            <span v-if="updatedLabel" class="inline-flex items-center gap-1.5"><UIcon name="lucide:refresh-cw" class="h-3.5 w-3.5" />{{ t('guide.updated') }} {{ updatedLabel }}</span>
          </p>
        </header>

        <article v-reveal="80" class="bezel">
          <div class="bezel-core p-6 sm:p-10">
            <div class="guide-prose" v-html="localeContentHtml" />
          </div>
        </article>

        <!-- previous / next -->
        <div v-if="prevArticle || nextArticle" class="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <NuxtLink v-if="prevArticle" :to="`/guide/${appParam}/${prevArticle.slug}`" class="pn group">
            <UIcon name="lucide:arrow-left" class="pn-arrow h-4 w-4 flex-shrink-0 transition-transform duration-500 group-hover:-translate-x-1" />
            <span class="min-w-0">
              <span class="block text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">{{ t('guide.prev') }}</span>
              <span class="mt-0.5 block truncate text-sm font-semibold text-gray-900 dark:text-white">{{ titleOf(prevArticle) }}</span>
            </span>
          </NuxtLink>
          <span v-else class="hidden sm:block" />
          <NuxtLink v-if="nextArticle" :to="`/guide/${appParam}/${nextArticle.slug}`" class="pn group justify-between text-right sm:col-start-2">
            <span class="min-w-0">
              <span class="block text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">{{ t('guide.next') }}</span>
              <span class="mt-0.5 block truncate text-sm font-semibold text-gray-900 dark:text-white">{{ titleOf(nextArticle) }}</span>
            </span>
            <UIcon name="lucide:arrow-right" class="pn-arrow h-4 w-4 flex-shrink-0 transition-transform duration-500 group-hover:translate-x-1" />
          </NuxtLink>
        </div>

        <div class="mt-8">
          <GuideContactBar variant="card" />
        </div>
      </main>

      <!-- in this section -->
      <aside v-if="(siblings || []).length > 1" class="mt-10 lg:mt-0 lg:sticky lg:top-4 lg:self-start">
        <p class="mb-3 px-1 text-xs font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">{{ t('guide.inThisSection') }}</p>
        <ul class="space-y-0.5">
          <li v-for="a in siblings" :key="a.id">
            <NuxtLink :to="`/guide/${appParam}/${a.slug}`" class="side-link" :class="a.slug === slug ? 'side-link--active' : ''" :aria-current="a.slug === slug ? 'page' : undefined">
              {{ titleOf(a) }}
            </NuxtLink>
          </li>
        </ul>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import AppSkeleton from '@/components/ui/AppSkeleton.vue';
definePageMeta({ layout: 'full' });

import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import { guideAppFromParam } from '@/composables/useGuideContext';
import { guideGetArticleBySlug, guideListArticles } from '@/api/guide/public';
import { useGuideApps, guideGradientStyle } from '@/composables/useGuideApps';
import type { GuideArticle, GuideArticleListItem } from '@/api/guide/public';
import { renderMarkdownSafe, stripLeadingHeading } from '@/utils/renderMarkdown';

const route = useRoute();
const { t, locale } = useI18n();

// Host the visitor is actually on -- legal docs carry a `{{site}}` token so
// the rendered policy names lota.tools / lota.kz / a mirror, not a literal.
// xForwardedHost so a cluster ingress hop doesn't collapse it to localhost.
const currentHost = useRequestURL({ xForwardedHost: true }).host;

const appParam = computed(() => String(route.params.app || '').toLowerCase());
const app = computed(() => guideAppFromParam(appParam.value));
const slug = computed(() => String(route.params.slug || ''));

const { entryByParam, field } = useGuideApps();
const entry = computed(() => entryByParam(appParam.value));
const resolvedAppLabel = computed(() => entry.value?.label || t('guide.appGlobal'));

// B1: useAsyncData (not onMounted) so the server actually renders the
// article instead of an empty shell -- and unlike a plain top-level
// `await`, its result rides the Nuxt payload, so hydration reuses the
// SSR fetch instead of silently re-requesting it client-side. Static key
// is correct (not derived from slug): this page component is reused
// across article-to-article navigation (no custom NuxtPage key forces a
// remount), so `watch` below is what triggers the refetch on param
// change, same as the `watch([appParam, slug], load)` it replaces.
const { data: article, pending: loading } = await useAsyncData<GuideArticle | null>(
  'guide-article',
  async () => {
    if (!app.value || !slug.value) return null;
    try {
      return await guideGetArticleBySlug(app.value, slug.value);
    } catch {
      return null;
    }
  },
  { watch: [appParam, slug] },
);

// Sibling articles of the same product: the "in this section" rail and the
// previous/next cards. Failure just hides them -- the article still renders.
const { data: siblings } = await useAsyncData<GuideArticleListItem[]>(
  'guide-article-siblings',
  async () => {
    if (!app.value) return [];
    try {
      return await guideListArticles(app.value);
    } catch {
      return [];
    }
  },
  { watch: [appParam] },
);
const siblingIndex = computed(() => (siblings.value ?? []).findIndex((a) => a.slug === slug.value));
const prevArticle = computed(() => (siblingIndex.value > 0 ? siblings.value![siblingIndex.value - 1] : null));
const nextArticle = computed(() => (siblingIndex.value >= 0 && siblingIndex.value < (siblings.value?.length ?? 0) - 1 ? siblings.value![siblingIndex.value + 1] : null));
const titleOf = (a: GuideArticleListItem) => field(a, 'title') || a.slug;

const readMinutes = computed(() => {
  const words = localeContentHtml.value.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
});
const updatedLabel = computed(() => {
  const sec = Number(article.value?.updatedAtUnix || 0);
  if (!sec) return '';
  return new Date(sec * 1000).toLocaleDateString(locale.value === 'kk' ? 'kk-KZ' : locale.value === 'en' ? 'en-GB' : 'ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
});

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
  return renderMarkdownSafe(stripLeadingHeading(fillSiteHost(raw, currentHost)));
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
</script>

<style scoped>
.crumb { border-radius: 9999px; padding: 0.25rem 0.7rem; background: rgba(15, 23, 42, 0.04); box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.06); transition: background 0.2s; }
.crumb:hover { background: rgba(15, 23, 42, 0.08); }
.dark .crumb { background: rgba(255, 255, 255, 0.06); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.09); }
.dark .crumb:hover { background: rgba(255, 255, 255, 0.1); }

.side-link { display: block; border-radius: 0.9rem; padding: 0.5rem 0.8rem; font-size: 0.875rem; line-height: 1.35; color: #475569; transition: background 0.2s cubic-bezier(0.32, 0.72, 0, 1), color 0.15s; }
.side-link:hover { background: rgba(15, 23, 42, 0.05); color: #0f172a; }
.side-link--active { font-weight: 600; color: #1d4ed8; background: rgba(37, 99, 235, 0.08); }
.dark .side-link { color: #a3a3a3; }
.dark .side-link:hover { background: rgba(255, 255, 255, 0.06); color: #fff; }
.dark .side-link--active { color: #93c5fd; background: rgba(255, 255, 255, 0.08); }

.pn { display: flex; align-items: center; gap: 0.9rem; border-radius: 1.5rem; padding: 1rem 1.25rem; background: rgba(15, 23, 42, 0.03); box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.07); transition: transform 0.25s cubic-bezier(0.32, 0.72, 0, 1), background 0.2s; }
.pn:hover { background: rgba(37, 99, 235, 0.06); transform: translateY(-2px); }
.pn-arrow { color: #64748b; }
.dark .pn { background: rgba(255, 255, 255, 0.04); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08); }
.dark .pn:hover { background: rgba(255, 255, 255, 0.08); }

/* Article typography (markdown output from utils/renderMarkdown.ts). */
.guide-prose { font-size: 1.0625rem; line-height: 1.8; color: #334155; overflow-wrap: anywhere; }
.guide-prose > :deep(:first-child) { margin-top: 0; }
.guide-prose :deep(h1), .guide-prose :deep(h2), .guide-prose :deep(h3), .guide-prose :deep(h4) { color: #0f172a; font-weight: 800; letter-spacing: -0.015em; line-height: 1.25; }
.guide-prose :deep(h1) { font-size: 1.75rem; margin: 2.2rem 0 0.9rem; }
.guide-prose :deep(h2) { font-size: 1.5rem; margin: 2.4rem 0 0.8rem; padding-top: 0.4rem; }
.guide-prose :deep(h3) { font-size: 1.2rem; margin: 1.8rem 0 0.6rem; }
.guide-prose :deep(p) { margin: 0.95rem 0; }
.guide-prose :deep(a) { color: #2563eb; font-weight: 500; text-decoration: underline; text-decoration-color: rgba(37, 99, 235, 0.35); text-underline-offset: 3px; transition: text-decoration-color 0.15s; }
.guide-prose :deep(a:hover) { text-decoration-color: currentColor; }
.guide-prose :deep(ul), .guide-prose :deep(ol) { margin: 0.95rem 0; padding-left: 1.4rem; }
.guide-prose :deep(ul) { list-style: disc; }
.guide-prose :deep(ol) { list-style: decimal; }
.guide-prose :deep(li) { margin: 0.35rem 0; padding-left: 0.2rem; }
.guide-prose :deep(li::marker) { color: #94a3b8; }
.guide-prose :deep(strong) { color: #0f172a; font-weight: 700; }
.guide-prose :deep(blockquote) { margin: 1.4rem 0; border-radius: 1rem; padding: 0.9rem 1.2rem; background: rgba(37, 99, 235, 0.06); box-shadow: inset 3px 0 0 #2563eb; color: #1e293b; }
.guide-prose :deep(blockquote > :first-child) { margin-top: 0; }
.guide-prose :deep(blockquote > :last-child) { margin-bottom: 0; }
.guide-prose :deep(code) { border-radius: 0.5rem; padding: 0.12rem 0.4rem; font-size: 0.9em; background: rgba(15, 23, 42, 0.06); }
.guide-prose :deep(pre) { margin: 1.3rem 0; overflow-x: auto; border-radius: 1rem; padding: 1rem 1.2rem; background: #0f172a; color: #e2e8f0; font-size: 0.875rem; line-height: 1.65; }
.guide-prose :deep(pre code) { padding: 0; background: transparent; }
.guide-prose :deep(img) { margin: 1.5rem 0; max-width: 100%; height: auto; border-radius: 1.25rem; box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.08), 0 18px 40px -22px rgba(15, 23, 42, 0.3); }
.guide-prose :deep(hr) { margin: 2.2rem 0; border: 0; height: 1px; background: rgba(15, 23, 42, 0.1); }
.guide-prose :deep(table) { display: block; width: 100%; margin: 1.3rem 0; overflow-x: auto; border-collapse: collapse; font-size: 0.95rem; }
.guide-prose :deep(th), .guide-prose :deep(td) { padding: 0.6rem 0.9rem; text-align: left; border-bottom: 1px solid rgba(15, 23, 42, 0.1); }
.guide-prose :deep(th) { font-weight: 700; color: #0f172a; background: rgba(15, 23, 42, 0.04); }

.dark .guide-prose { color: #d4d4d4; }
.dark .guide-prose :deep(h1), .dark .guide-prose :deep(h2), .dark .guide-prose :deep(h3), .dark .guide-prose :deep(h4), .dark .guide-prose :deep(strong), .dark .guide-prose :deep(th) { color: #fff; }
.dark .guide-prose :deep(a) { color: #93c5fd; text-decoration-color: rgba(147, 197, 253, 0.35); }
.dark .guide-prose :deep(blockquote) { background: rgba(255, 255, 255, 0.05); box-shadow: inset 3px 0 0 #60a5fa; color: #e5e5e5; }
.dark .guide-prose :deep(code) { background: rgba(255, 255, 255, 0.1); }
.dark .guide-prose :deep(pre) { background: #0a0a0a; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08); }
.dark .guide-prose :deep(img) { box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1); }
.dark .guide-prose :deep(hr), .dark .guide-prose :deep(th), .dark .guide-prose :deep(td) { border-color: rgba(255, 255, 255, 0.12); }
.dark .guide-prose :deep(th) { background: rgba(255, 255, 255, 0.06); }
</style>
