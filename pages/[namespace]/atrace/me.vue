<script lang="ts" setup>
import AppSkeleton from '@/components/ui/AppSkeleton.vue';
definePageMeta({ layout: 'workspace' });

import { useI18n } from '@/composables/useI18n';
import { useAuth } from '@/composables/useAuth';
import { useAtraceToken } from '@/composables/useAtraceToken';
import { CookieKeys } from '@/utils/storageKeys';
import { isAtracePermissionError } from '@/utils/atracePermissions';
import { GEO_CONFIRM_RADIUS_M } from '@/utils/geolocation';
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

const monthTitle = new Date().toLocaleDateString('ru-RU', { month: 'long' });

function monthLabel(y: number, m: number): string {
  return new Date(y, m - 1, 1).toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' }).replace(' г.', '');
}

// Attendance ring: attended / required days this month.
const ring = computed(() => {
  const s = currentSummary.value;
  const R = 46;
  const C = 2 * Math.PI * R;
  const pct = s && s.requiredDays ? Math.min(1, s.attendedDays / s.requiredDays) : 0;
  return { R, C, off: C * (1 - pct), pct: Math.round(pct * 100) };
});

const activeWeekdays = computed(() => (pattern.value?.type === 'FIXED_WEEKDAYS' ? (pattern.value.workDaysOfWeek || []) : null));

const histTab = ref<'attendance' | 'salary'>('attendance');

function barPct(s: AtraceAttendanceSummary, k: 'attendedDays' | 'missedDays'): number {
  const total = (s.attendedDays + s.missedDays) || 1;
  return Math.round((100 * s[k]) / total);
}

