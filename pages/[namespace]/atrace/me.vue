<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useAuth } from '@/composables/useAuth';
import { useAtraceToken } from '@/composables/useAtraceToken';
import { CookieKeys } from '@/utils/storageKeys';
import { isAtracePermissionError } from '@/utils/atracePermissions';
import { GEO_CONFIRM_RADIUS_M } from '@/utils/geolocation';
import AppTable from '@/components/ui/AppTable.vue';
import type { AtraceAttendanceSummary } from '@/api/atrace/attendance/summary';
import type { AtraceScheduleAssignment, AtraceShiftPattern } from '@/api/atrace/schedule/schedule';
import type { AtraceSalaryCalculationResult, AtraceSalaryHistoryEntry } from '@/api/atrace/salary/payroll';
import type { AtraceRecord } from '@/api/atrace/record/records';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const { user } = useAuth();
const { ensure: ensureAtraceToken } = useAtraceToken();

useHead({ title: 'Моя посещаемость — A-Trace' });

const goBack = () => {
  if (process.client) {
    window.history.back();
    return;
  }
  router.back();
};

const loading = ref(true);
const error = ref<string | null>(null);

const assignment = ref<AtraceScheduleAssignment | null>(null);
const pattern = ref<AtraceShiftPattern | null>(null);

const currentSummary = ref<AtraceAttendanceSummary | null>(null);
const summaryHistory = ref<AtraceAttendanceSummary[]>([]);

const projectedSalary = ref<AtraceSalaryCalculationResult | null>(null);
const salaryHistory = ref<AtraceSalaryHistoryEntry[]>([]);
const salaryUnavailable = ref(false);

// Check-in history -- individual records (not the monthly-aggregate
// summary above), newest first, paginated with "load more".
const myRecords = ref<AtraceRecord[]>([]);
const myRecordsPage = ref(1);
const myRecordsHasMore = ref(true);
const myRecordsLoading = ref(false);
const myRecordsLoadingMore = ref(false);
const postTitleById = ref<Record<string, string>>({});
const RECORDS_PAGE_SIZE = 'THIRTY' as const;

async function loadMyRecords(reset = true) {
  const userId = user.value?.id;
  if (!userId) return;
  if (reset) {
    myRecordsLoading.value = true;
    myRecordsPage.value = 1;
    myRecords.value = [];
    myRecordsHasMore.value = true;
  } else {
    myRecordsLoadingMore.value = true;
  }
  try {
    const { atraceGetMyRecords } = await import('@/api/atrace/record/records');
    const res = await atraceGetMyRecords(userId, { page: myRecordsPage.value, length: RECORDS_PAGE_SIZE, nsSlug: nsSlug.value });
    myRecords.value = reset ? res.records : [...myRecords.value, ...res.records];
    myRecordsHasMore.value = myRecordsPage.value * 30 < res.paginationInfo.count && res.records.length > 0;
    myRecordsPage.value += 1;
  } catch (e) {
    // Best-effort -- the rest of the page (summary/salary) already loaded
    // fine, no need to fail the whole page over the history list alone.
  } finally {
    myRecordsLoading.value = false;
    myRecordsLoadingMore.value = false;
  }
}

async function loadPostTitles() {
  try {
    const hubToken = useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value;
    const tok = await ensureAtraceToken(nsSlug.value, hubToken);
    if (!tok) return;
    const { atracePostsList } = await import('@/api/atrace/post/list');
    const res = await atracePostsList(tok, nsSlug.value, { length: 'ONE_HUNDRED' });
    const map: Record<string, string> = {};
    for (const p of res.posts) map[p.id] = p.title;
    postTitleById.value = map;
  } catch (e) {
    // Best-effort -- falls back to showing the raw postId if this fails.
  }
}

function recordLocalDate(r: AtraceRecord): string {
  if (r.localDate) return r.localDate;
  if (r.timezone) {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: r.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(r.timestamp * 1000));
    } catch {}
  }
  return new Date(r.timestamp * 1000).toISOString().split('T')[0];
}

