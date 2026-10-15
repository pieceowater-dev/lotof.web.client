<script lang="ts" setup>
import AppSkeleton from '@/components/ui/AppSkeleton.vue';
definePageMeta({ layout: 'workspace' });

import { useI18n } from '@/composables/useI18n';
import { useTasksToken } from '@/composables/useTasksToken';
import { useTasksStaffRole } from '@/composables/useTasksStaffRole';
import { useNamespace } from '@/composables/useNamespace';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import { taskShortCode } from '@/utils/taskDisplay';
import { groupByCourier, courierCounters, timeWindowText, type StatusInfo } from '@/utils/logistics';
import PageHeader from '@/components/ui/PageHeader.vue';
import LogisticsMap from '@/components/tasks/LogisticsMap.vue';
import TaskDetailSlideover from '@/components/tasks/TaskDetailSlideover.vue';
import type { TaskBoard } from '@/api/tasks/board/list';
import type { TaskType } from '@/api/tasks/tasktype/list';
import type { TaskItem } from '@/api/tasks/task/list';
import { usePageTitle } from '@/composables/usePageTitle';

// Route sheet for a day: the board's tasks due on the chosen date, grouped by
// courier in the order the dispatcher arranged them on the board, with
// per-courier counters. Print it or take it to Excel.
const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const boardSlug = computed(() => route.params.boardSlug as string);
const { token: hubToken } = useAuth();
const { titleBySlug } = useNamespace();
const { isOwnerOrManager } = useTasksStaffRole();

function token(): string {
  const tk = useTasksToken().current();
  if (!tk) throw new Error('No tasks token');
  return tk;
}

const board = ref<TaskBoard | null>(null);
const taskTypes = ref<TaskType[]>([]);
const memberOptions = ref<{ label: string; value: string }[]>([]);
const tasks = ref<TaskItem[]>([]);
const loading = ref(true);
const day = ref(new Date().toISOString().slice(0, 10));
const selected = ref<TaskItem | null>(null);
const detailOpen = ref(false);

usePageTitle('issues', { section: 'logistics', subject: () => board.value?.name });

const statuses = computed<StatusInfo[]>(() => {
  try {
    const arr = board.value?.statuses ? JSON.parse(board.value.statuses) : [];
    return Array.isArray(arr) ? arr.map((s: any) => ({ key: s.key, label: s.label || s.key, isTerminal: !!s.is_terminal })) : [];
  } catch {
    return [];
  }
});
const statusLabel = (key: string) => statuses.value.find((s) => s.key === key)?.label || key;
const nameOf = (id?: string | null) => (id ? memberOptions.value.find((m) => m.value === id)?.label || t('tasks.unknownMember') : t('tasks.unassigned'));

const groups = computed(() => groupByCourier(tasks.value, statuses.value));
const viewMode = ref<'list' | 'map'>('list');
const mapGroups = computed(() => groups.value.map((g) => ({ assigneeId: g.assigneeId, tasks: g.tasks })));
const hasLocated = computed(() => tasks.value.some((tk) => tk.lat != null && tk.lng != null));
const mapRef = ref<{ colorFor: (id: string | null, idx: number) => string } | null>(null);
const dotColor = (id: string | null, idx: number) => mapRef.value?.colorFor(id, idx) || '#9ca3af';
const counters = computed(() => courierCounters(tasks.value, statuses.value));

async function load() {
  loading.value = true;
  try {
    const { tasksBoardsList } = await import('@/api/tasks/board/list');
    const res = await tasksBoardsList(token(), nsSlug.value);
    board.value = res.boards.find((b) => b.slug === boardSlug.value) || null;
    if (!board.value) { navigateTo(`/${nsSlug.value}/issues`); return; }
    const { tasksTaskTypesList } = await import('@/api/tasks/tasktype/list');
    taskTypes.value = (await tasksTaskTypesList(token(), nsSlug.value, board.value.id)).taskTypes;
    if (hubToken.value) {
      const { loadIssuesStaffMemberOptions } = await import('@/utils/issuesMembers');
      memberOptions.value = await loadIssuesStaffMemberOptions(hubToken.value, token(), nsSlug.value);
    }
    await loadTasks();
  } catch (e) {
    logError('[issues/logistics] load failed', e);
    useToast().add({ title: getErrorMessage(e, t) || t('common.error'), color: 'red' });
  } finally {
    loading.value = false;
  }
}

