<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from '@/composables/useI18n';

definePageMeta({
  viewTransition: false,
});

type ArticleMeta = Record<string, string | string[]>;

type ArticleDoc = {
  slug: string;
  meta: ArticleMeta;
  body: string;
};

const { t, locale } = useI18n();
const route = useRoute();
const config = useRuntimeConfig();

const mdFiles = import.meta.glob('../public/content/publications/**/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

function parseFrontMatter(raw: string): { meta: ArticleMeta; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };

  const metaLines = match[1].split('\n');
  const body = match[2] || '';
  const meta: ArticleMeta = {};

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

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase();
}

const allArticles = computed<ArticleDoc[]>(() => {
  return Object.values(mdFiles)
    .map((raw) => {
      const { meta, body } = parseFrontMatter(raw);
      const slug = normalizeSlug(String(meta.slug || ''));
      if (!slug) return null;
      return { slug, meta, body };
    })
    .filter((item): item is ArticleDoc => !!item);
});

const articleBySlug = computed(() => {
  const map = new Map<string, ArticleDoc>();
  for (const article of allArticles.value) {
    map.set(article.slug, article);
  }
  return map;
});

const slugParam = computed(() => normalizeSlug(String(route.params.slug || '')));
const article = computed(() => articleBySlug.value.get(slugParam.value) || null);

if (!article.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Article not found',
  });
}

const articleTitle = computed(() => String(article.value?.meta.title || 'Article'));
const articleDescription = computed(() => String(article.value?.meta.description || ''));
const articleAuthor = computed(() => String(article.value?.meta.author || 'Lota Team'));
const articleOgImage = computed(() => String(article.value?.meta.og_image || '/og-image.png'));

const articleTags = computed(() => {
  const tags = article.value?.meta.tags;
  return Array.isArray(tags) ? tags : [];
});

const articleDate = computed(() => {
  const raw = String(article.value?.meta.date || '');
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return raw;
  return dt.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
});

const siteUrl = computed(() => String(config.public.siteUrl || 'https://lota.tools').replace(/\/$/, ''));
const articleCanonical = computed(() => {
  const canonical = String(article.value?.meta.canonical || '').trim();
  if (canonical) return canonical;
  const slug = article.value?.slug || slugParam.value;
  return `${siteUrl.value}/${slug}`;
});
const articleRobots = computed(() => String(article.value?.meta.robots || 'index,follow'));
const articlePublishedIso = computed(() => {
  const raw = String(article.value?.meta.date || '');
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toISOString();
});
const articleJsonLd = computed(() => ({
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: articleTitle.value,
  description: articleDescription.value,
  image: [articleOgImage.value],
  author: {
    '@type': 'Organization',
    name: articleAuthor.value,
  },
  datePublished: articlePublishedIso.value || undefined,
  dateModified: articlePublishedIso.value || undefined,
  mainEntityOfPage: {
    '@type': 'WebPage',
    '@id': articleCanonical.value,
  },
  inLanguage: String(locale.value || 'ru'),
}));

type SuggestedArticle = {
  slug: string;
  title: string;
  description: string;
  dateISO: string;
  dateLabel: string;
  tags: string[];
  image: string;
  sharedTags: number;
};

function toTags(value: string | string[] | undefined): string[] {
  return Array.isArray(value) ? value : [];
}

function toDateLabel(dateISO: string): string {
  const dt = new Date(dateISO);
  if (Number.isNaN(dt.getTime())) return dateISO;
  return dt.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
}

const suggestedArticles = computed<SuggestedArticle[]>(() => {
  if (!article.value) return [];

  const currentTags = new Set(toTags(article.value.meta.tags));

  return allArticles.value
    .filter((item) => item.slug !== article.value?.slug)
    .map((item) => {
      const title = String(item.meta.title || item.slug);
      const description = String(item.meta.description || '').trim();
      const dateISO = String(item.meta.date || '');
      const tags = toTags(item.meta.tags);
      const image = String(item.meta.og_image || '/og-image.png');
      const sharedTags = tags.reduce((acc, tag) => acc + (currentTags.has(tag) ? 1 : 0), 0);

      return {
        slug: item.slug,
        title,
        description,
        dateISO,
        dateLabel: toDateLabel(dateISO),
        tags,
        image,
        sharedTags,
      };
    })
    .sort((a, b) => {
      if (b.sharedTags !== a.sharedTags) return b.sharedTags - a.sharedTags;
      return new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime();
    })
    .slice(0, 3);
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripDuplicatedLead(markdown: string, title: string): string {
  let normalized = markdown.replace(/\r\n/g, '\n').trimStart();
  const cleanTitle = title.trim();
  if (!cleanTitle) return normalized;

  const firstHeadingRegex = new RegExp(`^#\\s+${escapeRegExp(cleanTitle)}\\s*\\n+`, 'i');
  normalized = normalized.replace(firstHeadingRegex, '');

  return normalized.trimStart();
}

const sanitizedArticleBody = computed(() => {
  const raw = article.value?.body || '';
  return stripDuplicatedLead(raw, articleTitle.value);
});

const hasImageInBody = computed(() => /!\[[^\]]*\]\([^)]+\)/.test(sanitizedArticleBody.value));

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
    return trimmed;
  }
  return '#';
}

