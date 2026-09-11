<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useRoute } from 'vue-router';
import { useAtraceAnalytics, type AnalyticsInsightKind } from '@/composables/useAtraceAnalytics';

const props = defineProps<{
  postId: string | null;
  ready?: boolean;
}>();

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => (route.params.namespace as string) || '');

const { data, loading, error, load } = useAtraceAnalytics(nsSlug);

type Period = 'month' | 'week' | '30d';
const period = ref<Period>('month');

function formatDateYMD(d: Date) {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().split('T')[0];
}

const range = computed(() => {
  const today = new Date();
  let start: Date;
  if (period.value === 'month') {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
  } else if (period.value === 'week') {
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    start = new Date(today);
    start.setDate(today.getDate() + diff);
  } else {
    start = new Date(today);
    start.setDate(today.getDate() - 29);
  }
  return { startDate: formatDateYMD(start), endDate: formatDateYMD(today) };
});

async function refresh() {
  if (props.ready === false) return;
  await load(range.value.startDate, range.value.endDate, props.postId);
}

watch([() => props.postId, () => props.ready, period], refresh, { immediate: true });

// ---- formatting helpers (spelled out, no cryptic abbreviations) ----
const HOUR = () => t('app.analyticsUnitHour') || 'ч';
const MIN = () => t('app.analyticsUnitMin') || 'мин';
const DAYS = () => t('app.analyticsUnitDays') || 'дней';