async function loadTasks() {
  if (!board.value) return;
  const { tasksBundle } = await import('@/api/tasks/task/list');
  const from = new Date(`${day.value}T00:00:00`);
  const to = new Date(`${day.value}T23:59:59`);
  const res = await tasksBundle(token(), nsSlug.value, { boardIds: [board.value.id], dueFrom: from.toISOString(), dueTo: to.toISOString() }, { length: 'ONE_HUNDRED' });
  tasks.value = res.tasks;
}
onMounted(load);
watch(day, async () => {
  loading.value = true;
  try { await loadTasks(); } catch (e) { logError('[issues/logistics] reload failed', e); } finally { loading.value = false; }
});

function shiftDay(delta: number) {
  const d = new Date(`${day.value}T12:00:00`);
  d.setDate(d.getDate() + delta);
  day.value = d.toISOString().slice(0, 10);
}

function printPage() { window.print(); }
// Print and export sit behind the "more" menu: the day switcher and Back are what the page is for.
const headerMenu = computed(() => [[
  { label: t('tasks.print'), icon: 'lucide:printer', click: printPage },
  ...(isOwnerOrManager.value ? [{ label: t('common.export'), icon: 'lucide:download', disabled: !tasks.value.length, click: exportXlsx }] : []),
]]);
function open(task: TaskItem) { selected.value = task; detailOpen.value = true; }

async function exportXlsx() {
  const XLSX = await import('xlsx');
  const rows = groups.value.flatMap((g) => g.tasks.map((tk, i) => ({
    [t('tasks.courier')]: nameOf(g.assigneeId),
    '#': i + 1,
    [t('tasks.taskTitle')]: tk.title,
    [t('tasks.status')]: statusLabel(tk.status),
    [t('tasks.timeWindow')]: timeWindowText(tk),
    [t('tasks.address')]: tk.textAddress || '',
    [t('tasks.client')]: tk.clientNameSnapshot || '',
    [t('tasks.phone')]: tk.clientPhoneSnapshot || '',
  })));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'route');
  XLSX.writeFile(wb, `route-${day.value}.xlsx`);
}
</script>

