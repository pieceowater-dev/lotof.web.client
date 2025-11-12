<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import PostRecordsDetails from '@/components/atrace/PostRecordsDetails.vue';

const { t } = useI18n();

const props = defineProps<{
  postId: string | null;
}>();

type UserStats = {
  userId: string;
  username?: string;
  email?: string;
  workDays: number;
  attendedDays: number;
  violationDays: number;
  legitimateAbsences: number;
  totalWorkedHours: number;
};

const stats = ref<UserStats[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

// Date filter state
type PeriodType = 'month' | 'week' | '3months' | 'custom';
const selectedPeriod = ref<PeriodType>('month');
const customStartDate = ref('');
const customEndDate = ref('');
const showDateModal = ref(false);
const dateModalError = ref<string | null>(null);
const isStartInvalid = computed(() => {
  if (!showDateModal.value) return false;
  if (!customStartDate.value) return false;
  const d = new Date(customStartDate.value);
  return isNaN(d.getTime());
});
const isEndInvalid = computed(() => {
  if (!showDateModal.value) return false;
  if (!customEndDate.value) return false;
  const d = new Date(customEndDate.value);
  return isNaN(d.getTime());
});
const hasRangeOrderIssue = computed(() => {
  if (!customStartDate.value || !customEndDate.value) return false;
  const s = new Date(customStartDate.value);
  const e = new Date(customEndDate.value);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return false;
  return s > e;
});
const canApplyRange = computed(() => {
  if (!customStartDate.value || !customEndDate.value) return false;
  if (isStartInvalid.value || isEndInvalid.value || hasRangeOrderIssue.value) return false;
  return true;
});

// Accordion state - track expanded user IDs
const expandedUserIds = ref<Set<string>>(new Set());

// Calculate date range based on selected period
const dateRange = computed(() => {
  const today = new Date();
  let startDate: Date;
  let endDate = today;

  switch (selectedPeriod.value) {
    case 'month':
      // From 1st of current month to today
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      break;
    case 'week':
      // From Monday of current week to today
      const dayOfWeek = today.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Monday is 1
      startDate = new Date(today);
      startDate.setDate(today.getDate() + diff);
      break;
    case '3months':
      // 3 months ago to today
      startDate = new Date(today);
      startDate.setMonth(today.getMonth() - 3);
      break;
    case 'custom':
      if (!customStartDate.value || !customEndDate.value) {
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      } else {
        startDate = new Date(customStartDate.value);
        endDate = new Date(customEndDate.value);
      }
      break;
    default:
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  };
});

async function loadStats() {
  if (!props.postId) return;
  
  loading.value = true;
  error.value = null;
  
  try {
    const { atraceGetAllUsersStats } = await import('@/api/atrace/attendance/stats');
    const result = await atraceGetAllUsersStats(
      dateRange.value.startDate,
      dateRange.value.endDate
    );
    stats.value = result;
  } catch (e: any) {
    // Permission error handling
    const permissionError =
      e?.response?.errors?.some((err: any) =>
        String(err?.message || '').includes('missing permission tracker.attendance.view')
      );
    const unauthorizedError =
      e?.response?.errors?.some((err: any) =>
        String(err?.message || '').includes('unauthorized: token is missing for key "AtraceAuthorization"')
      );
    if (permissionError) {
      error.value = t('app.attendancePermissionError');
    } else if (unauthorizedError) {
      error.value = t('app.attendanceUnauthorizedError');
    } else {
      error.value = t('app.attendanceLoadFailed');
    }
    stats.value = [];
  } finally {
    loading.value = false;
  }
}

function toggleUserDetails(userId: string) {
  if (expandedUserIds.value.has(userId)) {
    expandedUserIds.value.delete(userId);
  } else {
    expandedUserIds.value.add(userId);
  }
  // Trigger reactivity
  expandedUserIds.value = new Set(expandedUserIds.value);
}

function isExpanded(userId: string): boolean {
  return expandedUserIds.value.has(userId);
}

function openCustomRange() {
  selectedPeriod.value = 'custom';
  showDateModal.value = true;
  dateModalError.value = null;
}

function applyCustomRange() {
  dateModalError.value = null;
  if (!canApplyRange.value) {
    dateModalError.value = t('app.invalidDateRange');
    return;
  }
  showDateModal.value = false;
  loadStats();
}

function formatDateYMD(d: Date) {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    .toISOString()
    .split('T')[0];
}

function startOfWeek(d: Date) {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday is 1
  const s = new Date(d);
  s.setDate(d.getDate() + diff);
  return s;
}

function applyPreset(preset: 'today' | 'yesterday' | 'thisWeek' | 'last7' | 'last30') {
  const today = new Date();
  let start = new Date(today);
  let end = new Date(today);

  switch (preset) {
    case 'today':
      // start/end already today
      break;
    case 'yesterday':
      start.setDate(today.getDate() - 1);
      end.setDate(today.getDate() - 1);
      break;
    case 'thisWeek':
      start = startOfWeek(today);
      break;
    case 'last7':
      start.setDate(today.getDate() - 6);
      break;
    case 'last30':
      start.setDate(today.getDate() - 29);
      break;
  }

  selectedPeriod.value = 'custom';
  customStartDate.value = formatDateYMD(start);
  customEndDate.value = formatDateYMD(end);
  dateModalError.value = null;
}

// Watch for period changes (custom range loads only on apply)
watch(selectedPeriod, () => {
  if (selectedPeriod.value !== 'custom') {
    loadStats();
  }
});

// Watch for postId changes
watch(() => props.postId, (newVal) => {
  if (newVal) {
    loadStats();
  }
}, { immediate: true });
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden">
    <!-- Period Filter -->
  <div class="flex gap-2 mb-4 flex-shrink-0">
      <UButton 
        :color="selectedPeriod === 'month' ? 'primary' : 'gray'" 
        size="sm"
        @click="selectedPeriod = 'month'"
      >
  {{ t('app.thisMonth') }}
      </UButton>
      <UButton 
        :color="selectedPeriod === 'week' ? 'primary' : 'gray'" 
        size="sm"
        @click="selectedPeriod = 'week'"
      >
  {{ t('app.thisWeek') }}
      </UButton>
      <UButton 
        :color="selectedPeriod === '3months' ? 'primary' : 'gray'" 
        size="sm"
        @click="selectedPeriod = '3months'"
      >
  {{ t('app.last3Months') }}
      </UButton>
      <UButton 
        :color="selectedPeriod === 'custom' ? 'primary' : 'gray'" 
        size="sm"
  @click="openCustomRange()"
      >
        {{ t('app.customPeriod') }}
      </UButton>
    </div>


    <!-- Stats Table -->
    <div class="flex-1 min-h-0 overflow-auto">
      <div v-if="loading" class="flex flex-col items-center justify-center py-8">
        <UIcon name="i-heroicons-arrow-path" class="w-10 h-10 mb-2 animate-spin text-blue-400 dark:text-blue-300" />
  <div>{{ t('app.loading') }}</div>
      </div>
      <div v-else-if="error" class="flex flex-col items-center justify-center py-8 text-red-500">
        <UIcon name="i-heroicons-lock-closed" class="w-12 h-12 mb-2 text-red-400 dark:text-red-300" />
        <div class="text-lg font-semibold mb-2">{{ error }}</div>
  <div class="text-sm text-gray-500 dark:text-gray-400">{{ t('app.attendancePermissionErrorHint') }}</div>
      </div>
      <div v-else-if="stats.length === 0" class="text-gray-500 py-8 text-center flex flex-col items-center justify-center">
        <UIcon name="i-heroicons-information-circle" class="w-10 h-10 mb-2 text-blue-400 dark:text-blue-300" />
  <div>{{ t('app.noData') }}</div>
      </div>
      <table v-else class="w-full">
        <thead class="bg-gray-100 dark:bg-gray-800 sticky top-0">
          <tr>
            <th class="px-4 py-3 text-left text-sm font-semibold w-8"></th>
            <th class="px-4 py-3 text-left text-sm font-semibold">{{ t('app.user') }}</th>
            <th class="px-4 py-3 text-center text-sm font-semibold">{{ t('app.workDays') }}</th>
            <th class="px-4 py-3 text-center text-sm font-semibold">{{ t('app.attended') }}</th>
            <th class="px-4 py-3 text-center text-sm font-semibold">{{ t('app.violations') }}</th>
            <th class="px-4 py-3 text-center text-sm font-semibold">{{ t('app.exceptions') }}</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="user in stats" :key="user.userId">
            <!-- Main row -->
            <tr 
              class="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
              @click="toggleUserDetails(user.userId)"
            >
              <td class="px-4 py-3 text-center">
                <UIcon 
                  :name="isExpanded(user.userId) ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-right'" 
                  class="w-5 h-5 transition-transform"
                />
              </td>
              <td class="px-4 py-3">
                <div class="font-medium">{{ user.username || user.email || user.userId }}</div>
                <div v-if="user.username && user.email" class="text-xs text-gray-500">{{ user.email }}</div>
              </td>
              <td class="px-4 py-3 text-center">{{ user.workDays }}</td>
              <td class="px-4 py-3 text-center">
                <span class="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100 rounded">
                  {{ user.attendedDays }}
                </span>
              </td>
              <td class="px-4 py-3 text-center">
                <span 
                  v-if="user.violationDays > 0"
                  class="px-2 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-100 rounded"
                >
                  {{ user.violationDays }}
                </span>
                <span v-else class="text-gray-400">0</span>
              </td>
              <td class="px-4 py-3 text-center">
                <span 
                  v-if="user.legitimateAbsences > 0"
                  class="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 rounded"
                >
                  {{ user.legitimateAbsences }}
                </span>
                <span v-else class="text-gray-400">0</span>
              </td>
            </tr>

            <!-- Expanded details row -->
            <tr v-if="isExpanded(user.userId)" class="bg-gray-50 dark:bg-gray-900">
              <td colspan="6" class="px-4 py-4">
                <div class="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                  <h4 class="text-sm font-semibold mb-3">{{ t('app.attendanceDetails') }}</h4>
                  <PostRecordsDetails 
                    v-if="postId"
                    :post-id="postId"
                    :user-id="user.userId"
                    :start-date="dateRange.startDate"
                    :end-date="dateRange.endDate"
                  />
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <!-- Custom Date Range Modal -->
    <UModal v-model="showDateModal">
      <div class="p-0 w-full max-w-lg overflow-hidden rounded-xl shadow-xl border border-gray-200 dark:border-gray-800">
        <div class="px-6 py-4 bg-gray-50 dark:bg-gray-900/40 flex items-center gap-3">
          <UIcon name="i-heroicons-calendar-days" class="w-6 h-6 text-blue-500" />
          <h3 class="text-lg font-semibold">{{ t('app.customRangeTitle') }}</h3>
        </div>

        <div class="px-6 py-5 flex flex-col gap-4 bg-white dark:bg-gray-900">
          <!-- Presets -->
          <div class="flex flex-wrap gap-2">
            <UButton size="xs" variant="soft" color="gray" @click="applyPreset('today')">{{ t('app.datePresetToday') }}</UButton>
            <UButton size="xs" variant="soft" color="gray" @click="applyPreset('yesterday')">{{ t('app.datePresetYesterday') }}</UButton>
            <UButton size="xs" variant="soft" color="gray" @click="applyPreset('thisWeek')">{{ t('app.datePresetThisWeek') }}</UButton>
            <UButton size="xs" variant="soft" color="gray" @click="applyPreset('last7')">{{ t('app.datePresetLast7') }}</UButton>
            <UButton size="xs" variant="soft" color="gray" @click="applyPreset('last30')">{{ t('app.datePresetLast30') }}</UButton>
          </div>

          <!-- Inputs -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="flex flex-col">
              <label class="text-sm mb-1">{{ t('app.startDate') }}</label>
              <div class="relative">
                <UIcon name="i-heroicons-calendar" class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  v-model="customStartDate"
                  type="date"
                  class="w-full pl-9 pr-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700"
                  :class="{ 'border-red-500 focus:ring-red-500': isStartInvalid || hasRangeOrderIssue }"
                />
              </div>
            </div>
            <div class="flex flex-col">
              <label class="text-sm mb-1">{{ t('app.endDate') }}</label>
              <div class="relative">
                <UIcon name="i-heroicons-calendar" class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  v-model="customEndDate"
                  type="date"
                  class="w-full pl-9 pr-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700"
                  :class="{ 'border-red-500 focus:ring-red-500': isEndInvalid || hasRangeOrderIssue }"
                />
              </div>
            </div>
          </div>

          <div v-if="dateModalError || hasRangeOrderIssue || isStartInvalid || isEndInvalid" class="text-sm text-red-500">
            {{ dateModalError || t('app.invalidDateRange') }}
          </div>
        </div>

        <div class="px-6 py-4 bg-gray-50 dark:bg-gray-900/40 flex justify-between">
          <UButton variant="ghost" color="gray" @click="() => { customStartDate = ''; customEndDate = ''; dateModalError = null; }">{{ t('common.reset') }}</UButton>
          <div class="flex gap-2">
            <UButton variant="soft" color="gray" @click="showDateModal = false">{{ t('common.cancel') }}</UButton>
            <UButton color="primary" :disabled="!canApplyRange" @click="applyCustomRange">{{ t('common.apply') }}</UButton>
          </div>
        </div>
      </div>
    </UModal>
  </div>
</template>