const pct = (v: number) => `${Math.round(v * 100)}%`;
const hoursText = (v: number) => {
  const totalMin = Math.round(v * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m ? `${h} ${HOUR()} ${m} ${MIN()}` : `${h} ${HOUR()}`;
};

function deltaColor(d: number | null, lowerIsBetter: boolean): string {
  if (d === null || Math.abs(d) < 0.005) return 'text-gray-400 dark:text-gray-500';
  const good = lowerIsBetter ? d < 0 : d > 0;
  return good ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
}
function deltaArrow(d: number | null): string {
  if (d === null || Math.abs(d) < 0.005) return '';
  return d > 0 ? '▲' : '▼';
}
// A rate KPI's period-over-period change, shown as a plain "+3%" (the reader
// doesn't need "percentage points" — the (i) note explains it's vs. the
// previous period).
function rateDeltaText(d: number | null): string | null {
  if (d === null) return null;
  const n = Math.round(d * 100);
  return `${n >= 0 ? '+' : ''}${n}%`;
}

type KpiCard = {
  key: string;
  label: string;
  value: string;
  deltaText: string | null;
  deltaArrow: string;
  deltaClass: string;
  hasTrend: boolean; // false = this KPI has no comparison by design
  sub: string | null;
  help: { formula: string; meaning: string; improve: string };
};

const kpiCards = computed<KpiCard[]>(() => {
  const d = data.value;
  if (!d) return [];
  const h = (k: string) => ({
    formula: t(`app.analyticsHelp.${k}.formula`) as string,
    meaning: t(`app.analyticsHelp.${k}.meaning`) as string,
    improve: t(`app.analyticsHelp.${k}.improve`) as string,
  });
  const avgDelta = d.avgHoursPerDay.delta;
  return [
    {
      key: 'attendance',
      label: t('app.analyticsKpiAttendance') || 'Посещаемость',
      value: pct(d.turnoutRate.value),
      deltaText: rateDeltaText(d.turnoutRate.delta),
      deltaArrow: deltaArrow(d.turnoutRate.delta),
      deltaClass: deltaColor(d.turnoutRate.delta, false),
      hasTrend: true,
      sub: `${d.daysPresent} ${t('app.analyticsOutOf') || 'из'} ${d.requiredDays} ${DAYS()}`,
      help: h('attendance'),
    },
    {
      key: 'avgHours',
      label: t('app.analyticsKpiAvgHours') || 'Часов за смену',
      value: hoursText(d.avgHoursPerDay.value),
      deltaText:
        avgDelta === null
          ? null
          : `${avgDelta >= 0 ? '+' : ''}${Math.round(avgDelta * 60)} ${MIN()} ${t('app.analyticsPerDay') || 'в день'}`,
      deltaArrow: deltaArrow(avgDelta),
      deltaClass: deltaColor(avgDelta, false),
      hasTrend: true,
      sub: null,
      help: h('avgHours'),
    },
    {
      key: 'late',
      label: t('app.analyticsKpiLate') || 'Опоздания',
      value: pct(d.lateRate.value),
      deltaText: rateDeltaText(d.lateRate.delta),
      deltaArrow: deltaArrow(d.lateRate.delta),
      deltaClass: deltaColor(d.lateRate.delta, true),
      hasTrend: true,
      sub: null,
      help: h('late'),
    },
    {
      key: 'early',
      label: t('app.analyticsKpiEarly') || 'Ранние уходы',
      value: pct(d.earlyLeaveRate.value),
      deltaText: rateDeltaText(d.earlyLeaveRate.delta),
      deltaArrow: deltaArrow(d.earlyLeaveRate.delta),
      deltaClass: deltaColor(d.earlyLeaveRate.delta, true),
      hasTrend: true,
      sub: null,
      help: h('early'),
    },
    {
      key: 'geo',
      label: t('app.analyticsKpiGeo') || 'Отметки по геолокации',
      value: pct(d.geoConfirmRate.value),
      deltaText: rateDeltaText(d.geoConfirmRate.delta),
      deltaArrow: deltaArrow(d.geoConfirmRate.delta),
      deltaClass: deltaColor(d.geoConfirmRate.delta, false),
      hasTrend: true,
      sub: null,
      help: h('geo'),
    },
    {
      key: 'openShift',
      label: t('app.analyticsKpiOpenShift') || 'Незакрытые смены',
      value: pct(d.openShiftRate.value),
      deltaText: null,
      deltaArrow: '',
      deltaClass: '',
      hasTrend: false,
      sub: t('app.analyticsOpenShiftHint') || 'отметился, но не закрыл смену',
      help: h('openShift'),
    },
  ];
});

const insightMeta: Record<AnalyticsInsightKind, { icon: string; color: string; label: string }> = {
  'no-show': { icon: 'i-heroicons-user-minus', color: 'text-red-600 dark:text-red-400', label: t('app.analyticsFlagNoShow') || 'Не отмечается' },
  'no-checkout': { icon: 'i-heroicons-arrow-right-on-rectangle', color: 'text-amber-600 dark:text-amber-400', label: t('app.analyticsFlagNoCheckout') || 'Не закрывает смену' },
  'frequently-late': { icon: 'i-heroicons-clock', color: 'text-orange-600 dark:text-orange-400', label: t('app.analyticsFlagLate') || 'Часто опаздывает' },
  'frequently-early': { icon: 'i-heroicons-arrow-left-on-rectangle', color: 'text-orange-600 dark:text-orange-400', label: t('app.analyticsFlagEarly') || 'Часто уходит раньше' },
  'low-attendance': { icon: 'i-heroicons-chart-bar', color: 'text-orange-600 dark:text-orange-400', label: t('app.analyticsFlagLowAttendance') || 'Низкая посещаемость' },
  'config-hint': { icon: 'i-heroicons-information-circle', color: 'text-blue-600 dark:text-blue-400', label: t('app.analyticsFlagConfig') || 'Настройка' },
};
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden">
    <!-- Period filter -->
    <div class="mb-3 flex flex-wrap items-center gap-1.5 flex-shrink-0">
      <UButton
        :color="period === 'month' ? 'primary' : 'gray'"
        size="sm"
        @click="period = 'month'"
      >
        {{ t('app.thisMonth') || 'Текущий месяц' }}
      </UButton>
      <UButton
        :color="period === 'week' ? 'primary' : 'gray'"
        size="sm"
        @click="period = 'week'"
      >
        {{ t('app.thisWeek') || 'Неделя' }}
      </UButton>
      <UButton
        :color="period === '30d' ? 'primary' : 'gray'"
        size="sm"
        @click="period = '30d'"
      >
        {{ t('app.analyticsLast30') || '30 дней' }}
      </UButton>
    </div>

    <div class="flex-1 min-h-0 overflow-auto pb-safe-or-4">
      <div
        v-if="loading"
        class="flex flex-col items-center justify-center py-16 text-gray-400"
      >
        <div class="h-9 w-9 rounded-full border-[3px] border-gray-200 border-t-emerald-500 animate-spin mb-3" />
        <span class="text-sm">{{ t('app.loading') || 'Загрузка...' }}</span>
      </div>

      <div
        v-else-if="error"
        class="flex flex-col items-center justify-center py-16 text-red-500"
      >
        <UIcon
          name="i-heroicons-exclamation-triangle"
          class="w-10 h-10 mb-2"
        />
        <span class="text-sm">{{ error }}</span>
      </div>

      <template v-else-if="data">
        <!-- KPI grid -->
        <div class="grid grid-cols-2 lg:grid-cols-3 gap-2.5 mb-4">
          <div
            v-for="c in kpiCards"
            :key="c.key"
            class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3"
          >
            <div class="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <span>{{ c.label }}</span>
              <UPopover
                :popper="{ placement: 'top', strategy: 'fixed' }"
                :ui="{ width: 'max-w-[280px]' }"
              >
                <button
                  type="button"
                  class="flex-shrink-0 text-gray-300 transition-colors hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-300"
                  :aria-label="t('app.analyticsHelpAria') || 'Как считается и что значит'"
                  @click.stop
                >
                  <UIcon
                    name="i-heroicons-information-circle"
                    class="w-3.5 h-3.5"
                  />
                </button>
                <template #panel>
                  <div class="p-3 max-w-[280px] text-xs leading-relaxed space-y-2">
                    <div class="font-semibold text-sm text-gray-900 dark:text-white">
                      {{ c.label }}
                    </div>
                    <div>
                      <div class="font-medium text-gray-500 dark:text-gray-400">
                        {{ t('app.analyticsHelpFormula') || 'Как считается' }}
                      </div>
                      <div class="text-gray-700 dark:text-gray-300">
                        {{ c.help.formula }}
                      </div>
                    </div>
                    <div>
                      <div class="font-medium text-gray-500 dark:text-gray-400">
                        {{ t('app.analyticsHelpMeaning') || 'Что значит' }}
                      </div>
                      <div class="text-gray-700 dark:text-gray-300">
                        {{ c.help.meaning }}
                      </div>
                    </div>
                    <div>
                      <div class="font-medium text-gray-500 dark:text-gray-400">
                        {{ t('app.analyticsHelpImprove') || 'Как улучшить' }}
                      </div>
                      <div class="text-gray-700 dark:text-gray-300">
                        {{ c.help.improve }}
                      </div>
                    </div>
                  </div>
                </template>
              </UPopover>
            </div>

            <div class="text-2xl font-semibold mt-0.5">
              {{ c.value }}
            </div>

            <div
              v-if="c.deltaText"
              class="text-xs mt-0.5"
              :class="c.deltaClass"
            >
              {{ c.deltaArrow }} {{ c.deltaText }}
              <span class="text-gray-400 dark:text-gray-500">{{ t('app.analyticsVsPrevPeriod') || 'к прошлому периоду' }}</span>
            </div>
            <div
              v-else-if="c.hasTrend"
              class="text-xs mt-0.5 text-gray-400"
            >
              {{ t('app.analyticsNoTrend') || 'не с чем сравнить' }}
            </div>

            <div
              v-if="c.sub"
              class="text-[11px] text-gray-400 mt-0.5"
            >
              {{ c.sub }}
            </div>
          </div>
        </div>

        <!-- Needs attention -->
        <div class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 mb-4">
          <h4 class="text-sm font-semibold mb-2">
            {{ t('app.analyticsNeedsAttention') || 'Требуют внимания' }}
          </h4>
          <div
            v-if="!data.insights.length"
            class="text-sm text-gray-400 py-3 flex items-center gap-2"
          >
            <UIcon
              name="i-heroicons-check-circle"
              class="w-5 h-5 text-emerald-400"
            />
            {{ t('app.analyticsAllClear') || 'Всё спокойно — заметных отклонений нет' }}
          </div>
          <ul
            v-else
            class="divide-y divide-gray-100 dark:divide-gray-800"
          >
            <li
              v-for="(ins, i) in data.insights"
              :key="(ins.userId || 'hint') + ins.kind + i"
              class="py-2 flex items-start gap-2.5"
            >
              <UIcon
                :name="insightMeta[ins.kind].icon"
                class="w-4 h-4 mt-0.5 shrink-0"
                :class="insightMeta[ins.kind].color"
              />
              <div
                v-if="ins.kind === 'config-hint'"
                class="text-xs text-gray-600 dark:text-gray-300"
              >
                {{ ins.detail }}
              </div>
              <div
                v-else
                class="min-w-0"
              >
                <div class="text-sm font-medium truncate">
                  {{ ins.name }}
                </div>
                <div class="text-xs text-gray-500 dark:text-gray-400">
                  <span :class="insightMeta[ins.kind].color">{{ insightMeta[ins.kind].label }}</span>
                  — {{ ins.detail }}
                </div>
              </div>
            </li>
          </ul>
        </div>

        <!-- Arrival distribution -->
        <div class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
          <div class="flex items-baseline justify-between mb-2 gap-2">
            <h4 class="text-sm font-semibold">
              {{ t('app.analyticsArrivalTitle') || 'Когда приходят' }}
            </h4>
            <span
              v-if="data.medianArrival"
              class="text-xs text-gray-500 dark:text-gray-400"
            >
              {{ t('app.analyticsTypicalArrival') || 'обычно приходят к' }}
              <span class="font-semibold text-gray-700 dark:text-gray-200">{{ data.medianArrival }}</span>
            </span>
          </div>
          <div
            v-if="!data.arrivalBuckets.some(b => b.count)"
            class="text-sm text-gray-400 py-3"
          >
            {{ t('app.analyticsNoArrivalData') || 'Нет данных о времени прихода за период' }}
          </div>
          <div
            v-else
            class="space-y-1.5"
          >
            <div
              v-for="b in data.arrivalBuckets"
              :key="b.label"
              class="flex items-center gap-2 text-xs"
            >
              <span class="w-24 shrink-0 text-gray-500 dark:text-gray-400 tabular-nums">{{ b.label }}</span>
              <div class="flex-1 h-4 rounded bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div
                  class="h-full rounded bg-emerald-500 dark:bg-emerald-400"
                  :style="{ width: Math.max(b.pct * 100, b.count ? 5 : 0) + '%' }"
                />
              </div>
              <span class="w-14 shrink-0 text-right tabular-nums text-gray-600 dark:text-gray-300">
                {{ Math.round(b.pct * 100) }}% <span class="text-gray-400">({{ b.count }})</span>
              </span>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
