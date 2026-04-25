<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import type { HomeFeedPost } from '@/components/HomePostsFeed.vue';

const { t } = useI18n();

const props = defineProps<{
  articlesSearch: string;
  selectedTag: string;
  popularTags: string[];
  whatsNewPosts: HomeFeedPost[];
  isMobileViewport: boolean;
  isFeedSectionInView: boolean;
}>();

const emit = defineEmits<{
  'update:articlesSearch': [value: string];
  'update:selectedTag': [value: string];
  open: [post: HomeFeedPost];
}>();

const mobileMenuOpen = ref(false);

function handleSearchInput(event: Event) {
  const target = event.target as HTMLInputElement;
  emit('update:articlesSearch', target.value);
}

function selectTag(tag: string) {
  emit('update:selectedTag', tag);
}

function resolveScrollContainer(): HTMLElement | null {
  if (!process.client) return null;
  return document.querySelector<HTMLElement>('main.main-scroll');
}

function scrollToTop() {
  if (!process.client) return;

  const container = resolveScrollContainer();
  if (container) {
    container.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function handleScrollTopTap(event?: Event) {
  event?.preventDefault();
  event?.stopPropagation();
  scrollToTop();
}

watch(
  () => [props.isMobileViewport, props.isFeedSectionInView],
  ([isMobile, inView]) => {
    if (!isMobile || !inView) {
      mobileMenuOpen.value = false;
    }
  }
);
</script>

<template>
  <div class="contents">
    <aside class="hidden lg:block lg:sticky lg:top-3 self-start flex flex-col min-h-0">
      <div class="mb-7 rounded-3xl border border-blue-100/80 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
        <div class="relative">
          <UIcon
            name="lucide:search"
            class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          />
          <input
            :value="props.articlesSearch"
            type="text"
            :placeholder="t('app.searchArticles') || 'Search articles'"
            class="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-800 outline-none transition focus:border-emerald-300 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            @input="handleSearchInput"
          />
        </div>

        <div v-if="props.popularTags.length" class="mt-4">
          <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t('app.popularTags') || 'Popular tags' }}</p>
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="rounded-lg border px-2 py-1 text-xs transition"
              :class="props.selectedTag === ''
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-emerald-200 dark:border-gray-600 dark:bg-gray-700/60 dark:text-gray-200'"
              @click="selectTag('')"
            >
              {{ t('app.all') || 'All' }}
            </button>
            <button
              v-for="tag in props.popularTags"
              :key="tag"
              type="button"
              class="rounded-lg border px-2 py-1 text-xs transition"
              :class="props.selectedTag === tag
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-emerald-200 dark:border-gray-600 dark:bg-gray-700/60 dark:text-gray-200'"
              @click="selectTag(tag)"
            >
              #{{ tag }}
            </button>
          </div>
        </div>

        <div class="mt-4 flex justify-end">
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-lg border border-blue-100 bg-blue-50/60 px-2.5 py-1.5 text-xs font-medium text-blue-600 transition hover:bg-blue-100/70 dark:border-gray-700 dark:bg-gray-700/60 dark:text-blue-300"
            :aria-label="t('app.scrollToTop') || 'Scroll to top'"
            @click="handleScrollTopTap"
            @touchstart.prevent.stop="handleScrollTopTap"
            @pointerdown.prevent.stop="handleScrollTopTap"
          >
            <UIcon name="lucide:arrow-up" class="h-3.5 w-3.5" />
            <span>{{ t('app.scrollToTop') || 'Up' }}</span>
          </button>
        </div>
      </div>

      <div class="flex h-[clamp(22rem,56vh,36rem)] min-h-0 flex-col rounded-3xl border border-blue-100/80 bg-gradient-to-br from-white to-blue-50/40 p-5 shadow-sm dark:border-gray-700 dark:bg-gradient-to-br dark:from-gray-800 dark:to-gray-800/70 overflow-hidden">
        <div class="mb-5 flex items-center gap-2">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
            <UIcon name="lucide:sparkles" class="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
          </div>
          <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">{{ t('app.whatsNew') || "What's New" }}</h3>
        </div>

        <div v-if="props.whatsNewPosts.length" class="whats-new-scroll min-h-0 flex-1 overflow-y-auto space-y-2.5 pr-2">
          <button
            v-for="post in props.whatsNewPosts"
            :key="post.id"
            type="button"
            class="group w-full text-left rounded-xl border border-gray-150 bg-white p-3 transition-all duration-200 hover:border-emerald-300 hover:shadow-md hover:bg-white dark:border-gray-600 dark:bg-gray-700/40 dark:hover:border-emerald-600 dark:hover:bg-gray-700/60"
            @click="emit('open', post)"
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

    <div
      v-if="props.isMobileViewport && props.isFeedSectionInView"
      class="lg:hidden fixed inset-x-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]"
      style="bottom: 0;"
    >
      <div class="mx-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800">
        <div class="flex items-center gap-2 px-3 py-2.5">
          <button
            type="button"
            class="min-w-0 inline-flex items-center gap-2 px-1 py-0.5 text-left"
            :aria-expanded="mobileMenuOpen"
            @click="mobileMenuOpen = !mobileMenuOpen"
          >
            <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
              <UIcon name="lucide:sparkles" class="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
            </div>
            <span class="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {{ t('app.feedMenu') || 'Feed menu' }}
            </span>
            <UIcon
              name="lucide:chevron-up"
              class="h-4 w-4 text-gray-400 transition-transform dark:text-gray-500"
              :class="mobileMenuOpen ? 'rotate-180' : ''"
            />
          </button>

          <button
            type="button"
            class="ml-auto relative z-10 inline-flex h-9 min-w-[2.5rem] items-center justify-center rounded-lg border border-blue-100 bg-blue-50/60 px-2 text-blue-600 transition hover:bg-blue-100/70 dark:border-gray-700 dark:bg-gray-700/60 dark:text-blue-300"
            :aria-label="t('app.scrollToTop') || 'Scroll to top'"
            @click="handleScrollTopTap"
            @touchstart.prevent.stop="handleScrollTopTap"
            @pointerdown.prevent.stop="handleScrollTopTap"
          >
            <UIcon name="lucide:arrow-up" class="h-4 w-4" />
          </button>
        </div>

        <Transition name="mobile-sheet">
          <div v-if="mobileMenuOpen" class="space-y-4 border-t border-gray-200 px-4 py-4 dark:border-gray-700 max-h-[70vh] overflow-y-auto">
            <div class="rounded-2xl border border-gray-200 bg-gray-50 p-2.5 dark:border-gray-700 dark:bg-gray-700/40">
              <div class="relative">
                <UIcon
                  name="lucide:search"
                  class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                />
                <input
                  :value="props.articlesSearch"
                  type="text"
                  :placeholder="t('app.searchArticles') || 'Search articles'"
                  class="w-full rounded-xl border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-800 outline-none transition focus:border-emerald-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  @input="handleSearchInput"
                />
              </div>
            </div>

            <div v-if="props.popularTags.length" class="pt-1">
              <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {{ t('app.popularTags') || 'Popular tags' }}
              </p>
              <div class="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  class="rounded-lg border px-2 py-1 text-xs transition"
                  :class="props.selectedTag === ''
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                    : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-emerald-200 dark:border-gray-600 dark:bg-gray-700/60 dark:text-gray-200'"
                  @click="selectTag('')"
                >
                  {{ t('app.all') || 'All' }}
                </button>
                <button
                  v-for="tag in props.popularTags"
                  :key="tag"
                  type="button"
                  class="rounded-lg border px-2 py-1 text-xs transition"
                  :class="props.selectedTag === tag
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                    : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-emerald-200 dark:border-gray-600 dark:bg-gray-700/60 dark:text-gray-200'"
                  @click="selectTag(tag)"
                >
                  #{{ tag }}
                </button>
              </div>
            </div>

            <div class="flex flex-col min-h-0 max-h-72 pt-1">
              <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {{ t('app.whatsNew') || "What's New" }}
              </p>

              <div v-if="props.whatsNewPosts.length" class="whats-new-scroll flex-1 overflow-y-auto space-y-1.5 pr-2">
                <button
                  v-for="post in props.whatsNewPosts"
                  :key="`mobile-${post.id}`"
                  type="button"
                  class="group w-full text-left rounded-lg border border-gray-200 bg-white p-2.5 transition-all hover:border-emerald-300 hover:shadow-sm dark:border-gray-700 dark:bg-gray-700/40 dark:hover:border-emerald-600"
                  @click="emit('open', post)"
                >
                  <div class="flex items-start gap-2.5">
                    <img
                      :src="post.image"
                      :alt="post.imageAlt"
                      class="h-12 w-12 flex-shrink-0 rounded-lg object-cover"
                      loading="lazy"
                    />

                    <div class="min-w-0 flex-1">
                      <p class="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                        {{ post.publishedAt }}
                      </p>
                      <p class="mt-0.5 text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                        {{ post.title }}
                      </p>
                      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ post.readTime }}</p>
                    </div>
                  </div>
                </button>
              </div>

              <p v-else class="text-sm text-gray-500 dark:text-gray-400">
                {{ t('app.noUpdatesForCurrentFilters') || 'No updates for current filters.' }}
              </p>
            </div>
          </div>
        </Transition>
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

.whats-new-scroll {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.whats-new-scroll::-webkit-scrollbar {
  width: 0;
  height: 0;
}

.whats-new-scroll:hover {
  scrollbar-width: thin;
}

.whats-new-scroll:hover::-webkit-scrollbar {
  width: 6px;
}

.whats-new-scroll:hover::-webkit-scrollbar-track {
  background: transparent;
}

.whats-new-scroll:hover::-webkit-scrollbar-thumb {
  border-radius: 9999px;
  background: rgb(209 213 219);
}

:global(.dark) .whats-new-scroll:hover::-webkit-scrollbar-thumb {
  background: rgb(75 85 99);
}
</style>
