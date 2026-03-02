<script setup lang="ts">
import { ref } from 'vue';
import type { ClientEvent } from '@/api/contacts/events';
import { getEventDescription, getEventIcon } from '@/api/contacts/events';

interface Props {
  events: ClientEvent[];
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
});

const timelineScrollRef = ref<HTMLElement | null>(null);
const isTimelineAtTop = ref(true);
const { t } = useI18n();

function handleTimelineScroll() {
  if (timelineScrollRef.value) {
    isTimelineAtTop.value = timelineScrollRef.value.scrollTop <= 0;
  }
}

function scrollTimelineToTop() {
  if (timelineScrollRef.value) {
    timelineScrollRef.value.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }
}

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden sticky top-6">
    <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <UIcon name="i-heroicons-clock" class="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
          История
        </h2>
      </div>
      <UButton
        v-if="events.length > 0 && !isTimelineAtTop"
        icon="i-heroicons-arrow-up-20-solid"
        size="xs"
        color="gray"
        variant="ghost"
        @click="scrollTimelineToTop"
      />
    </div>
    <div ref="timelineScrollRef" class="px-5 py-4 max-h-[calc(100vh-200px)] overflow-y-auto" @scroll="handleTimelineScroll">
      <div v-if="events.length > 0" class="space-y-4">
        <div v-for="(event, index) in events" :key="event.id" class="relative">
          <!-- Timeline line -->
          <div v-if="index < events.length - 1" 
            class="absolute left-4 top-8 bottom-0 w-px bg-gray-200 dark:bg-gray-700"></div>
          <!-- Event item -->
          <div class="flex gap-3">
            <div class="flex-shrink-0">
              <div class="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 ring-4 ring-white dark:ring-gray-800">
                <UIcon :name="getEventIcon(event.eventType)" class="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div class="flex-1 min-w-0 pb-4">
              <p class="text-sm font-medium text-gray-900 dark:text-white">
                {{ getEventDescription(event.eventType) }}
              </p>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {{ formatDate(event.createdAt) }}
              </p>
            </div>
          </div>
        </div>
      </div>
      <div v-else>
        <p class="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
          Нет истории событий
        </p>
      </div>
    </div>
  </div>
</template>
