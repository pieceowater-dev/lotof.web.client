<script lang="ts" setup>
import Card from '@/components/Card.vue';
import { useI18n } from '@/composables/useI18n';
import type { Post } from '@/types/atrace';

const props = defineProps<{
  posts: Post[];
  showSkeletons: boolean;
  loadingMore: boolean;
  selectedPostId: string | null;
}>();

const emit = defineEmits<{
  (e: 'select', postId: string): void;
  (e: 'edit', post: Post): void;
  (e: 'create'): void;
  (e: 'load-more'): void;
}>();

const { t } = useI18n();

// Horizontal scroll container and sentinel for IntersectionObserver-driven
// infinite scroll. Owned locally since the observer is inherently bound to
// this component's DOM; actual page-loading logic lives in the caller
// (useAtracePosts) and is triggered via the load-more event.
const cardsScrollRef = ref<HTMLElement | null>(null);
const cardsSentinelRef = ref<HTMLElement | null>(null);
let cardsObserver: IntersectionObserver | null = null;

function setupCardsObserver() {
  if (!process.client) return;
  if (cardsObserver) {
    try { cardsObserver.disconnect(); } catch {}
    cardsObserver = null;
  }
  const root = cardsScrollRef.value || undefined;
  const target = cardsSentinelRef.value || undefined;
  if (!root || !target) return;
  cardsObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        emit('load-more');
      }
    }
  }, {
    root,
    threshold: 0.1,
    // Preload a bit earlier on the right edge
    rootMargin: '0px 256px 0px 0px'
  });
  cardsObserver.observe(target);
}

// The sentinel only exists in the DOM once skeletons are gone, so re-arm
// the observer whenever that transition happens.
watch(() => props.showSkeletons, (skeletons) => {
  if (!skeletons) nextTick(setupCardsObserver);
});

onMounted(() => {
  if (!props.showSkeletons) setupCardsObserver();
});

onBeforeUnmount(() => {
  if (cardsObserver) {
    try { cardsObserver.disconnect(); } catch {}
    cardsObserver = null;
  }
});
</script>

<template>
  <div
    ref="cardsScrollRef"
    class="hidden md:block overflow-x-auto whitespace-nowrap py-4 px-4 flex-shrink-0"
    data-tour="posts-list"
  >
    <div class="inline-flex space-x-4 items-stretch">
      <template v-if="showSkeletons">
        <div
          v-for="i in 5"
          :key="`skeleton-${i}`"
          class="p-4 rounded-xl w-60 max-w-[90vw] sm:max-w-xs flex-shrink-0 min-h-[100px] self-stretch flex flex-col border border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-gray-900/60"
        >
          <div class="flex items-center gap-2 mb-2">
            <USkeleton class="h-5 w-3/4" />
            <USkeleton class="h-5 w-16" />
          </div>
          <USkeleton class="h-4 w-5/6" />
          <div class="flex-1" />
          <div class="mt-1 h-5">
            <USkeleton class="h-3 w-1/2" />
          </div>
        </div>
      </template>
      <template v-else>
        <!-- "All" card - shows common stats, only if there are posts -->
        <Card
          v-if="posts.length > 0"
          :post="{ id: '', title: t('app.allLocations') || 'All locations', description: t('app.allLocationsDesc') || 'Employee attendance across all locations' }"
          :selected="selectedPostId === ''"
          :can-delete="false"
          @select="() => emit('select', '')"
        />

        <div
          v-for="post in posts"
          :key="post.id"
        >
          <Card
            :post="post"
            :selected="post.id === selectedPostId"
            :can-delete="false"
            @select="() => emit('select', post.id)"
            @edit="() => emit('edit', post)"
          />
        </div>
        <button
          data-tour="create-post-btn"
          class="bg-gradient-to-r from-emerald-400 to-emerald-600 dark:from-emerald-900 dark:to-emerald-700 text-white shadow-lg p-4 rounded-xl w-60 min-h-[100px] flex items-center justify-center cursor-pointer hover:shadow-xl hover:from-emerald-500 hover:to-emerald-700 dark:hover:from-emerald-800 dark:hover:to-emerald-600 transition-all duration-200 flex-shrink-0"
          @click="emit('create')"
        >
          {{ t('app.atraceAddLocation') }}
        </button>
        <!-- Loading more indicator -->
        <div
          v-if="loadingMore"
          class="flex items-center justify-center w-20 text-gray-500"
        >
          …
        </div>
        <!-- Sentinel element to trigger infinite scroll -->
        <div
          ref="cardsSentinelRef"
          class="w-1 h-1"
        />
      </template>
    </div>
  </div>
</template>

<style scoped>
/* Custom scrollbar for timeline */
.scrollbar-thin {
  scrollbar-width: thin;
  scrollbar-color: rgb(209, 213, 219) transparent;
}

.dark .scrollbar-thin {
  scrollbar-color: rgb(55, 65, 81) transparent;
}

.scrollbar-thin::-webkit-scrollbar {
  height: 6px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background-color: rgb(209, 213, 219);
  border-radius: 3px;
}

.dark .scrollbar-thin::-webkit-scrollbar-thumb {
  background-color: rgb(55, 65, 81);
}

.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background-color: rgb(156, 163, 175);
}

.dark .scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background-color: rgb(75, 85, 99);
}
</style>
