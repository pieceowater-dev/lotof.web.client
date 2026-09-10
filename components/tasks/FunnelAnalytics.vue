<script lang="ts" setup>
// Funnel analytics panel for a lota Issues board. Pure client-side reduction
// of the board's deals (see useIssuesFunnelAnalytics) — stage funnel,
// stage-to-stage conversion, win rate, cycle times, weekly throughput.
import { useI18n } from '@/composables/useI18n';
import { useIssuesFunnelAnalytics, type FunnelStageDef } from '@/composables/useIssuesFunnelAnalytics';

const props = defineProps<{
  nsSlug: string;
  boardId: string;
  boardSlug?: string;
  stages: FunnelStageDef[];
}>();

const { t } = useI18n();
const { loading, error, result, load } = useIssuesFunnelAnalytics();

const PERIODS: { key: string; days: number | null; labelKey: string; fallback: string }[] = [
  { key: '30', days: 30, labelKey: 'tasks.funnelPeriod30', fallback: '30 дней' },
  { key: '90', days: 90, labelKey: 'tasks.funnelPeriod90', fallback: '90 дней' },
  { key: '365', days: 365, labelKey: 'tasks.funnelPeriod365', fallback: 'Год' },
  { key: 'all', days: null, labelKey: 'tasks.funnelPeriodAll', fallback: 'Всё время' },
];
const period = ref('90');
const activeDays = computed(() => PERIODS.find((p) => p.key === period.value)?.days ?? null);

async function reload() {
  if (!props.boardId || !props.stages.length) return;
  await load(props.nsSlug, props.boardId, props.stages, activeDays.value);
}

watch(() => [props.boardId, period.value], reload, { immediate: true });

const BAR_COLOR: Record<string, string> = {
  '': 'bg-gray-400 dark:bg-gray-500',
  blue: 'bg-blue-400 dark:bg-blue-500',
  green: 'bg-emerald-400 dark:bg-emerald-500',
  red: 'bg-red-400 dark:bg-red-500',
  yellow: 'bg-amber-400 dark:bg-amber-500',
};
const barColor = (c?: string) => BAR_COLOR[c || ''] || BAR_COLOR[''];

const maxEntered = computed(() => Math.max(1, ...(result.value?.stages.map((s) => s.entered) || [1])));

function fmtDays(v: number | null | undefined): string {
  if (v == null) return '—';
  if (v < 1) return `${Math.round(v * 24)} ${t('tasks.funnelHoursShort') || 'ч'}`;
  return `${v.toFixed(v < 10 ? 1 : 0)} ${t('tasks.funnelDaysShort') || 'дн'}`;
}
function fmtPct(v: number | null | undefined): string {
  return v == null ? '—' : `${Math.round(v * 100)}%`;
}