function dayParts(date: string) {
  const d = new Date(date);
  return {
    num: d.getDate(),
    mon: d.toLocaleDateString('ru-RU', { month: 'short' }).replace('.', ''),
    wd: d.toLocaleDateString('ru-RU', { weekday: 'short' }),
  };
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
  <div class="at-scope h-full flex flex-col p-4 pb-safe-or-4 min-h-0 overflow-auto">
    <div class="flex justify-between items-center mb-4 flex-shrink-0">
      <div class="text-left">
        <h1 class="at-title">
          {{ t('app.myStats') || 'Моя статистика' }}
        </h1>
        <p class="at-sub">{{ t('app.myStatsSubtitle') || 'График, посещаемость и зарплата' }}</p>
      </div>
      <button
        type="button"
        class="at-btn at-btn--blue"
        @click="goBack"
      >
        <UIcon name="lucide:arrow-left" class="h-4 w-4" />
        <span class="hidden sm:inline">{{ t('app.back') }}</span>
      </button>
    </div>

    <div v-if="loading">
      <AppSkeleton variant="stats" />
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
      <!-- Row 1: salary hero + this month -->
      <div
        class="mb-4 grid gap-4"
        :class="projectedSalary ? 'lg:grid-cols-[1.1fr_1fr]' : ''"
      >
        <div
          v-if="projectedSalary"
          class="me-hero"
        >
          <p class="text-xs font-semibold uppercase tracking-[0.14em] text-white/75">
            {{ t('app.projectedSalary') || 'Ожидаемая зарплата' }}
          </p>
          <p class="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
            {{ formatAmount(projectedSalary.totalAmount, projectedSalary.currency) }}
          </p>
          <div class="mt-5 flex flex-wrap gap-2">
            <span class="me-hero-chip">{{ t('app.baseAmount') || 'База' }} · {{ formatAmount(projectedSalary.baseAmount, projectedSalary.currency) }}</span>
            <span
              v-if="projectedSalary.overtimeAmount > 0"
              class="me-hero-chip"
            >{{ t('app.overtimeAmount') || 'Переработка' }} · +{{ formatAmount(projectedSalary.overtimeAmount, projectedSalary.currency) }}</span>
            <span
              v-if="projectedSalary.penaltyAmount > 0"
              class="me-hero-chip"
            >{{ t('app.penaltyAmount') || 'Штрафы' }} · −{{ formatAmount(projectedSalary.penaltyAmount, projectedSalary.currency) }}</span>
          </div>
        </div>

        <div
          v-if="currentSummary"
          class="at-panel"
        >
          <h2 class="at-h2 mb-4">
            {{ t('app.thisMonth') || 'Текущий месяц' }}
          </h2>
          <div class="flex flex-col items-center gap-4 sm:flex-row sm:gap-5">
            <div class="relative h-28 w-28 flex-shrink-0">
              <svg
                viewBox="0 0 100 100"
                class="h-full w-full -rotate-90"
              >
                <defs>
                  <linearGradient
                    id="meRing"
                    x1="0"
                    y1="0"
                    x2="1"
                    y2="1"
                  >
                    <stop
                      offset="0"
                      stop-color="#2563eb"
                    />
                    <stop
                      offset="1"
                      stop-color="#10b981"
                    />
                  </linearGradient>
                </defs>
                <circle
                  cx="50"
                  cy="50"
                  :r="ring.R"
                  fill="none"
                  stroke-width="9"
                  class="stroke-slate-900/10 dark:stroke-white/10"
                />
                <circle
                  cx="50"
                  cy="50"
                  :r="ring.R"
                  fill="none"
                  stroke-width="9"
                  stroke-linecap="round"
                  stroke="url(#meRing)"
                  :stroke-dasharray="ring.C"
                  :stroke-dashoffset="ring.off"
                  style="transition: stroke-dashoffset 0.45s cubic-bezier(0.32, 0.72, 0, 1)"
                />
              </svg>
              <div class="absolute inset-0 flex flex-col items-center justify-center">
                <span class="text-2xl font-extrabold tracking-tight">{{ currentSummary.attendedDays }}<span class="text-sm font-semibold text-gray-400">/{{ currentSummary.requiredDays }}</span></span>
                <span class="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{{ t('app.days') || 'дней' }}</span>
              </div>
            </div>
            <div class="grid w-full flex-1 grid-cols-3 gap-2 text-center">
              <div class="at-stat">
                <div class="text-xl font-extrabold text-red-600 dark:text-red-400">
                  {{ currentSummary.missedDays }}
                </div>
                <div class="text-[11px] leading-tight text-gray-500">
                  {{ t('app.missedDays') || 'Пропущено' }}
                </div>
              </div>
              <div class="at-stat">
                <div class="text-xl font-extrabold text-amber-600 dark:text-amber-400">
                  {{ currentSummary.lateDays }}<span
                    v-if="currentSummary.lateMadeUpDays > 0"
                    class="text-xs font-semibold text-gray-400"
                  >(-{{ currentSummary.lateMadeUpDays }})</span>
                </div>
                <div class="text-[11px] leading-tight text-gray-500">
                  {{ t('app.lateDays') || 'Опоздания' }}
                </div>
              </div>
              <div class="at-stat">
                <div class="text-xl font-extrabold">
                  {{ currentSummary.totalWorkedHours.toFixed(1) }}
                </div>
                <div class="text-[11px] leading-tight text-gray-500">
                  {{ t('app.totalWorkedHours') || 'Часов' }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Row 2: schedule + history | check-in timeline -->
      <div class="grid gap-4 lg:grid-cols-2">
        <div class="space-y-4">
          <!-- Schedule -->
          <div class="at-panel">
            <h2 class="at-h2 mb-3">
              {{ t('app.mySchedule') || 'Мой график' }}
            </h2>
            <div v-if="pattern">
              <div class="flex flex-wrap items-center gap-2">
                <p class="text-xl font-extrabold tracking-tight">
                  {{ pattern.name }}
                </p>
                <span class="at-chip">
                  <UIcon
                    name="lucide:clock"
                    class="h-3.5 w-3.5"
                  />
                  {{ pattern.shiftStartTime }}–{{ pattern.shiftEndTime }}
                </span>
              </div>
              <div
                v-if="activeWeekdays"
                class="mt-3 flex flex-wrap gap-1.5"
              >
                <span
                  v-for="w in WEEKDAYS"
                  :key="w.value"
                  class="me-wd"
                  :class="activeWeekdays.includes(w.value) ? 'me-wd--on' : ''"
                >{{ w.label }}</span>
              </div>
              <p
                v-else
                class="mt-2 text-sm text-gray-500 dark:text-gray-400"
              >
                {{ pattern.rotationWorkDays }}/{{ pattern.rotationOffDays }} · {{ pattern.shiftStartTime }}–{{ pattern.shiftEndTime }}
              </p>
              <p
                v-if="assignment"
                class="mt-3 text-xs text-gray-400"
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

          <!-- History by month (cards instead of tables) -->
          <div class="at-panel">
            <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 class="at-h2">
                {{ histTab === 'attendance' ? (t('app.attendanceHistory') || 'История посещаемости') : (t('app.salaryHistory') || 'История зарплаты') }}
              </h2>
              <div
                v-if="!salaryUnavailable && salaryHistoryRows.length > 0"
                class="pl-toggle"
              >
                <button
                  type="button"
                  class="pl-toggle__btn !px-4 !py-1.5"
                  :class="histTab === 'attendance' ? 'pl-toggle__btn--on' : ''"
                  @click="histTab = 'attendance'"
                >
                  {{ t('app.attendance') || 'Посещаемость' }}
                </button>
                <button
                  type="button"
                  class="pl-toggle__btn !px-4 !py-1.5"
                  :class="histTab === 'salary' ? 'pl-toggle__btn--on' : ''"
                  @click="histTab = 'salary'"
                >
                  {{ t('app.salary') || 'Зарплата' }}
                </button>
              </div>
            </div>

            <template v-if="histTab === 'attendance'">
              <p
                v-if="summaryHistoryRows.length === 0"
                class="text-sm text-gray-500"
              >
                {{ t('app.noData') || 'Нет данных' }}
              </p>
              <div
                v-else
                class="space-y-2"
              >
                <div
                  v-for="s in [...summaryHistory].reverse()"
                  :key="`${s.year}-${s.month}`"
                  class="at-row"
                >
                  <div class="flex items-center justify-between gap-3">
                    <span class="text-sm font-bold capitalize">{{ monthLabel(s.year, s.month) }}</span>
                    <span class="text-xs text-gray-500 dark:text-gray-400">{{ s.attendedDays }}/{{ s.requiredDays }} {{ t('app.days') || 'дн.' }} · {{ s.totalWorkedHours.toFixed(1) }} {{ t('app.hoursShort') || 'ч' }}</span>
                  </div>
                  <div class="me-bar mt-2">
                    <span
                      class="me-bar__ok"
                      :style="{ width: barPct(s, 'attendedDays') + '%' }"
                    />
                    <span
                      class="me-bar__bad"
                      :style="{ width: barPct(s, 'missedDays') + '%' }"
                    />
                  </div>
                  <div class="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                    <span
                      v-if="s.missedDays"
                      class="at-chip !text-red-600 dark:!text-red-300"
                    >{{ t('app.missedDays') || 'Пропущено' }}: {{ s.missedDays }}</span>
                    <span
                      v-if="s.lateDays"
                      class="at-chip !text-amber-700 dark:!text-amber-300"
                    >{{ t('app.lateDays') || 'Опоздания' }}: {{ s.lateDays }}<template v-if="s.lateMadeUpDays"> (−{{ s.lateMadeUpDays }})</template></span>
                    <span
                      v-if="s.earlyLeaveDays"
                      class="at-chip"
                    >{{ t('app.earlyLeaveDays') || 'Ранние уходы' }}: {{ s.earlyLeaveDays }}</span>
                  </div>
                </div>
              </div>
            </template>

            <template v-else>
              <div class="space-y-2">
                <div
                  v-for="s in salaryHistoryRows"
                  :key="s.period"
                  class="at-row"
                >
                  <div class="flex items-baseline justify-between gap-3">
                    <span class="text-sm font-bold">{{ s.period }}</span>
                    <span class="text-lg font-extrabold tracking-tight">{{ formatAmount(s.totalAmount, s.currency) }}</span>
                  </div>
                  <div class="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                    <span class="at-chip">{{ t('app.baseAmount') || 'База' }}: {{ formatAmount(s.baseAmount, s.currency) }}</span>
                    <span
                      v-if="s.overtimeAmount > 0"
                      class="at-chip !text-emerald-700 dark:!text-emerald-300"
                    >+{{ formatAmount(s.overtimeAmount, s.currency) }}</span>
                    <span
                      v-if="s.penaltyAmount > 0"
                      class="at-chip !text-red-600 dark:!text-red-300"
                    >−{{ formatAmount(s.penaltyAmount, s.currency) }}</span>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- Check-in timeline -->
        <div class="at-panel">
          <h2 class="at-h2 mb-3">
            {{ t('app.myCheckInHistory') || 'История отметок' }}
          </h2>
          <div
            v-if="myRecordsLoading"
            class="flex items-center gap-2 py-4 text-sm text-gray-500"
          >
            <UIcon
              name="i-heroicons-arrow-path"
              class="h-4 w-4 animate-spin"
            />
            {{ t('app.loading') }}
          </div>
          <p
            v-else-if="myRecordsByDay.length === 0"
            class="py-2 text-sm text-gray-500"
          >
            {{ t('app.noAttendanceRecords') || 'Отметок пока нет' }}
          </p>
          <div
            v-else
            class="max-h-[640px] space-y-2 overflow-y-auto pr-1 no-scrollbar"
          >
            <div
              v-for="{ date, records } in myRecordsByDay"
              :key="date"
              class="at-row flex gap-3"
            >
              <div class="me-day">
                <span class="text-lg font-extrabold leading-none">{{ dayParts(date).num }}</span>
                <span class="text-[10px] font-semibold uppercase tracking-wide">{{ dayParts(date).mon }}</span>
              </div>
              <div class="min-w-0 flex-1">
                <div class="mb-1.5 text-xs font-semibold capitalize text-gray-400">
                  {{ dayParts(date).wd }}
                </div>
                <div class="flex flex-wrap gap-1.5">
                  <div
                    v-for="r in records"
                    :key="r.id"
                    class="at-chip"
                  >
                    <span class="font-bold">{{ formatRecordTime(r) }}</span>
                    <span class="text-gray-500">{{ recordDirectionLabel(r, records) }}</span>
                    <span
                      v-if="postTitleById[r.postId]"
                      class="text-gray-400"
                    >· {{ postTitleById[r.postId] }}</span>
                    <span class="text-gray-400">· {{ methodLabel(r.method) }}</span>
                    <UIcon
                      v-if="r.suspicious"
                      name="i-heroicons-exclamation-triangle"
                      class="h-3.5 w-3.5 text-amber-500"
                      :title="t('common.suspiciousReasons') || 'Отмечено как подозрительное'"
                    />
                    <UIcon
                      v-if="r.geoConfirmed === true"
                      name="i-heroicons-map-pin"
                      class="h-3.5 w-3.5 text-emerald-500"
                      :title="t('app.geoConfirmedHint', { meters: GEO_CONFIRM_RADIUS_M }) || 'Гео подтверждено'"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div
              v-if="myRecordsHasMore"
              class="flex justify-center pt-2"
            >
              <button
                type="button"
                class="pill-outline !py-1.5 !text-xs"
                :disabled="myRecordsLoadingMore"
                @click="loadMyRecords(false)"
              >
                {{ t('app.loadMore') || 'Показать ещё' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
