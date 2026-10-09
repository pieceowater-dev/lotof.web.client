<script lang="ts" setup>
import AttendanceStatsTable from '@/components/atrace/AttendanceStatsTable.vue';
import AttendanceAnalytics from '@/components/atrace/AttendanceAnalytics.vue';
import { useI18n } from '@/composables/useI18n';
import { useRoute } from 'vue-router';
import { useAtracePermissions } from '@/composables/useAtracePermissions';

const props = defineProps<{
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
// useAtracePermissions is lazy -- nothing populates `allowed` until
// loadPermissions() is actually called.
const nsSlug = computed(() => (route.params.namespace as string) || '');
const { can: canDo, loadPermissions } = useAtracePermissions(nsSlug);
const canManageAttendance = computed(() => canDo('tracker.attendance.manage'));

// Drive the permission fetch off `props.loading` rather than onMounted: on a
// hard refresh the atrace token is already in the cookie, but on client-side
// nav from the home page it is still being minted when this mounts, so an
// onMounted call raced it and silently came back empty -- the toggle then
// only showed after a manual refresh. The parent clears `loading` once it has
// fetched posts, which means the atrace token is warm; re-run if the
// namespace changes too.
watch(
  [() => props.loading, nsSlug],
  ([loading, ns]) => {
    if (!loading && ns) loadPermissions();
  },
  { immediate: true },
);

const view = ref<'table' | 'analytics'>('table');
</script>

<template>
  <div class="hidden md:flex justify-between items-center mb-2 mt-1 px-4 flex-shrink-0 gap-3">
    <div class="text-left min-w-0">
      <h2 class="at-h2 truncate">
        {{ t('app.attendance') }} —
        {{ selectedPostId === '' ? (t('app.allLocations') || 'All locations') : selectedPostTitle }}
      </h2>
      <span
        v-if="selectedPostId !== ''"
        class="text-xs text-gray-400"
      >{{ selectedPostLocationLine }}</span>
    </div>
    <div
      v-if="selectedPostId !== null && canManageAttendance"
      class="pl-toggle flex-shrink-0"
    >
      <button
        class="pl-toggle__btn !px-5 !py-1.5"
        :class="view === 'table' ? 'pl-toggle__btn--on' : ''"
        @click="view = 'table'"
      >
        {{ t('app.analyticsViewTable') || 'Таблица' }}
      </button>
      <button
        class="pl-toggle__btn !px-5 !py-1.5"
        :class="view === 'analytics' ? 'pl-toggle__btn--on' : ''"
        @click="view = 'analytics'"
      >
        {{ t('app.analyticsViewAnalytics') || 'Аналитика' }}
      </button>
    </div>
  </div>

  <div
    v-if="selectedPostId !== null"
    class="flex-1 px-4 pb-safe-or-4 flex flex-col min-h-0"
  >
    <div
      v-if="canManageAttendance"
      class="pl-toggle flex-shrink-0 mb-2 self-start md:!hidden"
    >
      <button
        class="pl-toggle__btn !px-5 !py-1.5"
        :class="view === 'table' ? 'pl-toggle__btn--on' : ''"
        @click="view = 'table'"
      >
        {{ t('app.analyticsViewTable') || 'Таблица' }}
      </button>
      <button
        class="pl-toggle__btn !px-5 !py-1.5"
        :class="view === 'analytics' ? 'pl-toggle__btn--on' : ''"
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
    <div class="at-empty at-panel">
      <div class="mb-3 flex flex-col items-center">
        <UIcon
          name="i-heroicons-map-pin"
          class="w-12 h-12 text-blue-500 dark:text-blue-300 mb-2"
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
        class="w-full rounded-full"
        @click="emit('create')"
      >
        {{ t('app.atraceAddLocation') || 'Add Location' }}
      </UButton>
    </div>
  </div>
</template>