function renderInline(text: string): string {
  let safe = escapeHtml(text);
  safe = safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  safe = safe.replace(/\*(.+?)\*/g, '<em>$1</em>');
  safe = safe.replace(/`([^`]+)`/g, '<code class="rounded bg-gray-100 px-1 py-0.5 text-[0.9em] dark:bg-gray-800">$1</code>');
  safe = safe.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label: string, href: string) => {
    const link = sanitizeUrl(href);
    const target = link.startsWith('http') ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a href="${escapeHtml(link)}" class="text-blue-600 underline underline-offset-2 dark:text-blue-300"${target}>${label}</a>`;
  });
  return safe;
}

function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();

    if (!line) {
      index += 1;
      continue;
    }

    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) {
      html.push(`<h3 class="mt-8 mb-3 text-xl font-semibold text-gray-900 dark:text-gray-100">${renderInline(h3[1])}</h3>`);
      index += 1;
      continue;
    }

    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      html.push(`<h2 class="mt-10 mb-3 text-2xl font-semibold text-gray-900 dark:text-gray-100">${renderInline(h2[1])}</h2>`);
      index += 1;
      continue;
    }

    const h1 = line.match(/^#\s+(.+)$/);
    if (h1) {
      html.push(`<h1 class="mt-10 mb-3 text-3xl font-semibold text-gray-900 dark:text-gray-100">${renderInline(h1[1])}</h1>`);
      index += 1;
      continue;
    }

    const image = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (image) {
      const src = escapeHtml(sanitizeUrl(image[2]));
      const alt = escapeHtml(image[1] || '');
      html.push(`<figure class="my-6"><img src="${src}" alt="${alt}" width="1200" height="630" class="w-full rounded-2xl border border-gray-200 object-cover dark:border-gray-700" loading="lazy" /></figure>`);
      index += 1;
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ''));
        index += 1;
      }
      const listItems = items.map((item) => `<li>${renderInline(item)}</li>`).join('');
      html.push(`<ol class="my-4 list-decimal space-y-1 pl-6 text-base leading-7 text-gray-700 dark:text-gray-300">${listItems}</ol>`);
      continue;
    }

    if (/^-\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^-\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^-\s+/, ''));
        index += 1;
      }
      const listItems = items.map((item) => `<li>${renderInline(item)}</li>`).join('');
      html.push(`<ul class="my-4 list-disc space-y-1 pl-6 text-base leading-7 text-gray-700 dark:text-gray-300">${listItems}</ul>`);
      continue;
    }

    const paragraph: string[] = [line];
    index += 1;
    while (index < lines.length) {
      const next = lines[index].trim();
      if (!next) break;
      if (/^(#|##|###)\s+/.test(next)) break;
      if (/^!\[[^\]]*\]\([^)]+\)$/.test(next)) break;
      if (/^\d+\.\s+/.test(next)) break;
      if (/^-\s+/.test(next)) break;
      paragraph.push(next);
      index += 1;
    }

    html.push(`<p class="my-4 text-base leading-7 text-gray-700 dark:text-gray-300">${renderInline(paragraph.join(' '))}</p>`);
  }

  return html.join('');
}

const articleHtml = computed(() => markdownToHtml(sanitizedArticleBody.value));

type OverflowOffender = {
  tag: string;
  className: string;
  left: number;
  right: number;
  width: number;
};

let overflowProbeTimer: ReturnType<typeof setTimeout> | null = null;
let lastOverflowSignature = '';

