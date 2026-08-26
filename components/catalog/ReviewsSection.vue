<script setup lang="ts">
import type { MockReview } from '@/utils/mockCatalog';
import { useI18n } from '@/composables/useI18n';

// No mock fallback here (unlike BusinessCard's mock-fallback pattern) --
// real reviews barely exist yet, and showing fabricated ones next to real
// businesses would be misleading. Empty means empty.
withDefaults(defineProps<{ reviews?: MockReview[] }>(), {
  reviews: () => [],
});

const { t } = useI18n();
</script>

<template>
  <div v-if="reviews.length > 0">
    <h3 class="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
      {{ t('home.reviewsHeading') || 'Отзывы' }}
    </h3>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div
        v-for="review in reviews"
        :key="review.key"
        class="rounded-2xl p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="flex-shrink-0 w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-sm font-semibold text-gray-600 dark:text-gray-300">
              {{ review.author.charAt(0) }}
            </span>
            <div class="min-w-0">
              <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{{ review.author }}</p>
              <p class="text-xs text-gray-400 dark:text-gray-500 truncate">{{ review.date }}</p>
            </div>
          </div>
          <div class="flex-shrink-0 flex items-center gap-0.5">
            <UIcon
              v-for="i in 5"
              :key="i"
              name="lucide:star"
              class="w-3.5 h-3.5"
              :class="i <= review.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200 dark:text-gray-700'"
            />
          </div>
        </div>
        <div class="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700">
          <UIcon name="lucide:store" class="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
          <span class="text-xs font-medium text-gray-700 dark:text-gray-200">{{ review.business }}</span>
        </div>
        <p class="mt-3 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{{ review.text }}</p>
      </div>
    </div>
  </div>
</template>
