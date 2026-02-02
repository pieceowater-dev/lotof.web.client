<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { log, logError } from '@/utils/logger';
import UserDayRecordsAccordion from '@/components/atrace/UserDayRecordsAccordion.vue';

const { t, locale } = useI18n();

const props = defineProps<{
  postId: string | null;
  ready?: boolean;
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

// Time thresholds for highlighting (localStorage) - GLOBAL SETTINGS
const LATE_ARRIVAL_KEY = 'atrace-late-arrival-time';
const EARLY_LEAVE_KEY = 'atrace-early-leave-time';
const lateArrivalTime = ref(typeof window !== 'undefined' ? (localStorage.getItem(LATE_ARRIVAL_KEY) || '09:15') : '09:15');
const earlyLeaveTime = ref(typeof window !== 'undefined' ? (localStorage.getItem(EARLY_LEAVE_KEY) || '18:15') : '18:15');
const showSettings = ref(false);
const lateArrivalDraft = ref(lateArrivalTime.value);
const earlyLeaveDraft = ref(earlyLeaveTime.value);
const timeSettingsError = ref<string | null>(null);

watch(lateArrivalTime, (val) => {
  if (typeof window !== 'undefined') localStorage.setItem(LATE_ARRIVAL_KEY, val);
});
watch(earlyLeaveTime, (val) => {
  if (typeof window !== 'undefined') localStorage.setItem(EARLY_LEAVE_KEY, val);
});

function openSettings() {
  showSettings.value = !showSettings.value;
  if (showSettings.value) {
    lateArrivalDraft.value = lateArrivalTime.value;
    earlyLeaveDraft.value = earlyLeaveTime.value;
    timeSettingsError.value = null;
  }
}

function applyTimeSettings() {
  const isValidTime = (val: string) => /^\d{2}:\d{2}$/.test(val) && (() => {
    const [h, m] = val.split(':').map((v) => Number(v));
    return h >= 0 && h < 24 && m >= 0 && m < 60;
  })();

  if (!isValidTime(lateArrivalDraft.value) || !isValidTime(earlyLeaveDraft.value)) {
    timeSettingsError.value = t('app.invalidTimeFormat') || 'Неверный формат времени (HH:MM)';
    return;
  }

  lateArrivalTime.value = lateArrivalDraft.value;
  earlyLeaveTime.value = earlyLeaveDraft.value;
  timeSettingsError.value = null;
  showSettings.value = false;
}

// Date filter state
type PeriodType = 'month' | 'week' | '3months' | 'custom';

// Load selected period from localStorage
const PERIOD_STORAGE_KEY = 'atrace-attendance-period';
const CUSTOM_START_STORAGE_KEY = 'atrace-attendance-custom-start';
const CUSTOM_END_STORAGE_KEY = 'atrace-attendance-custom-end';

function loadPeriodFromStorage(): PeriodType {
  if (typeof window === 'undefined') return 'month';
  try {
    const stored = localStorage.getItem(PERIOD_STORAGE_KEY);
    if (stored && ['month', 'week', '3months', 'custom'].includes(stored)) {
      return stored as PeriodType;
    }
  } catch {}
  return 'month';
}

function loadCustomDatesFromStorage() {
  if (typeof window === 'undefined') return { start: '', end: '' };
  try {
    return {
      start: localStorage.getItem(CUSTOM_START_STORAGE_KEY) || '',
      end: localStorage.getItem(CUSTOM_END_STORAGE_KEY) || ''
    };
  } catch {}
  return { start: '', end: '' };
}

const selectedPeriod = ref<PeriodType>(loadPeriodFromStorage());
const customDates = loadCustomDatesFromStorage();
const customStartDate = ref(customDates.start);
const customEndDate = ref(customDates.end);
const showDateModal = ref(false);
const showLegendModal = ref(false);
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

// Salary calculator state
const showSalaryModal = ref(false);
const selectedUserId = ref<string | null>(null);
const salaryInput = ref('');
const workingDaysInMonth = ref(0);
const totalWorkedHours = ref(0);

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
  if (props.ready === false || props.postId === null) return;
  loading.value = true;
  error.value = null;
  
  try {
    const { atraceGetAllUsersStats } = await import('@/api/atrace/attendance/stats');
    const result = await atraceGetAllUsersStats(
      dateRange.value.startDate,
      dateRange.value.endDate,
      props.postId || null
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

function safeLoadStats() {
  if (props.ready === false || props.postId === null) return;
  loadStats();
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

function openSalaryCalculator(userId: string) {
  selectedUserId.value = userId;
  const savedSalary = typeof window !== 'undefined' ? localStorage.getItem(`salary_${userId}`) : null;
  salaryInput.value = savedSalary || '';
  
  // Calculate working days and hours for the user from stats
  const user = stats.value.find(u => u.userId === userId);
  if (user) {
    workingDaysInMonth.value = user.attendedDays + user.legitimateAbsences;
    totalWorkedHours.value = user.totalWorkedHours;
  }
  
  showSalaryModal.value = true;
}

function saveSalary() {
  if (selectedUserId.value && salaryInput.value) {
    localStorage.setItem(`salary_${selectedUserId.value}`, salaryInput.value);
  }
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
  safeLoadStats();
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
watch(selectedPeriod, (newPeriod) => {
  if (newPeriod !== 'custom') {
    safeLoadStats();
  }
  // Save to localStorage
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(PERIOD_STORAGE_KEY, newPeriod);
    } catch {}
  }
});

// Watch for custom date changes
watch([customStartDate, customEndDate], ([newStart, newEnd]) => {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CUSTOM_START_STORAGE_KEY, newStart);
      localStorage.setItem(CUSTOM_END_STORAGE_KEY, newEnd);
    } catch {}
  }
});