function collectOverflowOffenders(): OverflowOffender[] {
  if (!process.client) return [];

  const viewportWidth = document.documentElement.clientWidth;
  const nodes = Array.from(document.body.querySelectorAll('*')) as HTMLElement[];
  const offenders: OverflowOffender[] = [];

  for (const node of nodes) {
    const rect = node.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;

    if (rect.right > viewportWidth + 1 || rect.left < -1) {
      offenders.push({
        tag: node.tagName.toLowerCase(),
        className: (node.className || '').toString().slice(0, 120),
        left: Number(rect.left.toFixed(1)),
        right: Number(rect.right.toFixed(1)),
        width: Number(rect.width.toFixed(1)),
      });
    }
  }

  return offenders.slice(0, 8);
}

async function reportOverflow(reason: string) {
  if (!process.client || !process.dev) return;

  const offenders = collectOverflowOffenders();
  const signature = JSON.stringify(offenders);
  if (signature === lastOverflowSignature) return;
  lastOverflowSignature = signature;

  try {
    await fetch('/api/client-overflow-log', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        route: route.fullPath,
        reason,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        scroll: {
          x: window.scrollX,
          y: window.scrollY,
        },
        offenders,
      }),
      keepalive: true,
    });
  } catch {
    // Ignore diagnostics transport failures in dev mode.
  }
}

function scheduleOverflowProbe(reason: string) {
  if (!process.client || !process.dev) return;
  if (overflowProbeTimer) clearTimeout(overflowProbeTimer);
  overflowProbeTimer = setTimeout(() => {
    reportOverflow(reason);
  }, 120);
}

function onOverflowProbeScroll() {
  scheduleOverflowProbe('scroll');
}

function onOverflowProbeResize() {
  scheduleOverflowProbe('resize');
}

useSeoMeta({
  title: () => articleTitle.value,
  description: () => articleDescription.value,
  ogTitle: () => articleTitle.value,
  ogDescription: () => articleDescription.value,
  ogType: 'article',
  ogUrl: () => articleCanonical.value,
  ogImage: () => articleOgImage.value,
  twitterCard: 'summary_large_image',
  twitterTitle: () => articleTitle.value,
  twitterDescription: () => articleDescription.value,
  twitterImage: () => articleOgImage.value,
});

useHead(() => ({
  title: articleTitle.value,
  link: [
    { rel: 'canonical', href: articleCanonical.value },
  ],
  meta: [
    { name: 'robots', content: articleRobots.value },
    { property: 'og:url', content: articleCanonical.value },
    { property: 'article:author', content: articleAuthor.value },
    { property: 'article:published_time', content: articlePublishedIso.value },
  ],
  script: [
    {
      type: 'application/ld+json',
      children: JSON.stringify(articleJsonLd.value),
    },
  ],
}));

onMounted(() => {
  if (!process.client) return;
  document.documentElement.classList.add('article-slug-page');
  document.body.classList.add('article-slug-page');

  if (process.dev) {
    window.addEventListener('scroll', onOverflowProbeScroll, { passive: true });
    window.addEventListener('resize', onOverflowProbeResize, { passive: true });
    scheduleOverflowProbe('mounted');
  }
});

watch(
  () => route.params.slug,
  async () => {
    if (!process.client) return;
    await nextTick();
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    scheduleOverflowProbe('slug-change');
  }
);

onBeforeUnmount(() => {
  if (!process.client) return;
  document.documentElement.classList.remove('article-slug-page');
  document.body.classList.remove('article-slug-page');

  if (process.dev) {
    window.removeEventListener('scroll', onOverflowProbeScroll);
    window.removeEventListener('resize', onOverflowProbeResize);
    if (overflowProbeTimer) {
      clearTimeout(overflowProbeTimer);
      overflowProbeTimer = null;
    }
  }
});
</script>