const maxWeekly = computed(() => Math.max(1, ...(result.value?.weekly.flatMap((w) => [w.created, w.won]) || [1])));
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden">
    <div class="mb-3 flex flex-wrap items-center gap-1.5 flex-shrink-0">
      <UButton
        v-for="p in PERIODS"
        :key="p.key"
        size="2xs"
        :color="period === p.key ? 'primary' : 'gray'"
        :variant="period === p.key ? 'solid' : 'soft'"
        @click="period = p.key"
      >
        {{ t(p.labelKey) || p.fallback }}
      </UButton>
      <UButton size="2xs" color="gray" variant="ghost" icon="lucide:refresh-cw" :loading="loading" @click="reload" />
    </div>

    <div class="flex-1 min-h-0 overflow-auto pb-safe-or-4">
      <div v-if="loading && !result" class="flex flex-col items-center justify-center py-16 text-gray-400">
        <div class="h-9 w-9 rounded-full border-[3px] border-gray-200 border-t-primary-500 animate-spin mb-3" />
        <span class="text-sm">{{ t('app.loading') || 'Загрузка...' }}</span>
      </div>

      <div v-else-if="error" class="flex flex-col items-center justify-center py-16 text-red-500">
        <UIcon name="lucide:alert-triangle" class="w-10 h-10 mb-2" />
        <span class="text-sm">{{ error }}</span>
      </div>

      <div v-else-if="result" class="space-y-4">
        <p v-if="!result.hasOutcomeMarkers" class="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          {{ t('tasks.funnelNoOutcomeHint') || 'Mark a terminal column as “Won” / “Lost” in Board settings to get win rate and outcome metrics.' }}
        </p>

        <!-- KPI grid -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
            <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('tasks.funnelTotalDeals') || 'Deals' }}</div>
            <div class="text-2xl font-semibold mt-0.5">{{ result.totalDeals }}</div>
            <div v-if="result.capped" class="text-[11px] text-amber-500 mt-0.5">≈ {{ t('tasks.funnelCapped') || 'first 5000 shown' }}</div>
          </div>
          <div class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
            <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('tasks.funnelWon') || 'Won' }}</div>
            <div class="text-2xl font-semibold mt-0.5 text-emerald-600 dark:text-emerald-400">{{ result.wonCount }}</div>
            <div class="text-[11px] text-gray-400 mt-0.5">{{ t('tasks.funnelLost') || 'Lost' }}: {{ result.lostCount }}</div>
          </div>
          <div class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
            <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('tasks.funnelWinRate') || 'Win rate' }}</div>
            <div class="text-2xl font-semibold mt-0.5">{{ fmtPct(result.winRate) }}</div>
            <div class="text-[11px] text-gray-400 mt-0.5">{{ t('tasks.funnelInProgress') || 'In progress' }}: {{ result.openCount }}</div>
          </div>
          <div class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
            <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('tasks.funnelAvgCycle') || 'Avg cycle (won)' }}</div>
            <div class="text-2xl font-semibold mt-0.5">{{ fmtDays(result.avgWonCycleDays) }}</div>
            <div class="text-[11px] text-gray-400 mt-0.5">{{ t('tasks.funnelMedian') || 'median' }} {{ fmtDays(result.medianWonCycleDays) }}</div>
          </div>
        </div>

        <!-- Stage funnel -->
        <div class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
          <h4 class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">{{ t('tasks.funnelByStage') || 'Stages' }}</h4>
          <div v-if="!result.stages.length" class="text-sm text-gray-400">{{ t('tasks.funnelNoStages') || 'This board has no non-terminal columns.' }}</div>
          <div v-else class="space-y-2.5">
            <div v-for="st in result.stages" :key="st.key">
              <div class="flex items-baseline justify-between gap-2 mb-1">
                <span class="text-sm font-medium truncate">{{ st.label }}</span>
                <span class="text-xs text-gray-400 flex-shrink-0">
                  <span v-if="st.conversionFromPrev != null" class="mr-2" :class="st.conversionFromPrev < 1 ? 'text-amber-500' : 'text-emerald-500'">
                    {{ fmtPct(st.conversionFromPrev) }}
                  </span>
                  <span class="font-medium text-gray-600 dark:text-gray-300">{{ st.entered }}</span>
                  <span v-if="st.current"> · {{ t('tasks.funnelNow') || 'now' }} {{ st.current }}</span>
                </span>
              </div>
              <div class="h-2.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <div class="h-full rounded-full" :class="barColor(st.color)" :style="{ width: `${Math.max(2, (st.entered / maxEntered) * 100)}%` }" />
              </div>
            </div>
          </div>

          <!-- Outcomes -->
          <div v-if="result.hasOutcomeMarkers" class="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
            <div class="flex items-baseline justify-between mb-1">
              <span class="text-sm font-medium">{{ t('tasks.funnelOutcome') || 'Outcome' }}</span>
              <span class="text-xs text-gray-400">
                {{ t('tasks.funnelWon') || 'Won' }} {{ result.wonCount }} · {{ t('tasks.funnelLost') || 'Lost' }} {{ result.lostCount }}
                <span v-if="result.closedNoOutcomeCount"> · {{ t('tasks.funnelClosedOther') || 'closed (other)' }} {{ result.closedNoOutcomeCount }}</span>
              </span>
            </div>
            <div class="flex h-2.5 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">
              <div class="bg-emerald-400 dark:bg-emerald-500" :style="{ width: `${(result.wonCount / Math.max(1, result.wonCount + result.lostCount)) * 100}%` }" />
              <div class="bg-red-400 dark:bg-red-500" :style="{ width: `${(result.lostCount / Math.max(1, result.wonCount + result.lostCount)) * 100}%` }" />
            </div>
          </div>
        </div>

        <!-- Weekly throughput -->
        <div v-if="result.weekly.length" class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
          <div class="flex items-center justify-between mb-3">
            <h4 class="text-xs font-semibold uppercase tracking-wide text-gray-400">{{ t('tasks.funnelWeekly') || 'Per week' }}</h4>
            <span class="text-[11px] text-gray-400">
              <span class="inline-block w-2 h-2 rounded-sm bg-blue-400 mr-1" />{{ t('tasks.funnelCreated') || 'created' }}
              <span class="inline-block w-2 h-2 rounded-sm bg-emerald-400 ml-2 mr-1" />{{ t('tasks.funnelWonShort') || 'won' }}
            </span>
          </div>
          <div class="flex items-end gap-1 h-24 overflow-x-auto">
            <div v-for="w in result.weekly" :key="w.weekStart" class="flex flex-col items-center gap-0.5 flex-shrink-0" :title="w.weekStart">
              <div class="flex items-end gap-0.5 h-20">
                <div class="w-1.5 rounded-t bg-blue-400 dark:bg-blue-500" :style="{ height: `${(w.created / maxWeekly) * 100}%` }" />
                <div class="w-1.5 rounded-t bg-emerald-400 dark:bg-emerald-500" :style="{ height: `${(w.won / maxWeekly) * 100}%` }" />
              </div>
              <span class="text-[9px] text-gray-400 whitespace-nowrap">{{ w.weekStart.slice(5) }}</span>
            </div>
          </div>
        </div>

        <p class="text-[11px] text-gray-400">
          {{ t('tasks.funnelBasis') || 'Based on the columns each deal has passed through. Cycle time = created → closed.' }}
        </p>
      </div>
    </div>
  </div>
</template>
