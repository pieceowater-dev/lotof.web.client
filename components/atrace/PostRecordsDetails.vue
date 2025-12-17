<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import type { AtraceRecord } from '@/api/atrace/record/records';

const { t, locale } = useI18n();

const props = defineProps<{
  postId: string;
  userId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}>();

const loading = ref(false);
const error = ref<string | null>(null);

// All filtered records matching user + period
const filteredRecords = ref<AtraceRecord[]>([]);
const totalCount = ref(0);

// Daily attendance data for violation highlighting
type DailyAttendance = {
  date: string;
  attended: boolean;
  legitimate: boolean;
  firstCheckIn: number;
  lastCheckOut: number;
  workedHours: number;
  requiredHours: number;
};
const dailyAttendance = ref<DailyAttendance[]>([]);
const dailyAttendanceMap = computed(() => {
  const map = new Map<string, DailyAttendance>();
  dailyAttendance.value.forEach(da => map.set(da.date, da));
  return map;
});

// Time thresholds for highlighting (localStorage)
const LATE_ARRIVAL_KEY = 'atrace-late-arrival-time';
const EARLY_LEAVE_KEY = 'atrace-early-leave-time';
const lateArrivalTime = ref(localStorage.getItem(LATE_ARRIVAL_KEY) || '09:15');
const earlyLeaveTime = ref(localStorage.getItem(EARLY_LEAVE_KEY) || '18:15');
const showSettings = ref(false);

watch(lateArrivalTime, (val) => {
  if (typeof window !== 'undefined') localStorage.setItem(LATE_ARRIVAL_KEY, val);
});
watch(earlyLeaveTime, (val) => {
  if (typeof window !== 'undefined') localStorage.setItem(EARLY_LEAVE_KEY, val);
});

// Pagination
const currentPage = ref(1);
const itemsPerPage = ref<'TEN' | 'FIFTEEN' | 'TWENTY' | 'TWENTY_FIVE' | 'THIRTY'>('TEN');

const startSec = computed(() => Math.floor(new Date(props.startDate + 'T00:00:00').getTime() / 1000));
const endSec = computed(() => Math.floor(new Date(props.endDate + 'T23:59:59').getTime() / 1000));

async function loadRecords() {
  if (!props.postId || !props.userId) return;
  loading.value = true;
  error.value = null;
  try {
    const { atraceGetRecordsByPostId } = await import('@/api/atrace/record/records');
    const pageSize: typeof itemsPerPage.value = 'FIFTY' as any; // widen fetch window
    let page = 1;
    const aggregated: AtraceRecord[] = [];
    let fetched = 0;
    let total = Infinity;
    // Fetch pages until we've likely covered the period (descending by timestamp)
    while (fetched < total) {
      const res = await atraceGetRecordsByPostId(props.postId, {
        page,
        length: (pageSize as any),
        sortField: 'timestamp',
        sortBy: 'DESC',
      });
      total = res.paginationInfo.count;
      fetched += res.records.length;
      // Early stop if no records
      if (res.records.length === 0) break;
      aggregated.push(...res.records);
      // If the last record on this page is older than the requested start date, we can stop
      const oldest = res.records[res.records.length - 1]?.timestamp ?? 0;
      if (oldest < startSec.value) break;
      page += 1;
      // Safety cap to avoid runaway
      if (page > 20) break;
    }

    // Filter by user and date range
    const filtered = aggregated.filter(r => r.userId === props.userId && r.timestamp >= startSec.value && r.timestamp <= endSec.value);
    filteredRecords.value = filtered;
    totalCount.value = filtered.length;

    // Load daily attendance data for violation highlighting
    await loadDailyAttendance();
  } catch (e: any) {
    console.error('[PostRecordsDetails] failed to load records:', e);
    error.value = t('app.failedToLoadDetails');
    filteredRecords.value = [];
    totalCount.value = 0;
  } finally {
    loading.value = false;
  }
}

async function loadDailyAttendance() {
  try {
    const { atraceGetAttendanceReport } = await import('@/api/atrace/attendance/stats');
    const result = await atraceGetAttendanceReport(props.userId, props.startDate, props.endDate);
    dailyAttendance.value = result;
  } catch (e) {
    console.error('[PostRecordsDetails] failed to load daily attendance:', e);
    dailyAttendance.value = [];
  }
}

function getRecordDate(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().split('T')[0];
}

function isViolationDay(timestamp: number): boolean {
  const date = getRecordDate(timestamp);
  const da = dailyAttendanceMap.value.get(date);
  // Violation day = attended=false AND legitimate=false
  return da ? (!da.attended && !da.legitimate) : false;
}

