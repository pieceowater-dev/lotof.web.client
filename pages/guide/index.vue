<template>
  <div class="relative -mt-20 overflow-hidden">
    <div class="hero-mesh pointer-events-none absolute inset-x-0 top-0 h-[32rem]" aria-hidden="true" />

    <div class="relative mx-auto max-w-6xl px-4 pb-16 pt-28 sm:px-6 sm:pt-36 lg:px-8">
      <!-- back: previous page when we came from inside the app, else home -->
      <button v-reveal type="button" class="guide-back group" @click="goBack">
        <UIcon name="lucide:arrow-left" class="h-4 w-4 transition-transform duration-500 group-hover:-translate-x-0.5" />
        {{ t('app.back') }}
      </button>

      <!-- hero -->
      <header class="mx-auto flex max-w-2xl flex-col items-center text-center">
        <span v-reveal class="eyebrow"><UIcon name="lucide:book-open" class="h-3.5 w-3.5" />{{ t('guide.title') }}</span>
        <h1 v-reveal="80" class="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight text-gray-900 dark:text-white sm:text-5xl md:text-6xl">
          lota <span class="grad-text">{{ t('guide.title') }}</span>
        </h1>
        <p v-reveal="160" class="mt-4 max-w-lg text-base leading-relaxed text-gray-600 dark:text-gray-300 md:text-lg">{{ t('guide.homeTagline') }}</p>

        <!-- search over every published article -->
        <div v-reveal="240" class="relative mt-8 w-full">
          <div class="bezel !rounded-full">
            <label class="bezel-core flex items-center gap-3 !rounded-full px-5 py-3.5">
              <UIcon name="lucide:search" class="h-5 w-5 flex-shrink-0 text-gray-400" />
              <input
                v-model="query"
                type="search"
                class="guide-search min-w-0 flex-1 bg-transparent text-base text-gray-900 outline-none placeholder:text-gray-400 dark:text-white"
                :placeholder="t('guide.searchPlaceholder')"
                autocomplete="off"
                @keydown.esc="query = ''"
              />
              <button v-if="query" type="button" class="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10" :aria-label="t('guide.searchClear')" @click="query = ''">
                <UIcon name="lucide:x" class="h-4 w-4" />
              </button>
            </label>
          </div>
        </div>
      </header>

      <!-- search results replace the product grid while typing -->
      <Transition name="guide-fade" mode="out-in">
        <section v-if="searching" key="results" class="mx-auto mt-8 max-w-2xl">
          <div class="bezel">
            <div class="bezel-core p-2">
              <ul v-if="results.length" class="space-y-1">
                <li v-for="r in results" :key="`${r.entry.param}/${r.article.slug}`">
                  <NuxtLink :to="`/guide/${r.entry.param}/${r.article.slug}`" class="guide-hit group">
                    <GuideAppIcon :icon="r.entry.icon" :gradient="r.entry.gradient" size="sm" />
                    <span class="min-w-0 flex-1">
                      <span class="block truncate text-sm font-semibold text-gray-900 dark:text-white">{{ field(r.article, 'title') }}</span>
                      <span class="block truncate text-xs text-gray-500 dark:text-gray-400">{{ r.entry.label }}</span>
                    </span>
                    <UIcon name="lucide:arrow-up-right" class="h-4 w-4 flex-shrink-0 text-gray-300 transition-all duration-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-blue-500 dark:text-gray-600" />
                  </NuxtLink>
                </li>
              </ul>
              <p v-else class="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">{{ t('guide.searchEmpty') }}</p>
            </div>
          </div>
        </section>

        <!-- products -->
        <section v-else key="grid" class="mt-12 sm:mt-16">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
            <NuxtLink
              v-for="(item, i) in entries"
              :key="item.param"
              v-reveal="i * 60"
              :to="`/guide/${item.param}`"
              class="bezel bezel-hover group block"
              :class="item.param === 'global' ? 'lg:col-span-2' : ''"
            >
              <div class="bezel-core relative flex h-full min-h-[11rem] flex-col justify-between gap-6 overflow-hidden p-5 sm:p-6">
                <UIcon :name="item.icon" class="pointer-events-none absolute -bottom-8 -right-6 h-36 w-36 text-gray-900 dark:text-white" style="opacity: 0.04" />
                <div class="relative flex items-start justify-between gap-3">
                  <GuideAppIcon :icon="item.icon" :gradient="item.gradient" size="md" />
                  <span class="cta-arrow !h-9 !w-9 bg-gray-900/5 text-gray-500 transition-all duration-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-gray-900 dark:bg-white/10 dark:text-gray-300 dark:group-hover:text-white">
                    <UIcon name="lucide:arrow-up-right" class="h-4 w-4" />
                  </span>
                </div>
                <div class="relative">
                  <h2 class="text-lg font-bold tracking-tight text-gray-900 dark:text-white">{{ item.label }}</h2>
                  <p class="mt-1 line-clamp-2 min-h-[3rem] text-sm leading-6 text-gray-600 dark:text-gray-400">{{ item.description }}</p>
                  <p v-if="counts[item.param]" class="mt-3 text-xs font-medium text-gray-400 dark:text-gray-500">{{ articleCount(counts[item.param]) }}</p>
                </div>
              </div>
            </NuxtLink>
          </div>
        </section>
      </Transition>

      <div v-reveal="120" class="mx-auto mt-10 max-w-2xl">
        <GuideContactBar variant="card" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'full' });