<template>
  <main class="relative min-h-screen overflow-x-clip bg-gradient-to-b from-white via-emerald-50/45 to-cyan-50/45 px-4 py-7 md:px-6 md:py-10 dark:from-slate-900 dark:via-emerald-950/18 dark:to-blue-950/26">
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 -z-0"
      style="
        background:
          radial-gradient(920px 430px at 10% -10%, rgba(16, 185, 129, 0.11), transparent 66%),
          radial-gradient(780px 360px at 92% 8%, rgba(6, 182, 212, 0.09), transparent 69%),
          radial-gradient(700px 340px at 55% 100%, rgba(59, 130, 246, 0.075), transparent 71%);
      "
    />

    <article class="relative z-10 mx-auto w-full max-w-[980px]">
      <div class="rounded-[28px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_16px_50px_-28px_rgba(15,23,42,0.35)] backdrop-blur sm:p-7 md:p-10 dark:border-gray-700 dark:bg-gray-900/95 dark:shadow-[0_20px_60px_-30px_rgba(0,0,0,0.7)]">
        <div class="mx-auto w-full max-w-[720px]">
          <NuxtLink
            to="/feed"
            class="mb-7 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-blue-300 hover:text-blue-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-blue-500 dark:hover:text-blue-300"
          >
            <UIcon name="lucide:arrow-left" class="h-4 w-4" />
            {{ t('app.back') || 'Назад' }}
          </NuxtLink>

          <header class="mb-8 border-b border-slate-100 pb-6 dark:border-gray-800">
            <p class="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-300">
              {{ t('app.articles') || 'Articles' }}
            </p>

            <h1 class="text-balance text-3xl font-semibold leading-tight text-slate-900 md:text-4xl dark:text-gray-100">
              {{ articleTitle }}
            </h1>

            <div class="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500 dark:text-gray-400">
              <span>{{ articleAuthor }}</span>
              <span aria-hidden="true">•</span>
              <span>{{ articleDate }}</span>
            </div>

            <div v-if="articleTags.length" class="mt-4 flex flex-wrap gap-2">
              <span
                v-for="tag in articleTags"
                :key="tag"
                class="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
              >
                #{{ tag }}
              </span>
            </div>
          </header>

          <img
            v-if="articleOgImage && !hasImageInBody"
            :src="articleOgImage"
            :alt="articleTitle"
            width="1200"
            height="630"
            class="mb-8 w-full rounded-3xl border border-slate-200 object-cover shadow-sm dark:border-gray-700"
            loading="lazy"
          />

          <div v-html="articleHtml" class="article-content" />

          <section v-if="suggestedArticles.length" class="mt-12 border-t border-slate-200 pt-8 dark:border-gray-800">
            <div class="mb-5 flex items-center justify-between gap-3">
              <h2 class="text-xl font-semibold text-slate-900 dark:text-gray-100">
                {{ t('app.continueReading') || 'Continue reading' }}
              </h2>
              <NuxtLink
                to="/feed"
                class="text-sm font-medium text-blue-600 transition hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
              >
                {{ t('app.moreArticles') || 'More articles' }}
              </NuxtLink>
            </div>

            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <a
                v-for="nextArticle in suggestedArticles"
                :key="nextArticle.slug"
                :href="`/${nextArticle.slug}`"
                class="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800/80 dark:hover:border-blue-500"
              >
                <img
                  :src="nextArticle.image"
                  :alt="nextArticle.title"
                  width="480"
                  height="224"
                  class="h-28 w-full object-cover"
                  loading="lazy"
                />
                <div class="p-3">
                  <p class="mb-1 text-xs text-slate-500 dark:text-gray-400">{{ nextArticle.dateLabel }}</p>
                  <h3 class="line-clamp-2 text-sm font-semibold leading-5 text-slate-900 group-hover:text-blue-700 dark:text-gray-100 dark:group-hover:text-blue-300">
                    {{ nextArticle.title }}
                  </h3>
                  <p v-if="nextArticle.description" class="mt-2 line-clamp-2 text-xs leading-5 text-slate-600 dark:text-gray-300">
                    {{ nextArticle.description }}
                  </p>
                </div>
              </a>
            </div>
          </section>
        </div>
      </div>
    </article>
  </main>
</template>

<style scoped>
:global(html.article-slug-page) {
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
  scrollbar-gutter: stable;
}

:global(body.article-slug-page) {
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
}

:global(body.article-slug-page #__nuxt) {
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
}

.article-content {
  color: rgb(51 65 85);
  overflow-wrap: anywhere;
  word-break: break-word;
}

.article-content :deep(a) {
  transition: color 0.15s ease;
}

.article-content :deep(img),
.article-content :deep(video),
.article-content :deep(iframe),
.article-content :deep(table),
.article-content :deep(pre) {
  max-width: 100%;
}

.article-content :deep(pre),
.article-content :deep(code) {
  white-space: pre-wrap;
  word-break: break-word;
}

.article-content :deep(a:hover) {
  color: rgb(29 78 216);
}

.article-content :deep(strong) {
  color: inherit;
  font-weight: 700;
  background-image: none !important;
  -webkit-background-clip: border-box !important;
  background-clip: border-box !important;
  -webkit-text-fill-color: currentColor;
}

:global(.dark) .article-content {
  color: rgb(209 213 219);
}

:global(.dark) .article-content :deep(strong) {
  color: inherit;
}
</style>
