<script lang="ts" setup>
import AttendanceStatsTable from '@/components/atrace/AttendanceStatsTable.vue';
import { useI18n } from '@/composables/useI18n';

defineProps<{
  selectedPostId: string | null;
  selectedPostTitle: string;
  selectedPostLocationLine: string;
  loading: boolean;
  error: string | null;
}>();

const emit = defineEmits<{
  (e: 'create'): void;
}>();

const { t } = useI18n();
</script>

<template>
  <div class="hidden md:flex justify-between items-center mb-5 mt-5 px-4 flex-shrink-0">
    <div class="text-left">
      <h2 class="text-lg font-medium">
        {{ t('app.attendance') }} —
        {{ selectedPostId === '' ? (t('app.allLocations') || 'All locations') : selectedPostTitle }}
      </h2>
      <span v-if="selectedPostId !== ''">{{ selectedPostLocationLine }}</span>
    </div>
  </div>

  <div
    v-if="selectedPostId !== null"
    class="flex-1 px-4 pb-safe-or-4"
  >
    <AttendanceStatsTable
      :post-id="selectedPostId"
      :ready="!loading && !error"
    />
  </div>
  <div
    v-else
    class="flex-1 h-full px-4 pb-safe-or-4 flex flex-col items-center justify-center"
  >
    <div class="max-w-sm w-full bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-6 flex flex-col items-center border border-gray-200 dark:border-gray-800">
      <div class="mb-3 flex flex-col items-center">
        <UIcon
          name="i-heroicons-map-pin"
          class="w-12 h-12 text-emerald-400 dark:text-emerald-300 mb-2"
        />
        <h2 class="text-xl font-bold text-center mb-1 text-gray-900 dark:text-white">
          {{ t('app.noPostsTitle') || 'No locations yet' }}
        </h2>
        <p class="text-sm text-gray-600 dark:text-gray-400 text-center mb-3">
          {{ t('app.noPostsDesc') || 'Add your first location to start tracking attendance.' }}
        </p>
      </div>
      <UButton
        data-tour="create-post-btn-empty"
        color="primary"
        size="md"
        class="w-full"
        @click="emit('create')"
      >
        {{ t('app.atraceAddLocation') || 'Add Location' }}
      </UButton>
    </div>
  </div>
</template>
