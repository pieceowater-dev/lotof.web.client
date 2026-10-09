<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import type { HomeFeedPost } from '@/components/ui/HomePostsFeed.vue';

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
      <div class="catalog-panel mb-5 overflow-hidden p-4">
        <div class="relative">
          <UIcon
            name="lucide:search"
            class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          />
          <input
            :value="props.articlesSearch"
            type="text"
            :placeholder="t('app.searchArticles') || 'Search articles'"
            :aria-label="t('app.searchArticles') || 'Search articles'"
            class="fd-search"
            @input="handleSearchInput"
          />
        </div>

        <div v-if="props.popularTags.length" class="mt-4">
          <p class="sf-label mb-2">{{ t('app.popularTags') || 'Popular tags' }}</p>
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="pill-filter !px-3 !py-1 !text-xs"
              :class="props.selectedTag === ''
                ? 'pill-filter--active'
                : ''"
              @click="selectTag('')"
            >
              {{ t('app.all') || 'All' }}
            </button>
            <button
              v-for="tag in props.popularTags"
              :key="tag"
              type="button"
              class="pill-filter !px-3 !py-1 !text-xs"
              :class="props.selectedTag === tag
                ? 'pill-filter--active'
                : ''"
              @click="selectTag(tag)"
            >
              #{{ tag }}
            </button>
          </div>
        </div>

        <div class="mt-4 flex items-center justify-between">
          <div class="flex items-center gap-0.5">
            <UTooltip text="Instagram">
              <UButton to="https://www.instagram.com/lota_tools" target="_blank" rel="noopener noreferrer" variant="ghost" color="gray" size="xs" square aria-label="Instagram">
                <UIcon name="simple-icons:instagram" class="w-3 h-3" />
              </UButton>
            </UTooltip>
            <UTooltip text="Threads">
              <UButton to="https://www.threads.com/@lota_tools" target="_blank" rel="noopener noreferrer" variant="ghost" color="gray" size="xs" square aria-label="Threads">
                <UIcon name="simple-icons:threads" class="w-3 h-3" />
              </UButton>
            </UTooltip>
            <UTooltip text="X">
              <UButton to="https://x.com/lota_tools" target="_blank" rel="noopener noreferrer" variant="ghost" color="gray" size="xs" square aria-label="X">
                <UIcon name="simple-icons:x" class="w-3 h-3" />
              </UButton>
            </UTooltip>
          </div>
          <button
            type="button"
            class="pill-filter !px-3 !py-1.5 !text-xs"
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

      <div v-if="props.whatsNewPosts.length > 0" class="catalog-panel flex h-[clamp(16rem,38vh,26rem)] min-h-0 flex-col overflow-hidden p-5">
        <div class="mb-5 flex items-center gap-2">
          <div class="icon-tile !h-9 !w-9 !rounded-xl">
            <UIcon name="lucide:sparkles" class="h-4 w-4" />
          </div>
          <h3 class="text-base font-extrabold tracking-tight text-gray-900 dark:text-gray-100">{{ t('app.whatsNew') || "What's New" }}</h3>
        </div>

        <div v-if="props.whatsNewPosts.length" class="whats-new-scroll min-h-0 flex-1 overflow-y-auto space-y-2.5 pr-2">
          <button
            v-for="post in props.whatsNewPosts"
            :key="post.id"
            type="button"
            class="gw-row group !items-start"
            @click="emit('open', post)"
          >
            <div class="flex items-start gap-3">
              <img v-if="post.image"
                :src="post.image"
                :alt="post.imageAlt"
                class="h-14 w-14 flex-shrink-0 rounded-2xl object-cover ring-1 ring-black/5 dark:ring-white/10"
                loading="lazy"
              />
              <span v-else class="gw-row-icon h-14 w-14 !rounded-2xl"><UIcon name="lucide:newspaper" class="h-5 w-5" /></span>

              <div class="min-w-0 flex-1">
                <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{{ post.publishedAt }}</p>
                <p class="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-gray-900 transition-colors group-hover:text-blue-600 dark:text-gray-100 dark:group-hover:text-blue-300">{{ post.title }}</p>
                <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{{ post.readTime }}</p>
              </div>
            </div>
          </button>
        </div>

        <p v-else class="text-sm text-gray-500 dark:text-gray-400">
          {{ t('app.noUpdatesForCurrentFilters') || 'No updates for current filters.' }}
        </p>

        <div class="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center gap-0.5">
          <UTooltip text="Instagram">
            <UButton to="https://www.instagram.com/lota_tools" target="_blank" rel="noopener noreferrer" variant="ghost" color="gray" size="xs" square aria-label="Instagram">
              <UIcon name="simple-icons:instagram" class="w-3 h-3" />
            </UButton>
          </UTooltip>
          <UTooltip text="Threads">
            <UButton to="https://www.threads.com/@lota_tools" target="_blank" rel="noopener noreferrer" variant="ghost" color="gray" size="xs" square aria-label="Threads">
              <UIcon name="simple-icons:threads" class="w-3 h-3" />
            </UButton>
          </UTooltip>
          <UTooltip text="X">
            <UButton to="https://x.com/lota_tools" target="_blank" rel="noopener noreferrer" variant="ghost" color="gray" size="xs" square aria-label="X">
              <UIcon name="simple-icons:x" class="w-3 h-3" />
            </UButton>
          </UTooltip>
        </div>
      </div>
    </aside>

    <div
      v-if="props.isMobileViewport && props.isFeedSectionInView"
      class="lg:hidden fixed inset-x-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]"
      style="bottom: 0;"
    >
      <!-- blur strip below the floating widget -->
      <div class="fixed bottom-0 left-0 right-0 h-[max(env(safe-area-inset-bottom),0.75rem)] backdrop-blur-sm pointer-events-none" />
      <div class="hdr-shell mx-auto w-full max-w-md !rounded-3xl bg-white/95 dark:bg-[#1a1a1a]/95">
        <div class="flex h-[42px] items-center gap-2 px-4">
          <div class="icon-tile !h-7 !w-7 !rounded-lg">
            <UIcon name="lucide:sparkles" class="h-4 w-4" />
          </div>
          <button
            type="button"
            class="min-w-0 inline-flex items-center gap-2 px-1 text-left"
            :aria-expanded="mobileMenuOpen"
            @click="mobileMenuOpen = !mobileMenuOpen"
          >
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
            class="gw-icon-btn ml-auto relative z-10 !h-8 !w-8"
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
            <div class="rounded-2xl bg-gray-900/[0.04] p-2.5 dark:bg-white/[0.06]">
              <div class="relative">
                <UIcon
                  name="lucide:search"
                  class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                />
                <input
                  :value="props.articlesSearch"
                  type="text"
                  :placeholder="t('app.searchArticles') || 'Search articles'"
                  :aria-label="t('app.searchArticles') || 'Search articles'"
                  class="fd-search"
                  @input="handleSearchInput"
                />
              </div>
            </div>

            <div v-if="props.popularTags.length" class="pt-1">
              <p class="sf-label mb-2">
                {{ t('app.popularTags') || 'Popular tags' }}
              </p>
              <div class="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  class="pill-filter !px-3 !py-1 !text-xs"
                  :class="props.selectedTag === ''
                    ? 'pill-filter--active'
                    : ''"
                  @click="selectTag('')"
                >
                  {{ t('app.all') || 'All' }}
                </button>
                <button
                  v-for="tag in props.popularTags"
                  :key="tag"
                  type="button"
                  class="pill-filter !px-3 !py-1 !text-xs"
                  :class="props.selectedTag === tag
                    ? 'pill-filter--active'
                    : ''"
                  @click="selectTag(tag)"
                >
                  #{{ tag }}
                </button>
              </div>
            </div>

            <div v-if="props.whatsNewPosts.length > 0" class="flex flex-col min-h-0 max-h-72 pt-1">
              <p class="sf-label mb-2">
                {{ t('app.whatsNew') || "What's New" }}
              </p>

              <div v-if="props.whatsNewPosts.length" class="whats-new-scroll flex-1 overflow-y-auto space-y-1.5 pr-2">
                <button
                  v-for="post in props.whatsNewPosts"
                  :key="`mobile-${post.id}`"
                  type="button"
                  class="gw-row group !items-start !p-2.5"
                  @click="emit('open', post)"
                >
                  <div class="flex items-start gap-2.5">
                    <img v-if="post.image"
                      :src="post.image"
                      :alt="post.imageAlt"
                      class="h-12 w-12 flex-shrink-0 rounded-xl object-cover"
                      loading="lazy"
                    />
              <span v-else class="gw-row-icon h-12 w-12 !rounded-2xl"><UIcon name="lucide:newspaper" class="h-5 w-5" /></span>

                    <div class="min-w-0 flex-1">
                      <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                        {{ post.publishedAt }}
                      </p>
                      <p class="mt-0.5 line-clamp-2 text-sm font-semibold text-gray-900 group-hover:text-blue-600 dark:text-gray-100 dark:group-hover:text-blue-300">
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

            <div class="pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center gap-0.5">
              <UTooltip text="Instagram">
                <UButton to="https://www.instagram.com/lota_tools" target="_blank" rel="noopener noreferrer" variant="ghost" color="gray" size="xs" square aria-label="Instagram">
                  <UIcon name="simple-icons:instagram" class="w-3 h-3" />
                </UButton>
              </UTooltip>
              <UTooltip text="Threads">
                <UButton to="https://www.threads.com/@lota_tools" target="_blank" rel="noopener noreferrer" variant="ghost" color="gray" size="xs" square aria-label="Threads">
                  <UIcon name="simple-icons:threads" class="w-3 h-3" />
                </UButton>
              </UTooltip>
              <UTooltip text="X">
                <UButton to="https://x.com/lota_tools" target="_blank" rel="noopener noreferrer" variant="ghost" color="gray" size="xs" square aria-label="X">
                  <UIcon name="simple-icons:x" class="w-3 h-3" />
                </UButton>
              </UTooltip>
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
