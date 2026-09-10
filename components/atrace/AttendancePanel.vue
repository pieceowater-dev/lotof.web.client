<script lang="ts" setup>
import AttendanceStatsTable from '@/components/atrace/AttendanceStatsTable.vue';
import AttendanceAnalytics from '@/components/atrace/AttendanceAnalytics.vue';
import { useI18n } from '@/composables/useI18n';
import { useRoute } from 'vue-router';
import { useAtracePermissions } from '@/composables/useAtracePermissions';

defineProps<{
  selectedPostId: string | null;
  selectedPostTitle: string;
  selectedPostLocationLine: string;
  loading: boolean;
  error: string | null;
  canCreate?: boolean;
}>();

const emit = defineEmits<{
  (e: 'create'): void;
}>();

const { t } = useI18n();
const route = useRoute();

// Same gate as AttendanceStatsTable's export/settings: attendance/manage is
// what a Manager/Admin/Owner has and a Teammate doesn't -- so the Analytics
// view (namespace-wide, other people's patterns) is exactly this audience.
const { can: canDo } = useAtracePermissions(computed(() => (route.params.namespace as string) || ''));
const canManageAttendance = computed(() => canDo('tracker.attendance.manage'));

const view = ref<'table' | 'analytics'>('table');
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
    class="flex-1 px-4 pb-safe-or-4 flex flex-col min-h-0"
  >
    <div
      v-if="canManageAttendance"
      class="flex-shrink-0 mb-3 inline-flex self-start rounded-lg bg-gray-100 dark:bg-gray-800 p-0.5 text-sm"
    >
      <button
        class="px-3 py-1.5 rounded-md transition-colors"
        :class="view === 'table' ? 'bg-white dark:bg-gray-900 shadow-sm font-medium' : 'text-gray-500 dark:text-gray-400'"
        @click="view = 'table'"
      >
        {{ t('app.analyticsViewTable') || 'Таблица' }}
      </button>
      <button
        class="px-3 py-1.5 rounded-md transition-colors"
        :class="view === 'analytics' ? 'bg-white dark:bg-gray-900 shadow-sm font-medium' : 'text-gray-500 dark:text-gray-400'"
        @click="view = 'analytics'"
      >
        {{ t('app.analyticsViewAnalytics') || 'Аналитика' }}
      </button>
    </div>

    <div class="flex-1 min-h-0">
      <AttendanceAnalytics
        v-if="view === 'analytics' && canManageAttendance"
        :post-id="selectedPostId"
        :ready="!loading && !error"
      />
      <AttendanceStatsTable
        v-else
        :post-id="selectedPostId"
        :ready="!loading && !error"
      />
    </div>
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
        v-if="canCreate"
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
