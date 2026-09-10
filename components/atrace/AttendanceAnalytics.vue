<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useRoute } from 'vue-router';
import { useAtraceAnalytics, type AnalyticsInsightKind } from '@/composables/useAtraceAnalytics';

const props = defineProps<{
  postId: string | null;
  ready?: boolean;
}>();

const { t, locale } = useI18n();
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

// ---- formatting helpers ----
const pct = (v: number) => `${Math.round(v * 100)}%`;
const hours = (v: number) => {
  const totalMin = Math.round(v * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m ? `${h} ${t('app.analyticsHoursShort') || 'ч'} ${m} ${t('app.analyticsMinShort') || 'м'}` : `${h} ${t('app.analyticsHoursShort') || 'ч'}`;
};
const deltaPP = (d: number | null) => (d === null ? null : `${d >= 0 ? '+' : ''}${Math.round(d * 100)} ${t('app.analyticsPP') || 'п.п.'}`);

// For "lower is better" KPIs (late / early leave / open shifts) a negative
// delta is the good direction; for the rest a positive delta is good.
function deltaColor(d: number | null, lowerIsBetter: boolean): string {
  if (d === null || Math.abs(d) < 0.005) return 'text-gray-400 dark:text-gray-500';
  const good = lowerIsBetter ? d < 0 : d > 0;
  return good ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
}
function deltaArrow(d: number | null): string {
  if (d === null || Math.abs(d) < 0.005) return '';
  return d > 0 ? '▲' : '▼';
}

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
          <div class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
            <div class="text-xs text-gray-500 dark:text-gray-400">
              {{ t('app.analyticsKpiAttendance') || 'Посещаемость' }}
            </div>
            <div class="text-2xl font-semibold mt-0.5">
              {{ pct(data.turnoutRate.value) }}
            </div>
            <div
              class="text-xs mt-0.5"
              :class="deltaColor(data.turnoutRate.delta, false)"
            >
              <span v-if="deltaPP(data.turnoutRate.delta)">{{ deltaArrow(data.turnoutRate.delta) }} {{ deltaPP(data.turnoutRate.delta) }}</span>
              <span
                v-else
                class="text-gray-400"
              >{{ t('app.analyticsNoTrend') || 'нет данных для сравнения' }}</span>
            </div>
            <div class="text-[11px] text-gray-400 mt-0.5">
              {{ data.daysPresent }} / {{ data.requiredDays }} {{ t('app.analyticsDaysShort') || 'дн.' }}
            </div>
          </div>

          <div class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
            <div class="text-xs text-gray-500 dark:text-gray-400">
              {{ t('app.analyticsKpiAvgHours') || 'Средняя выработка' }}
            </div>
            <div class="text-2xl font-semibold mt-0.5">
              {{ hours(data.avgHoursPerDay.value) }}
            </div>
            <div
              class="text-xs mt-0.5"
              :class="deltaColor(data.avgHoursPerDay.delta, false)"
            >
              <span v-if="data.avgHoursPerDay.delta !== null">{{ deltaArrow(data.avgHoursPerDay.delta) }} {{ (data.avgHoursPerDay.delta >= 0 ? '+' : '') + (Math.round(data.avgHoursPerDay.delta * 60)) }} {{ t('app.analyticsMinShort') || 'м' }}/{{ t('app.analyticsDayShort') || 'дн.' }}</span>
              <span
                v-else
                class="text-gray-400"
              >{{ t('app.analyticsNoTrend') || 'нет данных для сравнения' }}</span>
            </div>
          </div>

          <div class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
            <div class="text-xs text-gray-500 dark:text-gray-400">
              {{ t('app.analyticsKpiLate') || 'Опоздания' }}
            </div>
            <div class="text-2xl font-semibold mt-0.5">
              {{ pct(data.lateRate.value) }}
            </div>
            <div
              class="text-xs mt-0.5"
              :class="deltaColor(data.lateRate.delta, true)"
            >
              <span v-if="deltaPP(data.lateRate.delta)">{{ deltaArrow(data.lateRate.delta) }} {{ deltaPP(data.lateRate.delta) }}</span>
              <span
                v-else
                class="text-gray-400"
              >{{ t('app.analyticsNoTrend') || 'нет данных для сравнения' }}</span>
            </div>
          </div>

          <div class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
            <div class="text-xs text-gray-500 dark:text-gray-400">
              {{ t('app.analyticsKpiEarly') || 'Ранние уходы' }}
            </div>
            <div class="text-2xl font-semibold mt-0.5">
              {{ pct(data.earlyLeaveRate.value) }}
            </div>
            <div
              class="text-xs mt-0.5"
              :class="deltaColor(data.earlyLeaveRate.delta, true)"
            >
              <span v-if="deltaPP(data.earlyLeaveRate.delta)">{{ deltaArrow(data.earlyLeaveRate.delta) }} {{ deltaPP(data.earlyLeaveRate.delta) }}</span>
              <span
                v-else
                class="text-gray-400"
              >{{ t('app.analyticsNoTrend') || 'нет данных для сравнения' }}</span>
            </div>
          </div>

          <div class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
            <div class="text-xs text-gray-500 dark:text-gray-400">
              {{ t('app.analyticsKpiGeo') || 'Гео-подтверждение' }}
            </div>
            <div class="text-2xl font-semibold mt-0.5">
              {{ pct(data.geoConfirmRate.value) }}
            </div>
            <div
              class="text-xs mt-0.5"
              :class="deltaColor(data.geoConfirmRate.delta, false)"
            >
              <span v-if="deltaPP(data.geoConfirmRate.delta)">{{ deltaArrow(data.geoConfirmRate.delta) }} {{ deltaPP(data.geoConfirmRate.delta) }}</span>
              <span
                v-else
                class="text-gray-400"
              >{{ t('app.analyticsNoTrend') || 'нет данных для сравнения' }}</span>
            </div>
          </div>

          <div class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
            <div class="text-xs text-gray-500 dark:text-gray-400">
              {{ t('app.analyticsKpiOpenShift') || 'Незакрытые смены' }}
            </div>
            <div class="text-2xl font-semibold mt-0.5">
              {{ pct(data.openShiftRate.value) }}
            </div>
            <div class="text-[11px] text-gray-400 mt-1">
              {{ t('app.analyticsOpenShiftHint') || 'отметился, но не закрыл смену' }}
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
          <div class="flex items-baseline justify-between mb-2">
            <h4 class="text-sm font-semibold">
              {{ t('app.analyticsArrivalTitle') || 'Когда приходят' }}
            </h4>
            <span
              v-if="data.medianArrival"
              class="text-xs text-gray-500 dark:text-gray-400"
            >
              {{ t('app.analyticsMedianArrival') || 'медиана' }}: <span class="font-semibold text-gray-700 dark:text-gray-200">{{ data.medianArrival }}</span>
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
              <div class="flex-1 h-4 rounded bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <div
                  class="h-full bg-emerald-400/70 dark:bg-emerald-500/60"
                  :style="{ width: Math.max(b.pct * 100, b.count ? 2 : 0) + '%' }"
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