import { computed, ref } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useGuideApps, loadAllGuideArticles } from '@/composables/useGuideApps';

const { t } = useI18n();
const { entries, field, articleCount } = useGuideApps();
const router = useRouter();
const { homePath } = usePreferredSpace();
function goBack() {
  if (window.history.state?.back) router.back();
  else router.push(homePath());
}
const config = useRuntimeConfig();
const siteUrl = String(config.public.siteUrl || DEFAULT_SITE_URL).replace(/\/$/, '');

useSeoMeta({
  title: 'lota Гид',
  description: () => t('guide.homeTagline') || 'Ответы на вопросы и инструкции по каждому продукту lota.',
  ogTitle: 'lota Гид',
  ogDescription: () => t('guide.homeTagline') || 'Ответы на вопросы и инструкции по каждому продукту lota.',
  ogType: 'website',
  ogUrl: `${siteUrl}/guide`,
  ogImage: `${siteUrl}/og-image.png`,
  twitterCard: 'summary_large_image',
});

useHead({
  link: [{ rel: 'canonical', href: `${siteUrl}/guide` }],
});


// SSR-rendered so the counts are in the first paint and rank-able markup.
const { data: all } = await useAsyncData('guide-all-articles', loadAllGuideArticles);

const counts = computed<Record<string, number>>(() => {
  const out: Record<string, number> = {};
  for (const e of entries.value) {
    const n = all.value?.[e.param]?.length;
    if (n != null) out[e.param] = n;
  }
  return out;
});

const query = ref('');
const searching = computed(() => query.value.trim().length > 0);
const results = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return [];
  const hits: { entry: (typeof entries.value)[number]; article: NonNullable<typeof all.value>[string][number] }[] = [];
  for (const entry of entries.value) {
    for (const article of all.value?.[entry.param] ?? []) {
      const hay = `${field(article, 'title')} ${field(article, 'excerpt')}`.toLowerCase();
      if (hay.includes(q)) hits.push({ entry, article });
    }
  }
  return hits.slice(0, 12);
});
</script>

<style scoped>
.guide-back {
  position: absolute;
  top: 6.25rem;
  left: 1rem;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  border-radius: 9999px;
  padding: 0.45rem 1rem 0.45rem 0.8rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #334155;
  background: rgba(255, 255, 255, 0.7);
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.08);
  transition: transform 0.25s cubic-bezier(0.32, 0.72, 0, 1), background 0.2s;
}
.guide-back:hover { background: #fff; }
.guide-back:active { transform: scale(0.96); }
.dark .guide-back { color: #e5e5e5; background: rgba(255, 255, 255, 0.07); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1); }
.dark .guide-back:hover { background: rgba(255, 255, 255, 0.12); }
@media (min-width: 640px) { .guide-back { top: 8.25rem; left: 1.5rem; } }
@media (min-width: 1024px) { .guide-back { left: 2rem; } }
.guide-search, .guide-search:focus, .guide-search:focus-visible { outline: none !important; box-shadow: none !important; border: 0 !important; }
.guide-search::-webkit-search-cancel-button { display: none; }
.guide-hit {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  border-radius: 1.4rem;
  padding: 0.65rem 0.9rem 0.65rem 0.65rem;
  transition: background 0.2s cubic-bezier(0.32, 0.72, 0, 1), transform 0.25s cubic-bezier(0.32, 0.72, 0, 1);
}
.guide-hit:hover { background: rgba(37, 99, 235, 0.07); transform: translateX(2px); }
.dark .guide-hit:hover { background: rgba(255, 255, 255, 0.07); }
.guide-fade-enter-active, .guide-fade-leave-active { transition: opacity 0.125s cubic-bezier(0.32, 0.72, 0, 1), transform 0.2s cubic-bezier(0.32, 0.72, 0, 1); }
.guide-fade-enter-from { opacity: 0; transform: translateY(10px); }
.guide-fade-leave-to { opacity: 0; transform: translateY(-6px); }
</style>