const myRecordsByDay = computed(() => {
  const grouped = new Map<string, AtraceRecord[]>();
  for (const r of myRecords.value) {
    const date = recordLocalDate(r);
    if (!grouped.has(date)) grouped.set(date, []);
    grouped.get(date)!.push(r);
  }
  grouped.forEach((records) => records.sort((a, b) => a.timestamp - b.timestamp));
  return Array.from(grouped.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, records]) => ({ date, records }));
});

function formatRecordDate(date: string): string {
  try {
    return new Date(date).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
  } catch {
    return date;
  }
}

function formatRecordTime(r: AtraceRecord): string {
  try {
    return new Date(r.timestamp * 1000).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: r.timezone || undefined });
  } catch {
    return '-';
  }
}

function recordDirectionLabel(r: AtraceRecord, dayRecords: AtraceRecord[]): string {
  const index = dayRecords.findIndex((x) => x.id === r.id);
  if (index < 0) return '';
  return index % 2 === 0 ? (t('app.checkIn') || 'Приход') : (t('app.checkOut') || 'Уход');
}

function methodLabel(method?: string): string {
  if (!method) return t('app.methodUnknown') || '';
  const key = `app.methodLabels.${method}`;
  const label = t(key);
  return label === key ? method.replace(/^METHOD_/, '').replace(/_/g, ' ') : label;
}

const WEEKDAYS = [
  { value: 1, label: 'Пн' }, { value: 2, label: 'Вт' }, { value: 3, label: 'Ср' },
  { value: 4, label: 'Чт' }, { value: 5, label: 'Пт' }, { value: 6, label: 'Сб' }, { value: 7, label: 'Вс' },
];

function patternSummary(p: AtraceShiftPattern): string {
  if (p.type === 'FIXED_WEEKDAYS') {
    const names = (p.workDaysOfWeek || []).map(d => WEEKDAYS.find(w => w.value === d)?.label || d).join(', ');
    return `${names} · ${p.shiftStartTime}-${p.shiftEndTime}`;
  }
  return `${p.rotationWorkDays}/${p.rotationOffDays} · ${p.shiftStartTime}-${p.shiftEndTime}`;
}

const summaryHistoryRows = computed(() => summaryHistory.value.map(s => ({
  period: `${String(s.month).padStart(2, '0')}.${s.year}`,
  ...s,
})));

const salaryHistoryRows = computed(() => salaryHistory.value.map(s => ({
  period: `${String(s.month).padStart(2, '0')}.${s.year}`,
  ...s,
})));

const summaryColumns = computed(() => ([
  { key: 'period', label: t('app.period') || 'Период' },
  { key: 'attendedDays', label: t('app.attendedDays') || 'Отработано дней' },
  { key: 'missedDays', label: t('app.missedDays') || 'Пропущено' },
  { key: 'lateDays', label: t('app.lateDays') || 'Опоздания' },
  { key: 'lateMadeUpDays', label: t('app.lateMadeUpDays') || 'Компенсировано' },
  { key: 'earlyLeaveDays', label: t('app.earlyLeaveDays') || 'Ранние уходы' },
  { key: 'totalWorkedHours', label: t('app.totalWorkedHours') || 'Часов всего' },
]));

const salaryColumns = computed(() => ([
  { key: 'period', label: t('app.period') || 'Период' },
  { key: 'totalAmount', label: t('app.totalAmount') || 'Итого' },
  { key: 'baseAmount', label: t('app.baseAmount') || 'База' },
  { key: 'overtimeAmount', label: t('app.overtimeAmount') || 'Переработка' },
  { key: 'penaltyAmount', label: t('app.penaltyAmount') || 'Штрафы' },
]));