<template>
  <div class="at-scope ct-scope flex h-full min-h-0 flex-col p-4 pb-safe-or-4">
    <PageHeader :title="t('tasks.logisticsTitle')" :subtitle="t('tasks.logisticsHint')" :menu="headerMenu">
      <template #primary>
        <div class="print:hidden flex items-center gap-1.5">
          <button type="button" class="at-btn !px-2.5" :aria-label="t('tasks.prevDay')" @click="shiftDay(-1)"><Icon name="lucide:chevron-left" class="h-4 w-4" /></button>
          <UInput v-model="day" type="date" size="sm" class="w-36" />
          <button type="button" class="at-btn !px-2.5" :aria-label="t('tasks.nextDay')" @click="shiftDay(1)"><Icon name="lucide:chevron-right" class="h-4 w-4" /></button>
        </div>
      </template>
      <template #actions>
        <NuxtLink :to="`/${nsSlug}/issues/${boardSlug}`" class="at-btn print:hidden">
          <Icon name="lucide:arrow-left" class="h-4 w-4" /><span class="hidden sm:inline">{{ t('app.back') || 'Back' }}</span>
        </NuxtLink>
      </template>
    </PageHeader>

    <!-- Phones switch between the list and the map; from lg both are always on screen (map on the right,
         the day's tasks by courier in a sidebar on the left), also when the day is empty. -->
    <div class="mb-2 flex flex-shrink-0 rounded-xl bg-gray-100 p-0.5 text-sm dark:bg-gray-800 lg:hidden print:hidden">
      <button type="button" class="flex-1 rounded-lg px-2.5 py-1.5 font-medium" :class="viewMode === 'list' ? 'bg-white shadow-sm dark:bg-gray-900' : 'text-gray-500'" @click="viewMode = 'list'">{{ t('tasks.logisticsList') }}</button>
      <button type="button" class="flex-1 rounded-lg px-2.5 py-1.5 font-medium" :class="viewMode === 'map' ? 'bg-white shadow-sm dark:bg-gray-900' : 'text-gray-500'" @click="viewMode = 'map'">{{ t('tasks.logisticsMap') }}</button>
    </div>

    <div class="min-h-0 flex-1 lg:grid lg:grid-cols-[minmax(22rem,26rem)_minmax(0,1fr)] lg:gap-4">
      <div class="min-h-0 space-y-3 overflow-y-auto lg:h-full" :class="viewMode === 'map' ? 'hidden lg:block' : 'h-full'">
        <AppSkeleton v-if="loading" variant="list" :rows="4" />
        <div v-else-if="!groups.length" class="at-panel !p-6 text-center">
          <Icon name="lucide:route" class="mx-auto mb-2 h-8 w-8 text-gray-400" />
          <div class="text-sm font-medium">{{ t('tasks.logisticsEmpty') }}</div>
        </div>

        <section v-for="g in groups" :key="g.assigneeId || 'none'" class="at-panel !p-4 break-inside-avoid">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="flex min-w-0 items-center gap-2 text-base font-semibold">
              <span v-if="hasLocated" class="h-3 w-3 flex-shrink-0 rounded-full" :style="{ background: dotColor(g.assigneeId, groups.indexOf(g)) }" /><span class="truncate">{{ nameOf(g.assigneeId) }}</span>
            </h2>
            <div class="flex flex-wrap gap-1.5 text-xs">
              <span class="at-chip" :title="t('tasks.cntWaiting')">{{ t('tasks.cntWaiting') }}: <b class="tabular-nums">{{ counters[g.assigneeId || '']?.waiting || 0 }}</b></span>
              <span class="at-chip" :title="t('tasks.cntActive')">{{ t('tasks.cntActive') }}: <b class="tabular-nums">{{ counters[g.assigneeId || '']?.active || 0 }}</b></span>
              <span class="at-chip" :title="t('tasks.cntDone')">{{ t('tasks.cntDone') }}: <b class="tabular-nums">{{ counters[g.assigneeId || '']?.done || 0 }}</b></span>
            </div>
          </div>
          <ol class="mt-3 divide-y divide-gray-100 dark:divide-gray-800">
            <li v-for="(tk, i) in g.tasks" :key="tk.id">
              <button type="button" class="flex w-full items-start gap-3 py-2.5 text-left" @click="open(tk)">
                <span class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold tabular-nums dark:bg-gray-800">{{ i + 1 }}</span>
                <span class="min-w-0 flex-1">
                  <span class="flex items-center justify-between gap-2">
                    <span class="truncate text-sm font-medium">{{ tk.title }} <span class="text-xs text-gray-400">{{ taskShortCode(boardSlug, tk.taskNumber) }}</span></span>
                    <span class="flex-shrink-0 text-xs text-gray-500">{{ timeWindowText(tk) }}</span>
                  </span>
                  <span v-if="tk.textAddress" class="block truncate text-sm text-gray-500">{{ tk.textAddress }}</span>
                  <span class="block truncate text-xs text-gray-400">{{ statusLabel(tk.status) }}<template v-if="tk.clientNameSnapshot"> · {{ tk.clientNameSnapshot }}</template></span>
                </span>
              </button>
            </li>
          </ol>
        </section>
      </div>
      <div class="min-h-[320px] lg:h-full print:hidden" :class="viewMode === 'list' ? 'hidden lg:block' : 'h-full'">
        <LogisticsMap ref="mapRef" :groups="mapGroups" :selected-id="selected?.id" @select="open" />
      </div>
    </div>

    <TaskDetailSlideover v-model="detailOpen" :task="selected" :board-statuses="statuses.map((s) => ({ ...s, isRequired: false }))" :task-types="taskTypes" :member-options="memberOptions" :ns-slug="nsSlug" :board-slug="boardSlug" @changed="loadTasks" @deleted="loadTasks" />
  </div>
</template>
