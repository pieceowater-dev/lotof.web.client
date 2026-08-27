<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { maskProfanity } from '@/utils/profanityFilter';
import type { Cycle } from '@/api/tasks/cycle/list';
import type { TaskItem } from '@/api/tasks/task/list';
import type { TaskType } from '@/api/tasks/tasktype/list';

const { t } = useI18n();

const props = defineProps<{
  modelValue: boolean;
  cycle: Cycle | null;
  tasks: TaskItem[];
  taskTypes: TaskType[];
}>();

const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>();

const isOpen = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const VIEW_W = 640;
const VIEW_H = 260;
const PAD_LEFT = 34;
const PAD_RIGHT = 14;
const PAD_TOP = 14;
const PAD_BOTTOM = 28;
const PLOT_W = VIEW_W - PAD_LEFT - PAD_RIGHT;
const PLOT_H = VIEW_H - PAD_TOP - PAD_BOTTOM;

// A task's burndown weight depends on its type's estimationType: "none"
// drops it from the report entirely, "story_points"/"hours" use its own
// estimateValue (defaulting to 1 if the type calls for an estimate but
// nobody set one, rather than silently counting it as zero work), and
// anything else (including task types created before this feature existed)
// falls back to a flat 1-per-issue count -- the same shape the chart always
// used to have.
function taskWeight(task: TaskItem): number | null {
  const tt = props.taskTypes.find((x) => x.id === task.taskTypeId);
  const estimationType = tt?.estimationType || 'default';
  if (estimationType === 'none') return null;
  if (estimationType === 'story_points' || estimationType === 'hours') return task.estimateValue ?? 1;
  return 1;
}
const usesEstimates = computed(() => props.tasks.some((tsk) => {
  const tt = props.taskTypes.find((x) => x.id === tsk.taskTypeId);
  return tt?.estimationType === 'story_points' || tt?.estimationType === 'hours';
}));
const unitLabel = computed(() => (usesEstimates.value ? (t('tasks.burndownPoints') || 'points') : (t('tasks.burndownIssues') || 'issues')));