function formatAmount(amount: number, currency: string): string {
  return `${amount.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ${currency || ''}`.trim();
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const hubToken = useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value;
    const tok = await ensureAtraceToken(nsSlug.value, hubToken);
    if (!tok) {
      error.value = t('common.notAuthenticated') || 'Не авторизован';
      return;
    }

    const userId = user.value?.id;
    if (!userId) {
      error.value = t('common.notAuthenticated') || 'Не авторизован';
      return;
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const [
      { atraceGetActiveScheduleAssignment, atraceGetShiftPatterns },
      { atraceGetMonthlySummary, atraceGetSummaryRange },
      { atraceCalculateSalary, atraceGetSalaryHistory },
    ] = await Promise.all([
      import('@/api/atrace/schedule/schedule'),
      import('@/api/atrace/attendance/summary'),
      import('@/api/atrace/salary/payroll'),
    ]);

    // Schedule (best-effort -- absence of an assignment is a normal state, not an error)
    try {
      const a = await atraceGetActiveScheduleAssignment(userId, undefined, nsSlug.value);
      assignment.value = a;
      if (a) {
        const patterns = await atraceGetShiftPatterns(undefined, nsSlug.value);
        pattern.value = patterns.find(p => p.id === a.shiftPatternId) || null;
      }
    } catch (e) {
      // schedule.view might not be granted -- leave the section empty rather than failing the whole page
    }

    // Current month summary + trailing history (oldest first, current month included)
    const startMonth = month - 5 <= 0 ? { y: year - 1, m: month - 5 + 12 } : { y: year, m: month - 5 };
    const [summary, history] = await Promise.all([
      atraceGetMonthlySummary('', year, month, nsSlug.value),
      atraceGetSummaryRange('', startMonth.y, startMonth.m, year, month, nsSlug.value),
    ]);
    currentSummary.value = summary;
    summaryHistory.value = history;

    // Salary: projected current month + frozen trailing history. Gracefully
    // hidden (not an error) if the user has no salary configured or lacks
    // salary/view for themselves.
    try {
      const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
      const today = now.toISOString().split('T')[0];
      const [proj, hist] = await Promise.all([
        atraceCalculateSalary(monthStart, today, undefined, nsSlug.value),
        atraceGetSalaryHistory(6, undefined, nsSlug.value),
      ]);
      projectedSalary.value = proj;
      salaryHistory.value = hist;
    } catch (e) {
      salaryUnavailable.value = true;
    }
  } catch (e: any) {
    error.value = isAtracePermissionError(e)
      ? (t('app.attendancePermissionError') || 'Недостаточно прав')
      : (t('app.attendanceLoadFailed') || 'Не удалось загрузить');
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  load();
  loadMyRecords();
  loadPostTitles();
});
</script>