// Watch for postId changes
watch([() => props.postId, () => props.ready], () => {
  // Load for both specific post and "All" (empty string)
  safeLoadStats();
}, { immediate: true });

// Export functionality
const isExportingExcel = ref(false);
const exportError = ref<string | null>(null);

function isDateRangeLimited(): boolean {
  const start = new Date(dateRange.value.startDate);
  const end = new Date(dateRange.value.endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  // 3 months ≈ 100 days max
  return diffDays <= 100;
}

async function exportToExcel() {
  exportError.value = null;
  
  // Validate date range (max 3 months)
  if (!isDateRangeLimited()) {
    exportError.value = t('app.exportRangeTooLarge');
    return;
  }

  isExportingExcel.value = true;
  try {
    // Use atrace client to call the gateway with proper token
    const { atraceExportDailyAttendance } = await import('@/api/atrace/attendance/stats');
    const records = await atraceExportDailyAttendance(
      dateRange.value.startDate,
      dateRange.value.endDate
    );
    if (records.length === 0) {
      exportError.value = t('app.noDataToExport');
      return;
    }

    const { exportPivotTableToExcel } = await import('@/utils/exportToExcel');
    await exportPivotTableToExcel(
      records,
      dateRange.value.startDate,
      dateRange.value.endDate,
      locale.value
    );
  } catch (e: any) {
    logError('[AttendanceStatsTable] export failed:', e);
    exportError.value = t('app.exportFailed');
  } finally {
    isExportingExcel.value = false;
  }
}

// Computed properties for salary calculation
const salaryByDays = computed(() => {
  const salary = parseFloat(salaryInput.value) || 0;
  const daysInMonth = 22;
  return (salary / daysInMonth) * workingDaysInMonth.value;
});

const salaryByHours = computed(() => {
  const salary = parseFloat(salaryInput.value) || 0;
  const hoursInMonth = 22 * 8;
  return (salary / hoursInMonth) * totalWorkedHours.value;
});

// Locale-aware number formatting (spaces for thousands in ru-RU)
function formatNumber(val: number, fractionDigits = 0) {
  try {
    return new Intl.NumberFormat(
      locale.value === 'ru' ? 'ru-RU' : 'en-US',
      {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      }
    ).format(val || 0);
  } catch {
    const num = typeof val === 'number' ? val : 0;
    return num.toFixed(fractionDigits);
  }
}

</script>

<template>
  <div class="h-full flex flex-col overflow-hidden">
    <!-- Period Filter, Legend & Settings -->
    <div class="mb-3 flex flex-wrap items-center gap-3">
      <!-- Period Filter Buttons -->
      <div class="flex flex-wrap gap-1.5">
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
          class="hidden md:inline-flex"
        >
          {{ t('app.thisWeek') }}
        </UButton>
        <UButton 
          :color="selectedPeriod === '3months' ? 'primary' : 'gray'" 
          size="sm"
          @click="selectedPeriod = '3months'"
          class="hidden md:inline-flex"
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

      <!-- Export and Settings Buttons -->
      <div class="flex gap-1.5">
        <UButton 
          size="xs" 
          variant="ghost" 
          icon="i-heroicons-arrow-down-tray"
          :loading="isExportingExcel"
          @click="exportToExcel"
        >
          {{ t('app.exportToExcel') || 'Export' }}
        </UButton>
        <UButton size="xs" variant="ghost" icon="i-heroicons-cog-6-tooth" @click="openSettings">
          {{ t('app.configureTime') }}
        </UButton>
      </div>

      <!-- Legend - full on desktop -->
      <div class="hidden md:flex items-center gap-2 text-xs ml-auto">
        <div class="flex items-center gap-1 whitespace-nowrap">
          <div class="w-3 h-3 rounded bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-700"></div>
          <span>{{ t('app.violationDay') }}</span>
        </div>
        <div class="flex items-center gap-1 whitespace-nowrap">
          <div class="w-3 h-3 rounded bg-blue-100 dark:bg-blue-900/40 border border-blue-300 dark:border-blue-700"></div>
          <span>{{ t('app.legitimateDay') }}</span>
        </div>
        <div class="flex items-center gap-1 whitespace-nowrap">
          <div class="w-3 h-3 rounded bg-orange-100 dark:bg-orange-900/40 border border-orange-300 dark:border-orange-700"></div>
          <span>{{ t('app.timeViolation') }}</span>
        </div>
      </div>
      
      <!-- Legend info button - only on mobile -->
      <UButton 
        icon="lucide:info" 
        size="xs" 
        color="gray" 
        variant="ghost"
        class="md:hidden"
        @click="showLegendModal = true"
      />
    </div>

    <!-- Export Error -->
    <div v-if="exportError" class="mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-200">
      {{ exportError }}
    </div>

    <!-- Settings Panel -->
    <div v-if="showSettings" class="mb-3 p-3 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 flex-shrink-0 space-y-3">
      <div class="flex items-center justify-between gap-2">
        <div>
          <div class="text-sm font-semibold leading-tight">{{ t('app.timeThresholds') }}</div>
          <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('app.timeThresholdsHint') || 'Используется для подсветки опозданий/ранних уходов' }}</div>
        </div>
        <UButton size="xs" color="primary" variant="solid" icon="i-heroicons-check" @click="applyTimeSettings">
          {{ t('common.apply') || 'Применить' }}
        </UButton>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <UFormGroup :label="t('app.lateArrivalAfter')">
          <UInput
            v-model="lateArrivalDraft"
            type="time"
            size="sm"
            icon="i-heroicons-clock"
            :ui="{ base: 'font-mono' }"
          />
        </UFormGroup>
        <UFormGroup :label="t('app.earlyLeaveBefore')">
          <UInput
            v-model="earlyLeaveDraft"
            type="time"
            size="sm"
            icon="i-heroicons-clock"
            :ui="{ base: 'font-mono' }"
          />
        </UFormGroup>
      </div>
      <div v-if="timeSettingsError" class="text-xs text-red-500">{{ timeSettingsError }}</div>
    </div>

    <!-- Stats Table -->
    <div class="flex-1 min-h-0 overflow-auto">

      <div v-if="loading" class="flex flex-col items-center justify-center py-6">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 mb-1.5 animate-spin text-blue-400 dark:text-blue-300" />
  <div class="text-sm">{{ t('app.loading') }}</div>
      </div>
      <div v-else-if="error" class="flex flex-col items-center justify-center py-6 text-red-500">
        <UIcon name="i-heroicons-lock-closed" class="w-10 h-10 mb-1.5 text-red-400 dark:text-red-300" />
        <div class="text-base font-semibold mb-1.5">{{ error }}</div>
  <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('app.attendancePermissionErrorHint') }}</div>
      </div>
      <div v-else-if="stats.length === 0" class="text-gray-500 py-6 text-center flex flex-col items-center justify-center">
        <UIcon name="i-heroicons-information-circle" class="w-8 h-8 mb-1.5 text-blue-400 dark:text-blue-300" />
  <div class="text-sm">{{ t('app.noData') }}</div>
      </div>
      <table v-else class="w-full text-sm">
        <thead class="bg-gray-100 dark:bg-gray-800 sticky top-0 z-10 text-xs">
          <tr>
            <th class="px-3 py-2 text-left font-medium w-7"></th>
            <th class="px-3 py-2 text-left font-medium">{{ t('app.user') }}</th>
            <th class="px-3 py-2 text-center font-medium">{{ t('app.workDays') }}</th>
            <th class="px-3 py-2 text-center font-medium">{{ t('app.attended') }}</th>
            <th class="px-3 py-2 text-center font-medium">{{ t('app.violations') }}</th>
            <th class="px-3 py-2 text-center font-medium">{{ t('app.exceptions') }}</th>
            <th v-if="!postId" class="px-3 py-2 text-right font-medium w-16"></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="user in stats" :key="user.userId">
            <!-- Main row -->
            <tr 
              :class="[
                'border-b dark:border-gray-700',
                postId ? 'hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer' : 'cursor-default'
              ]"
              @click="postId ? toggleUserDetails(user.userId) : null"
            >
              <td class="px-3 py-2 text-center">
                <UIcon 
                  v-if="postId"
                  :name="isExpanded(user.userId) ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-right'" 
                  class="w-4 h-4 transition-transform"
                />
              </td>
              <td class="px-3 py-2">
                <div class="font-medium leading-tight">{{ user.username || user.email || user.userId }}</div>
                <div v-if="user.username && user.email" class="text-xs text-gray-500 leading-tight">{{ user.email }}</div>
              </td>
              <td class="px-3 py-2 text-center">{{ user.workDays }}</td>
              <td class="px-3 py-2 text-center">
                <span class="px-1.5 py-0.5 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100 rounded">
                  {{ user.attendedDays }}
                </span>
              </td>
              <td class="px-3 py-2 text-center">
                <span 
                  v-if="user.violationDays > 0"
                  class="px-1.5 py-0.5 text-xs bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-100 rounded"
                >
                  {{ user.violationDays }}
                </span>
                <span v-else class="text-gray-400">0</span>
              </td>
              <td class="px-3 py-2 text-center">
                <span 
                  v-if="user.legitimateAbsences > 0"
                  class="px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 rounded"
                >
                  {{ user.legitimateAbsences }}
                </span>
                <span v-else class="text-gray-400">0</span>
              </td>
              <td v-if="!postId" class="px-3 py-2 text-right">
                <UButton
                  size="xs"
                  variant="soft"
                  icon="i-heroicons-calculator"
                  @click.stop="openSalaryCalculator(user.userId)"
                >
                  {{ t('app.calculate') }}
                </UButton>
              </td>
            </tr>

            <!-- Expanded details row -->
            <tr v-if="postId && isExpanded(user.userId)" class="bg-gray-50 dark:bg-gray-900">
              <td :colspan="!postId ? 7 : 6" class="px-3 py-3">
                <div class="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm">
                  <h4 class="text-sm font-semibold mb-2">{{ t('app.attendanceDetails') }}</h4>
                  <UserDayRecordsAccordion 
                    v-if="postId"
                    :post-id="postId"
                    :user-id="user.userId"
                    :start-date="dateRange.startDate"
                    :end-date="dateRange.endDate"
                    :late-arrival-time="lateArrivalTime"
                    :early-leave-time="earlyLeaveTime"
                  />
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <!-- Custom Date Range Modal -->
    <UModal v-model="showDateModal" :ui="{ container: 'items-center' }">
      <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <UIcon name="i-heroicons-calendar-days" class="w-6 h-6 text-blue-500" />
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">{{ t('app.customRangeTitle') }}</h3>
            </div>
            <UButton color="primary" variant="ghost" icon="lucide:x" class="-my-1" @click="showDateModal = false" />
          </div>
        </template>

        <div class="flex flex-col gap-4">
          <!-- Presets -->
          <div class="flex flex-wrap gap-2">
            <UButton size="sm" variant="soft" color="primary" @click="applyPreset('today')">{{ t('app.datePresetToday') }}</UButton>
            <UButton size="sm" variant="soft" color="primary" @click="applyPreset('yesterday')">{{ t('app.datePresetYesterday') }}</UButton>
            <UButton size="sm" variant="soft" color="primary" @click="applyPreset('thisWeek')">{{ t('app.datePresetThisWeek') }}</UButton>
            <UButton size="sm" variant="soft" color="primary" @click="applyPreset('last7')">{{ t('app.datePresetLast7') }}</UButton>
            <UButton size="sm" variant="soft" color="primary" @click="applyPreset('last30')">{{ t('app.datePresetLast30') }}</UButton>
          </div>

          <!-- Inputs -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="flex flex-col min-w-0" style="max-width: 100vw;">
              <label class="text-sm mb-1">{{ t('app.startDate') }}</label>
              <div class="relative">
                <UIcon name="i-heroicons-calendar" class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  v-model="customStartDate"
                  type="date"
                  class="w-full max-w-xs min-w-0 pl-9 pr-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700"
                  :class="{ 'border-red-500 focus:ring-red-500': isStartInvalid || hasRangeOrderIssue }"
                  style="max-width: 100%;"
                />
              </div>
            </div>
            <div class="flex flex-col min-w-0" style="max-width: 100vw;">
              <label class="text-sm mb-1">{{ t('app.endDate') }}</label>
              <div class="relative">
                <UIcon name="i-heroicons-calendar" class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  v-model="customEndDate"
                  type="date"
                  class="w-full max-w-xs min-w-0 pl-9 pr-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700"
                  :class="{ 'border-red-500 focus:ring-red-500': isEndInvalid || hasRangeOrderIssue }"
                  style="max-width: 100%;"
                />
              </div>
            </div>
          </div>

          <div v-if="dateModalError || hasRangeOrderIssue || isStartInvalid || isEndInvalid" class="text-sm text-red-500">
            {{ dateModalError || t('app.invalidDateRange') }}
          </div>
        </div>

        <template #footer>
          <div class="flex justify-between w-full">
            <UButton size="sm" variant="soft" color="primary" @click="() => { customStartDate = ''; customEndDate = ''; dateModalError = null; }">{{ t('common.reset') }}</UButton>
            <div class="flex gap-2">
              <UButton size="sm" variant="soft" color="primary" @click="showDateModal = false">{{ t('common.cancel') }}</UButton>
              <UButton size="sm" color="primary" :disabled="!canApplyRange" @click="applyCustomRange">{{ t('common.apply') }}</UButton>
            </div>
          </div>
        </template>
      </UCard>
    </UModal>

    <!-- Salary Calculation Modal -->
    <UModal v-model="showSalaryModal" :ui="{ container: 'items-center', width: 'w-full sm:max-w-2xl' }">
      <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <UIcon name="i-heroicons-calculator" class="w-6 h-6 text-green-500" />
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">{{ t('app.salaryCalculation') }}</h3>
            </div>
            <UButton color="primary" variant="ghost" icon="lucide:x" class="-my-1" @click="showSalaryModal = false" />
          </div>
        </template>

        <div class="flex flex-col gap-6">
          <!-- Salary Input -->
          <div>
            <label class="text-sm font-medium mb-2 block">{{ t('app.salary') }}</label>
            <input
              v-model="salaryInput"
              type="number"
              class="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-800 dark:border-gray-700"
              :placeholder="t('app.enterSalary')"
            />
            <p class="text-xs text-gray-500 mt-1">{{ t('app.salaryStoredLocally') }}</p>
          </div>

          <!-- Calculation Results Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Working Days -->
            <div class="border rounded-lg p-4 dark:border-gray-700">
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">{{ t('app.workingDaysInMonth') }}</p>
              <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ formatNumber(workingDaysInMonth) }} / 22</p>
            </div>

            <!-- Total Worked Hours -->
            <div class="border rounded-lg p-4 dark:border-gray-700">
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">{{ t('app.totalWorkedHours') }}</p>
              <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ formatNumber(totalWorkedHours, 2) }} / 176</p>
            </div>
          </div>

          <!-- Salary by Days -->
          <div class="border rounded-lg p-4 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20">
            <p class="text-sm font-medium text-gray-900 dark:text-white mb-3">{{ t('app.salaryByDays') }}</p>
            <div class="flex items-end gap-2">
              <div>
                <p class="text-3xl font-bold text-blue-600 dark:text-blue-400">{{ formatNumber(salaryByDays, 2) }}</p>
                <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">{{ t('app.formula') }}: ({{ t('app.salary') }} / 22) × {{ formatNumber(workingDaysInMonth) }}</p>
              </div>
            </div>
          </div>

          <!-- Salary by Hours -->
          <div class="border rounded-lg p-4 dark:border-gray-700 bg-green-50 dark:bg-green-900/20">
            <p class="text-sm font-medium text-gray-900 dark:text-white mb-3">{{ t('app.salaryByHours') }}</p>
            <div class="flex items-end gap-2">
              <div>
                <p class="text-3xl font-bold text-green-600 dark:text-green-400">{{ formatNumber(salaryByHours, 2) }}</p>
                <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">{{ t('app.formula') }}: ({{ t('app.salary') }} / 22 / 8) × {{ formatNumber(totalWorkedHours, 2) }}</p>
              </div>
            </div>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end w-full">
            <div class="flex gap-2">
              <UButton size="sm" variant="soft" color="primary" @click="showSalaryModal = false">{{ t('common.close') }}</UButton>
              <UButton size="sm" color="primary" @click="saveSalary(); showSalaryModal = false">{{ t('app.save') }}</UButton>
            </div>
          </div>
        </template>
      </UCard>
    </UModal>

    <!-- Legend Modal -->
    <UModal v-model="showLegendModal">
      <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">{{ t('app.legend') || 'Легенда' }}</h3>
            <UButton color="gray" variant="ghost" icon="lucide:x" class="-my-1" @click="showLegendModal = false" />
          </div>
        </template>

        <div class="space-y-3 py-2">
          <div class="flex items-center gap-2">
            <div class="w-4 h-4 rounded bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-700"></div>
            <span class="text-sm">{{ t('app.violationDay') }}</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-4 h-4 rounded bg-blue-100 dark:bg-blue-900/40 border border-blue-300 dark:border-blue-700"></div>
            <span class="text-sm">{{ t('app.legitimateDay') }}</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-4 h-4 rounded bg-orange-100 dark:bg-orange-900/40 border border-orange-300 dark:border-orange-700"></div>
            <span class="text-sm">{{ t('app.timeViolation') }}</span>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end">
            <UButton size="sm" color="primary" @click="showLegendModal = false">{{ t('common.close') }}</UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>
