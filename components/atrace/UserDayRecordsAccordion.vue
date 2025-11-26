<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import type { AtraceRecord } from '@/api/atrace/record/records';

const { t, locale } = useI18n();

const props = defineProps<{
  postId: string;
  userId: string;
  startDate: string;
  endDate: string;
  lateArrivalTime: string;
  earlyLeaveTime: string;
}>();

const loading = ref(false);
const error = ref<string | null>(null);
const showReasonModal = ref(false);
const selectedDate = ref<string | null>(null);
const reason = ref('');

// All records and daily attendance
const allRecords = ref<AtraceRecord[]>([]);
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

// Expanded days state
const expandedDays = ref<Set<string>>(new Set());

// Group records by date
const recordsByDay = computed(() => {
  const grouped = new Map<string, AtraceRecord[]>();
  allRecords.value.forEach(record => {
    const date = getRecordDate(record.timestamp);
    if (!grouped.has(date)) grouped.set(date, []);
    grouped.get(date)!.push(record);
  });
  // Sort each day's records by timestamp
  grouped.forEach(records => records.sort((a, b) => a.timestamp - b.timestamp));
  // Convert to sorted array (newest first)
  return Array.from(grouped.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, records]) => ({ date, records }));
});

const startSec = computed(() => Math.floor(new Date(props.startDate + 'T00:00:00').getTime() / 1000));
const endSec = computed(() => Math.floor(new Date(props.endDate + 'T23:59:59').getTime() / 1000));

async function loadData() {
  if (!props.postId || !props.userId) return;
  loading.value = true;
  error.value = null;
  try {
    // Load records
    const { atraceGetRecordsByPostId } = await import('@/api/atrace/record/records');
    let page = 1;
    const aggregated: AtraceRecord[] = [];
    let fetched = 0;
    let total = Infinity;
    while (fetched < total) {
      const res = await atraceGetRecordsByPostId(props.postId, {
        page,
        length: 'FIFTY' as any,
        sortField: 'timestamp',
        sortBy: 'DESC',
      });
      total = res.paginationInfo.count;
      fetched += res.records.length;
      if (res.records.length === 0) break;
      aggregated.push(...res.records);
      const oldest = res.records[res.records.length - 1]?.timestamp ?? 0;
      if (oldest < startSec.value) break;
      page += 1;
      if (page > 20) break;
    }
    const filtered = aggregated.filter(r => r.userId === props.userId && r.timestamp >= startSec.value && r.timestamp <= endSec.value);
    allRecords.value = filtered;

    // Load daily attendance
    const { atraceGetAttendanceReport } = await import('@/api/atrace/attendance/stats');
    const result = await atraceGetAttendanceReport(props.userId, props.startDate, props.endDate);
    dailyAttendance.value = result;
  } catch (e: any) {
    console.error('[UserDayRecordsAccordion] failed to load:', e);
    error.value = t('app.failedToLoadDetails');
  } finally {
    loading.value = false;
  }
}

function toggleDay(date: string) {
  if (expandedDays.value.has(date)) {
    expandedDays.value.delete(date);
  } else {
    expandedDays.value.add(date);
  }
  expandedDays.value = new Set(expandedDays.value);
}

function isDayExpanded(date: string): boolean {
  return expandedDays.value.has(date);
}

function getRecordDate(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().split('T')[0];
}

function isViolationDay(date: string): boolean {
  const da = dailyAttendanceMap.value.get(date);
  return da ? (!da.attended && !da.legitimate) : false;
}

function isLegitimateDay(date: string): boolean {
  const da = dailyAttendanceMap.value.get(date);
  return da?.legitimate || false;
}

function getDayStyle(date: string): string {
  if (isViolationDay(date)) return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
  if (isLegitimateDay(date)) return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
  return 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700';
}

function isLateArrival(timestamp: number): boolean {
  if (!props.lateArrivalTime) return false;
  const time = new Date(timestamp * 1000);
  const [h, m] = props.lateArrivalTime.split(':').map(Number);
  const threshold = new Date(time);
  threshold.setHours(h, m, 0, 0);
  return time > threshold;
}

function isEarlyLeave(timestamp: number): boolean {
  if (!props.earlyLeaveTime) return false;
  const time = new Date(timestamp * 1000);
  const [h, m] = props.earlyLeaveTime.split(':').map(Number);
  const threshold = new Date(time);
  threshold.setHours(h, m, 0, 0);
  return time < threshold;
}

function getRecordHighlight(record: AtraceRecord, dayRecords: AtraceRecord[]): string {
  const firstOfDay = dayRecords[0];
  const lastOfDay = dayRecords[dayRecords.length - 1];
  if (record.id === firstOfDay.id && isLateArrival(record.timestamp)) return 'bg-orange-50 dark:bg-orange-900/20';
  if (record.id === lastOfDay.id && isEarlyLeave(record.timestamp)) return 'bg-orange-50 dark:bg-orange-900/20';
  return '';
}