function fmtDay(d: Date): string {
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
function roundNice(v: number): number {
  return Math.round(v * 10) / 10;
}
function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

const points = computed(() => {
  if (!props.cycle?.startsAt || !props.cycle?.endsAt) return null;
  const start = new Date(props.cycle.startsAt);
  const end = new Date(props.cycle.endsAt);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  if (end <= start) return null;

  const weighted = props.tasks
    .map((tsk) => ({ task: tsk, weight: taskWeight(tsk) }))
    .filter((x): x is { task: TaskItem; weight: number } => x.weight !== null);
  const scope = weighted.reduce((sum, x) => sum + x.weight, 0);

  const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayOffset = Math.round((today.getTime() - start.getTime()) / 86400000);
  const lastActualOffset = Math.min(totalDays - 1, Math.max(0, todayOffset));

  const dayDates: Date[] = [];
  for (let i = 0; i < totalDays; i++) {
    dayDates.push(new Date(start.getTime() + i * 86400000));
  }

  // Planned (red): cumulative scope as of each day -- every task already
  // added to the sprint by then, closed or not. Flat unless scope actually
  // changes (an issue added mid-sprint shows up as a step here, same as
  // Jira), instead of that growth being silently absorbed into "progress".
  // Completed (green): cumulative weight of tasks closed by that day.
  // Both are only known up to today; future days are left unset.
  const planned: (number | null)[] = [];
  const completed: (number | null)[] = [];
  for (let i = 0; i < totalDays; i++) {
    const day = dayDates[i];
    if (i > lastActualOffset) {
      planned.push(null);
      completed.push(null);
      continue;
    }
    let plannedAsOf = 0;
    let doneAsOf = 0;
    for (const x of weighted) {
      if (new Date(x.task.createdAt) > day) continue;
      plannedAsOf += x.weight;
      if (x.task.closedAt && new Date(x.task.closedAt) <= day) doneAsOf += x.weight;
    }
    planned.push(plannedAsOf);
    completed.push(doneAsOf);
  }

  // Guideline: the ideal completion trend, rising from 0 to the sprint's
  // volume -- flat across Sat/Sun since no progress is expected to land on
  // a weekend, so it doesn't keep climbing through them like a naive linear
  // guideline would.
  const maxScope = Math.max(scope, ...planned.filter((v): v is number => v != null));
  const workingSteps = dayDates.slice(0, -1).filter((d) => !isWeekend(d)).length;
  const increment = workingSteps > 0 ? maxScope / workingSteps : 0;
  const ideal: number[] = [0];
  for (let i = 1; i < totalDays; i++) {
    ideal.push(ideal[i - 1] + (isWeekend(dayDates[i - 1]) ? 0 : increment));
  }

  const denom = maxScope || 1;
  const toX = (i: number) => PAD_LEFT + (i / (totalDays - 1 || 1)) * PLOT_W;
  const toY = (v: number) => PAD_TOP + (1 - v / denom) * PLOT_H;
  const toXY = (arr: number[]) => arr.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
  const toMarkers = (series: (number | null)[]) => series
    .map((v, i) => (v == null ? null : { x: toX(i), y: toY(v), date: fmtDay(dayDates[i]), value: roundNice(v) }))
    .filter((p): p is { x: number; y: number; date: string; value: number } => p !== null);

  // Non-working days (Sat/Sun) get a faint vertical band behind the grid --
  // Jira shades weekends the same way since progress naturally plateaus
  // over them.
  const weekendBands = dayDates
    .map((d, i) => ({ i, isWeekend: isWeekend(d) }))
    .filter((d) => d.isWeekend)
    .map((d) => ({ x: toX(d.i) - (PLOT_W / (totalDays - 1 || 1)) / 2, w: PLOT_W / (totalDays - 1 || 1) }));

  // One vertical gridline per day; label only a subset (start, end, and
  // evenly-spaced days between) so labels don't collide on longer sprints.
  const labelStep = Math.max(1, Math.ceil(totalDays / 7));
  const dayGrid = dayDates.map((d, i) => ({
    x: toX(i),
    label: (i === 0 || i === totalDays - 1 || i % labelStep === 0) ? fmtDay(d) : null,
  }));

  const yGrid = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    y: toY(denom * f),
    label: roundNice(denom * f),
  }));

  const plannedMarkers = toMarkers(planned);
  const completedMarkers = toMarkers(completed);

  const showTodayMarker = todayOffset >= 0 && todayOffset <= totalDays - 1 && todayOffset < totalDays - 1;
  const lastCompleted = completedMarkers[completedMarkers.length - 1];

  return {
    scope,
    maxScope,
    taskCount: weighted.length,
    idealPath: toXY(ideal),
    plannedPath: plannedMarkers.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),
    completedPath: completedMarkers.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),
    plannedMarkers,
    completedMarkers,
    weekendBands,
    dayGrid,
    yGrid,
    todayX: showTodayMarker ? toX(todayOffset) : null,
    completedValue: lastCompleted?.value ?? 0,
  };
});
</script>