function isLegitimateDay(timestamp: number): boolean {
  const date = getRecordDate(timestamp);
  const da = dailyAttendanceMap.value.get(date);
  return da?.legitimate || false;
}

function isLateArrival(timestamp: number): boolean {
  if (!lateArrivalTime.value) return false;
  const time = new Date(timestamp * 1000);
  const [h, m] = lateArrivalTime.value.split(':').map(Number);
  const threshold = new Date(time);
  threshold.setHours(h, m, 0, 0);
  return time > threshold;
}

function isEarlyLeave(timestamp: number): boolean {
  if (!earlyLeaveTime.value) return false;
  const time = new Date(timestamp * 1000);
  const [h, m] = earlyLeaveTime.value.split(':').map(Number);
  const threshold = new Date(time);
  threshold.setHours(h, m, 0, 0);
  return time < threshold;
}

function getRecordStyle(record: AtraceRecord): string {
  // Priority: violation day > legitimate day > time-based highlights
  if (isViolationDay(record.timestamp)) return 'bg-red-50 dark:bg-red-900/20';
  if (isLegitimateDay(record.timestamp)) return 'bg-blue-50 dark:bg-blue-900/20';
  // Check if first/last record of the day for time highlighting
  const date = getRecordDate(record.timestamp);
  const dayRecords = filteredRecords.value.filter(r => getRecordDate(r.timestamp) === date);
  if (dayRecords.length === 0) return '';
  const firstOfDay = dayRecords.reduce((min, r) => r.timestamp < min.timestamp ? r : min);
  const lastOfDay = dayRecords.reduce((max, r) => r.timestamp > max.timestamp ? r : max);
  if (record.id === firstOfDay.id && isLateArrival(record.timestamp)) return 'bg-orange-50 dark:bg-orange-900/20';
  if (record.id === lastOfDay.id && isEarlyLeave(record.timestamp)) return 'bg-orange-50 dark:bg-orange-900/20';
  return '';
}

function nextPage() {
  if (currentPage.value * pageSizeNumber.value < totalCount.value) {
    currentPage.value += 1;
    // pagination is client-side on filtered results
  }
}

function prevPage() {
  if (currentPage.value > 1) {
    currentPage.value -= 1;
    // pagination is client-side on filtered results
  }
}

const pageSizeNumber = computed(() => {
  switch (itemsPerPage.value) {
    case 'FIFTEEN': return 15;
    case 'TWENTY': return 20;
    case 'TWENTY_FIVE': return 25;
    case 'THIRTY': return 30;
    default: return 10;
  }
});

const totalPages = computed(() => {
  return Math.max(1, Math.ceil(totalCount.value / pageSizeNumber.value));
});