function formatDate(date: string): string {
  try {
    return new Date(date).toLocaleDateString(locale.value === 'ru' ? 'ru-RU' : 'en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return date;
  }
}

function formatTime(ts: number) {
  if (!ts) return { time: '-', fullDate: '-' };
  try {
    const d = new Date(ts * 1000);
    const time = d.toLocaleTimeString(locale.value === 'ru' ? 'ru-RU' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
    const fullDate = d.toLocaleString(locale.value === 'ru' ? 'ru-RU' : 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    return { time, fullDate };
  } catch {
    return { time: '-', fullDate: '-' };
  }
}

function methodLabel(method?: string) {
  if (!method) return t('app.methodUnknown');
  const key = `app.methodLabels.${method}`;
  const label = t(key);
  return label === key ? (method.replace(/^METHOD_/, '').replace(/_/g, ' ')) : label;
}

function openReasonModal(date: string) {
  selectedDate.value = date;
  reason.value = '';
  showReasonModal.value = true;
}

async function markDayAsLegitimate() {
  if (!selectedDate.value || !reason.value.trim()) return;
  
  loading.value = true;
  try {
    const { atraceMarkDayLegitimate } = await import('@/api/atrace/attendance/stats');
    await atraceMarkDayLegitimate(props.userId, selectedDate.value, reason.value.trim());
    
    showReasonModal.value = false;
    reason.value = '';
    selectedDate.value = null;
    
    // Reload data to reflect changes
    await loadData();
  } catch (e) {
    console.error('[UserDayRecordsAccordion] failed to mark day legitimate:', e);
    error.value = t('app.failedToMarkLegitimate');
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadData();
});

watch(() => [props.postId, props.userId, props.startDate, props.endDate], () => {
  loadData();
});
</script>

<template>
  <div class="w-full">
    <div v-if="loading" class="flex items-center justify-center py-6">
      <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin text-blue-400 dark:text-blue-300" />
      <span class="ml-2 text-sm">{{ t('app.loading') }}</span>
    </div>

    <div v-else-if="error" class="text-sm text-red-500 py-4">{{ error }}</div>

    <div v-else-if="recordsByDay.length === 0" class="text-sm text-gray-500 py-4 text-center">
      {{ t('app.noAttendanceRecords') }}
    </div>

    <div v-else class="space-y-2">
      <!-- Day Accordion -->
      <div
        v-for="{ date, records } in recordsByDay"
        :key="date"
        class="border rounded-lg overflow-hidden transition-colors"
        :class="getDayStyle(date)"
      >
        <!-- Day Header -->
        <div class="flex items-center justify-between px-3 py-2">
          <div class="flex items-center gap-2 cursor-pointer hover:opacity-80 flex-1" @click="toggleDay(date)">
            <UIcon
              :name="isDayExpanded(date) ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-right'"
              class="w-4 h-4 transition-transform"
            />
            <span class="font-medium text-sm">{{ formatDate(date) }}</span>
            <span class="text-xs text-gray-500">{{ t('app.records') }} - {{ records.length }}</span>
          </div>
          <div class="flex items-center gap-2">
            <UButton
              v-if="!isLegitimateDay(date)"
              size="xs"
              variant="ghost"
              icon="i-heroicons-check-circle"
              @click.stop="openReasonModal(date)"
            >
              {{ t('app.markLegitimate') }}
            </UButton>
            <span v-if="isViolationDay(date)" class="px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-100 rounded">
              {{ t('app.violation') }}
            </span>
            <span v-else-if="isLegitimateDay(date)" class="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 rounded">
              {{ t('app.excused') }}
            </span>
          </div>
        </div>

        <!-- Day Records (expanded) -->
        <div v-if="isDayExpanded(date)" class="border-t border-inherit">
          <table class="w-full text-xs">
            <thead class="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th class="px-2 sm:px-3 py-1.5 text-left font-medium">{{ t('app.date') }}</th>
                <th class="px-2 sm:px-3 py-1.5 text-center font-medium hidden sm:table-cell">{{ t('common.method') }}</th>
                <th class="px-2 sm:px-3 py-1.5 text-center font-medium">{{ t('app.status') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="r in records"
                :key="r.id"
                class="border-t border-gray-100 dark:border-gray-700 transition-colors"
                :class="getRecordHighlight(r, records)"
              >
                <td class="px-2 sm:px-3 py-1.5" :title="formatTime(r.timestamp).fullDate">{{ formatTime(r.timestamp).time }}</td>
                <td class="px-2 sm:px-3 py-1.5 text-center hidden sm:table-cell">{{ methodLabel(r.method) }}</td>
                <td class="px-2 sm:px-3 py-1.5 text-center">
                  <span v-if="!r.suspicious" class="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100">
                    <UIcon name="i-heroicons-check-circle" class="w-3 h-3 mr-0.5" />
                    {{ t('common.ok') }}
                  </span>
                  <span v-else class="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-100">
                    <UIcon name="i-heroicons-exclamation-triangle" class="w-3 h-3 mr-0.5" />
                    {{ t('common.suspicious') }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Reason Modal -->
    <UModal v-model="showReasonModal">
      <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <UIcon name="i-heroicons-check-circle" class="w-6 h-6 text-blue-500" />
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">{{ t('app.markDayLegitimateTitle') }}</h3>
            </div>
            <UButton color="primary" variant="ghost" icon="lucide:x" class="-my-1" @click="showReasonModal = false" />
          </div>
        </template>

        <div class="flex flex-col gap-4">
          <div>
            <label class="text-sm mb-1">{{ t('app.enterReason') }}</label>
            <textarea
              v-model="reason"
              rows="3"
              class="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700"
              :placeholder="t('app.enterReason')"
            />
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end w-full">
            <div class="flex gap-2">
              <UButton size="sm" variant="soft" color="primary" @click="showReasonModal = false">{{ t('common.cancel') }}</UButton>
              <UButton size="sm" color="primary" :disabled="!reason.trim()" @click="markDayAsLegitimate">{{ t('common.apply') }}</UButton>
            </div>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>