<template>
  <UModal v-model="isOpen" :ui="{ width: 'sm:max-w-2xl' }">
    <UCard :ui="{ ring: '' }">
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold flex items-center gap-2">
            <UIcon name="lucide:trending-up" class="w-5 h-5 text-gray-400" />
            {{ t('tasks.burndown') || 'Burndown' }}
          </h3>
          <UButton icon="lucide:x" size="sm" color="gray" variant="ghost" @click="isOpen = false" />
        </div>
        <p v-if="cycle" class="text-sm text-gray-500 mt-0.5">{{ maskProfanity(cycle.name) }}</p>
      </template>

      <div v-if="!cycle?.startsAt || !cycle?.endsAt" class="flex flex-col items-center justify-center gap-2 text-center py-10 text-gray-400">
        <UIcon name="lucide:calendar-range" class="w-8 h-8" />
        <p class="text-sm">{{ t('tasks.burndownNeedsDates') || 'Set start and end dates on this sprint to see a burndown chart' }}</p>
      </div>
      <div v-else-if="!points || points.taskCount === 0" class="flex flex-col items-center justify-center gap-2 text-center py-10 text-gray-400">
        <UIcon name="lucide:inbox" class="w-8 h-8" />
        <p class="text-sm">{{ t('tasks.burndownNoTasks') || 'No issues in this sprint yet' }}</p>
      </div>
      <div v-else>
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs text-gray-500">{{ points.completedValue }} / {{ points.maxScope }} {{ unitLabel }} {{ t('tasks.burndownRemaining') || 'done' }}</span>
        </div>
        <svg :viewBox="`0 0 ${VIEW_W} ${VIEW_H}`" class="w-full h-64 overflow-visible">
          <!-- Weekend shading, drawn first so everything else sits on top -->
          <rect
            v-for="(band, i) in points.weekendBands" :key="`wk${i}`"
            :x="band.x" :y="PAD_TOP" :width="band.w" :height="PLOT_H"
            class="fill-gray-100 dark:fill-gray-800/50"
          />
          <!-- Y-axis gridlines + value labels -->
          <g v-for="(g, i) in points.yGrid" :key="`y${i}`">
            <line :x1="PAD_LEFT" :x2="VIEW_W - PAD_RIGHT" :y1="g.y" :y2="g.y" class="stroke-gray-200 dark:stroke-gray-800" stroke-width="1" />
            <text :x="PAD_LEFT - 6" :y="g.y" text-anchor="end" dominant-baseline="middle" class="fill-gray-400 text-[9px]">{{ g.label }}</text>
          </g>
          <!-- Day gridlines + date labels -->
          <g v-for="(g, i) in points.dayGrid" :key="`d${i}`">
            <line :x1="g.x" :x2="g.x" :y1="PAD_TOP" :y2="VIEW_H - PAD_BOTTOM" class="stroke-gray-100 dark:stroke-gray-800/70" stroke-width="1" />
            <text v-if="g.label" :x="g.x" :y="VIEW_H - PAD_BOTTOM + 14" text-anchor="middle" class="fill-gray-400 text-[9px]">{{ g.label }}</text>
          </g>
          <!-- Today marker -->
          <line
            v-if="points.todayX != null"
            :x1="points.todayX" :x2="points.todayX" :y1="PAD_TOP" :y2="VIEW_H - PAD_BOTTOM"
            class="stroke-amber-500" stroke-width="1.5" stroke-dasharray="3 3"
          />
          <text v-if="points.todayX != null" :x="points.todayX" :y="PAD_TOP - 3" text-anchor="middle" class="fill-amber-500 text-[9px] font-medium">{{ t('tasks.burndownToday') || 'Today' }}</text>
          <!-- Guideline (ideal completion trend) + planned (scope) + completed series -->
          <polyline :points="points.idealPath" fill="none" stroke="currentColor" class="text-gray-300 dark:text-gray-700" stroke-width="2" stroke-dasharray="5 4" />
          <polyline :points="points.plannedPath" fill="none" stroke="currentColor" class="text-red-500" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          <polyline :points="points.completedPath" fill="none" stroke="currentColor" class="text-emerald-500" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          <g v-for="(p, i) in points.plannedMarkers" :key="`p${i}`">
            <circle :cx="p.x" :cy="p.y" r="3" class="fill-white dark:fill-gray-900 stroke-red-500" stroke-width="2">
              <title>{{ p.date }} — {{ p.value }} {{ unitLabel }}</title>
            </circle>
          </g>
          <g v-for="(p, i) in points.completedMarkers" :key="`c${i}`">
            <circle :cx="p.x" :cy="p.y" r="3" class="fill-white dark:fill-gray-900 stroke-emerald-500" stroke-width="2">
              <title>{{ p.date }} — {{ p.value }} {{ unitLabel }}</title>
            </circle>
          </g>
        </svg>
        <div class="flex items-center justify-center gap-4 text-[11px] text-gray-400 mt-1">
          <span class="flex items-center gap-1"><span class="h-0.5 w-3 bg-gray-300 dark:bg-gray-700 inline-block" />{{ t('tasks.burndownIdeal') || 'Guideline' }}</span>
          <span class="flex items-center gap-1"><span class="h-0.5 w-3 bg-red-500 inline-block" />{{ t('tasks.burndownPlanned') || 'Planned' }}</span>
          <span class="flex items-center gap-1"><span class="h-0.5 w-3 bg-emerald-500 inline-block" />{{ t('tasks.burndownActual') || 'Completed' }}</span>
        </div>
      </div>
    </UCard>
  </UModal>
</template>