<template>
  <div class="h-full flex flex-col p-4 pb-safe-or-4 min-h-0 overflow-auto">
    <div class="flex justify-between items-center mb-4 flex-shrink-0">
      <div class="text-left">
        <h1 class="text-2xl font-semibold">
          {{ t('app.myStats') || 'Моя статистика' }}
        </h1>
        <span class="text-sm text-gray-600 dark:text-gray-400">{{ t('app.myStatsSubtitle') || 'График, посещаемость и зарплата' }}</span>
      </div>
      <UButton
        icon="lucide:arrow-left"
        size="xs"
        color="primary"
        variant="soft"
        class="gap-2"
        @click="goBack"
      >
        <span class="hidden sm:inline">{{ t('app.back') }}</span>
      </UButton>
    </div>

    <div
      v-if="loading"
      class="text-gray-500 text-sm"
    >
      {{ t('app.loading') }}
    </div>

    <UAlert
      v-else-if="error"
      icon="i-heroicons-exclamation-triangle"
      color="red"
      variant="soft"
      :description="error"
      class="mb-4"
    />

    <template v-else>
      <!-- Schedule -->
      <div class="mb-6 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
        <h2 class="text-base font-medium mb-2">
          {{ t('app.mySchedule') || 'Мой график' }}
        </h2>
        <div v-if="pattern">
          <p class="font-medium">
            {{ pattern.name }}
          </p>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ patternSummary(pattern) }}
          </p>
          <p
            v-if="assignment"
            class="text-xs text-gray-400 mt-1"
          >
            {{ t('app.effectiveFrom') }}: {{ assignment.effectiveFrom }}
          </p>
        </div>
        <p
          v-else
          class="text-sm text-gray-500 dark:text-gray-400"
        >
          {{ t('app.noScheduleAssigned') || 'График не назначен -- используется общая месячная норма.' }}
        </p>
      </div>

      <!-- Current month -->
      <div
        v-if="currentSummary"
        class="mb-6 p-4 rounded-xl border border-gray-200 dark:border-gray-700"
      >
        <h2 class="text-base font-medium mb-3">
          {{ t('app.thisMonth') || 'Текущий месяц' }}
        </h2>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div>
            <div class="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
              {{ currentSummary.attendedDays }}/{{ currentSummary.requiredDays }}
            </div>
            <div class="text-xs text-gray-500">
              {{ t('app.attendedDays') || 'Отработано дней' }}
            </div>
          </div>
          <div>
            <div class="text-2xl font-semibold text-red-600 dark:text-red-400">
              {{ currentSummary.missedDays }}
            </div>
            <div class="text-xs text-gray-500">
              {{ t('app.missedDays') || 'Пропущено' }}
            </div>
          </div>
          <div>
            <div class="text-2xl font-semibold text-amber-600 dark:text-amber-400">
              {{ currentSummary.lateDays }}
              <span
                v-if="currentSummary.lateMadeUpDays > 0"
                class="text-sm text-gray-400"
              >(-{{ currentSummary.lateMadeUpDays }})</span>
            </div>
            <div class="text-xs text-gray-500">
              {{ t('app.lateDays') || 'Опоздания' }}
            </div>
          </div>
          <div>
            <div class="text-2xl font-semibold">
              {{ currentSummary.totalWorkedHours.toFixed(1) }}
            </div>
            <div class="text-xs text-gray-500">
              {{ t('app.totalWorkedHours') || 'Часов' }}
            </div>
          </div>
        </div>
      </div>

      <!-- Check-in history -->
      <div class="mb-6">
        <h2 class="text-base font-medium mb-3">
          {{ t('app.myCheckInHistory') || 'История отметок' }}
        </h2>
        <div
          v-if="myRecordsLoading"
          class="flex items-center gap-2 text-sm text-gray-500 py-4"
        >
          <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
          {{ t('app.loading') }}
        </div>
        <div
          v-else-if="myRecordsByDay.length === 0"
          class="text-sm text-gray-500 py-2"
        >
          {{ t('app.noAttendanceRecords') || 'Отметок пока нет' }}
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="{ date, records } in myRecordsByDay"
            :key="date"
            class="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2"
          >
            <div class="text-sm font-medium mb-1.5 capitalize">
              {{ formatRecordDate(date) }}
            </div>
            <div class="flex flex-wrap gap-1.5">
              <div
                v-for="r in records"
                :key="r.id"
                class="inline-flex items-center gap-1.5 rounded-md bg-gray-50 dark:bg-gray-800/60 px-2 py-1 text-xs"
              >
                <span class="font-medium">{{ formatRecordTime(r) }}</span>
                <span class="text-gray-500">{{ recordDirectionLabel(r, records) }}</span>
                <span
                  v-if="postTitleById[r.postId]"
                  class="text-gray-400"
                >· {{ postTitleById[r.postId] }}</span>
                <span class="text-gray-400">· {{ methodLabel(r.method) }}</span>
                <UIcon
                  v-if="r.suspicious"
                  name="i-heroicons-exclamation-triangle"
                  class="w-3.5 h-3.5 text-amber-500"
                  :title="t('common.suspiciousReasons') || 'Отмечено как подозрительное'"
                />
                <UIcon
                  v-if="r.geoConfirmed === true"
                  name="i-heroicons-map-pin"
                  class="w-3.5 h-3.5 text-emerald-500"
                  :title="t('app.geoConfirmedHint', { meters: GEO_CONFIRM_RADIUS_M }) || 'Гео подтверждено'"
                />
              </div>
            </div>
          </div>
          <div
            v-if="myRecordsHasMore"
            class="flex justify-center pt-2"
          >
            <UButton
              size="xs"
              variant="soft"
              :loading="myRecordsLoadingMore"
              @click="loadMyRecords(false)"
            >
              {{ t('app.loadMore') || 'Показать ещё' }}
            </UButton>
          </div>
        </div>
      </div>

      <!-- Projected salary -->
      <div
        v-if="projectedSalary"
        class="mb-6 p-4 rounded-xl border border-gray-200 dark:border-gray-700"
      >
        <h2 class="text-base font-medium mb-3">
          {{ t('app.projectedSalary') || 'Ожидаемая зарплата (текущий месяц)' }}
        </h2>
        <div class="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mb-2">
          {{ formatAmount(projectedSalary.totalAmount, projectedSalary.currency) }}
        </div>
        <div class="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
          <span>{{ t('app.baseAmount') || 'База' }}: {{ formatAmount(projectedSalary.baseAmount, projectedSalary.currency) }}</span>
          <span v-if="projectedSalary.overtimeAmount > 0">{{ t('app.overtimeAmount') || 'Переработка' }}: +{{ formatAmount(projectedSalary.overtimeAmount, projectedSalary.currency) }}</span>
          <span v-if="projectedSalary.penaltyAmount > 0">{{ t('app.penaltyAmount') || 'Штрафы' }}: -{{ formatAmount(projectedSalary.penaltyAmount, projectedSalary.currency) }}</span>
        </div>
      </div>

      <!-- Attendance history -->
      <div class="mb-6">
        <h2 class="text-base font-medium mb-3">
          {{ t('app.attendanceHistory') || 'История посещаемости' }}
        </h2>
        <div
          v-if="summaryHistoryRows.length === 0"
          class="text-gray-500 text-sm"
        >
          {{ t('app.noData') || 'Нет данных' }}
        </div>
        <div
          v-else
          class="h-[300px]"
        >
          <AppTable
            :rows="summaryHistoryRows"
            :columns="summaryColumns"
            :pagination="false"
            :total="summaryHistoryRows.length"
          >
            <template #totalWorkedHours-data="{ row }">
              {{ row.totalWorkedHours.toFixed(1) }}
            </template>
          </AppTable>
        </div>
      </div>

      <!-- Salary history -->
      <div v-if="!salaryUnavailable && salaryHistoryRows.length > 0">
        <h2 class="text-base font-medium mb-3">
          {{ t('app.salaryHistory') || 'История зарплаты' }}
        </h2>
        <div class="h-[300px]">
          <AppTable
            :rows="salaryHistoryRows"
            :columns="salaryColumns"
            :pagination="false"
            :total="salaryHistoryRows.length"
          >
            <template #totalAmount-data="{ row }">
              <span class="font-semibold">{{ formatAmount(row.totalAmount, row.currency) }}</span>
            </template>
            <template #baseAmount-data="{ row }">
              {{ formatAmount(row.baseAmount, row.currency) }}
            </template>
            <template #overtimeAmount-data="{ row }">
              <span v-if="row.overtimeAmount > 0" class="text-emerald-600 dark:text-emerald-400">+{{ formatAmount(row.overtimeAmount, row.currency) }}</span>
              <span v-else class="text-gray-400">—</span>
            </template>
            <template #penaltyAmount-data="{ row }">
              <span v-if="row.penaltyAmount > 0" class="text-red-600 dark:text-red-400">−{{ formatAmount(row.penaltyAmount, row.currency) }}</span>
              <span v-else class="text-gray-400">—</span>
            </template>
          </AppTable>
        </div>
      </div>
    </template>
  </div>
</template>