function formatTime(ts: number) {
  if (!ts) return '-';
  try {
    const d = new Date(ts * 1000);
    // Use active locale for formatting
    return d.toLocaleString(locale.value === 'ru' ? 'ru-RU' : 'en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '-';
  }
}

// Localized method label
function methodLabel(method?: string) {
  if (!method) return t('app.methodUnknown');
  const key = `app.methodLabels.${method}`;
  const label = t(key);
  // If key not found, fallback to prettified method
  return label === key ? (method.replace(/^METHOD_/, '').replace(/_/g, ' ')) : label;
}

onMounted(() => {
  loadRecords();
});

watch(() => props.postId, () => {
  currentPage.value = 1;
  loadRecords();
});

watch(() => [props.userId, props.startDate, props.endDate], () => {
  currentPage.value = 1;
  loadRecords();
});

watch(itemsPerPage, () => {
  // When page size changes, keep it simple and reset to first page
  currentPage.value = 1;
});
</script>

<template>
  <div class="w-full">
    <div v-if="loading" class="flex items-center justify-center py-8">
      <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin text-blue-400 dark:text-blue-300" />
      <span class="ml-2 text-sm text-gray-600 dark:text-gray-400">{{ t('app.loading') }}</span>
    </div>

    <div v-else-if="error" class="text-sm text-red-500 py-4">
      {{ error }}
    </div>

    <div v-else-if="filteredRecords.length === 0" class="text-sm text-gray-500 py-4 text-center">
      {{ t('app.noAttendanceRecords') }}
    </div>

    <div v-else>
      <!-- Settings & Legend -->
      <div class="mb-3 flex items-start justify-between gap-3">
        <div class="flex flex-wrap gap-2 text-xs">
          <div class="flex items-center gap-1">
            <div class="w-3 h-3 rounded bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-700"></div>
            <span>{{ t('app.violationDay') }}</span>
          </div>
          <div class="flex items-center gap-1">
            <div class="w-3 h-3 rounded bg-blue-100 dark:bg-blue-900/40 border border-blue-300 dark:border-blue-700"></div>
            <span>{{ t('app.legitimateDay') }}</span>
          </div>
          <div class="flex items-center gap-1">
            <div class="w-3 h-3 rounded bg-orange-100 dark:bg-orange-900/40 border border-orange-300 dark:border-orange-700"></div>
            <span>{{ t('app.timeViolation') }}</span>
          </div>
          <div class="flex items-center gap-1">
            <div class="w-3 h-3 rounded bg-yellow-100 dark:bg-yellow-900/40 border border-yellow-300 dark:border-yellow-700"></div>
            <span>{{ t('common.suspicious') }}</span>
          </div>
        </div>
        <UButton size="xs" variant="ghost" icon="i-heroicons-cog-6-tooth" @click="showSettings = !showSettings">
          {{ t('app.settings') }}
        </UButton>
      </div>

      <!-- Settings Panel -->
      <div v-if="showSettings" class="mb-3 p-3 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
        <div class="text-sm font-medium mb-2">{{ t('app.timeThresholds') }}</div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <label class="block mb-1 text-xs text-gray-600 dark:text-gray-400">{{ t('app.lateArrivalAfter') }}</label>
            <input v-model="lateArrivalTime" type="time" class="w-full px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600" />
          </div>
          <div>
            <label class="block mb-1 text-xs text-gray-600 dark:text-gray-400">{{ t('app.earlyLeaveBefore') }}</label>
            <input v-model="earlyLeaveTime" type="time" class="w-full px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600" />
          </div>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-100 dark:bg-gray-700">
            <tr>
              <th class="px-3 py-2 text-left font-medium">{{ t('app.date') }}</th>
              <th class="px-3 py-2 text-center font-medium">{{ t('common.method') }}</th>
              <th class="px-3 py-2 text-center font-medium">{{ t('app.status') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="r in filteredRecords.slice((currentPage-1)*pageSizeNumber, (currentPage)*pageSizeNumber)"
              :key="r.id"
              class="border-b dark:border-gray-700 transition-colors"
              :class="getRecordStyle(r)"
            >
              <td class="px-3 py-2">{{ formatTime(r.timestamp) }}</td>
              <td class="px-3 py-2 text-center">{{ methodLabel(r.method) }}</td>
              <td class="px-3 py-2 text-center">
                <span v-if="!r.suspicious" class="inline-flex items-center px-2 py-1 rounded text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100">
                  <UIcon name="i-heroicons-check-circle" class="w-3 h-3 mr-1" />
                  {{ t('common.ok') }}
                </span>
                <span v-else class="inline-flex items-center px-2 py-1 rounded text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-100 cursor-help" :title="t('common.suspiciousReasons')">
                  <UIcon name="i-heroicons-exclamation-triangle" class="w-3 h-3 mr-1" />
                  {{ t('common.suspicious') }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex items-center justify-between mt-4 text-sm">
        <div class="text-gray-600 dark:text-gray-400">
          {{ t('common.showing') }} {{ (currentPage - 1) * pageSizeNumber + 1 }}-{{ Math.min(currentPage * pageSizeNumber, totalCount) }} {{ t('common.of') }} {{ totalCount }}
        </div>
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2">
            <label class="text-gray-600 dark:text-gray-400">{{ t('common.rowsPerPage') }}</label>
            <select v-model="itemsPerPage" class="border rounded px-2 py-1 bg-white dark:bg-gray-800 dark:border-gray-700">
              <option value="TEN">10</option>
              <option value="FIFTEEN">15</option>
              <option value="TWENTY">20</option>
              <option value="TWENTY_FIVE">25</option>
              <option value="THIRTY">30</option>
            </select>
          </div>
          <div class="flex gap-2">
            <UButton size="xs" variant="soft" :disabled="currentPage === 1" @click="prevPage">
              <UIcon name="i-heroicons-chevron-left" class="w-4 h-4" />
            </UButton>
            <div class="flex items-center px-2">
              {{ currentPage }} / {{ totalPages }}
            </div>
            <UButton size="xs" variant="soft" :disabled="currentPage === totalPages" @click="nextPage">
              <UIcon name="i-heroicons-chevron-right" class="w-4 h-4" />
            </UButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
