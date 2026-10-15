<script lang="ts" setup>
definePageMeta({ layout: 'workspace' });

import { ref, computed, onMounted } from 'vue';
import * as XLSX from 'xlsx';
import { useI18n } from '@/composables/useI18n';
import { useTasksToken } from '@/composables/useTasksToken';
import AppSkeleton from '@/components/ui/AppSkeleton.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import type { TaskBoard } from '@/api/tasks/board/list';
import { tasksDailyReport, type DailyReportRow } from '@/api/tasks/task/extra';
import { usePageTitle } from '@/composables/usePageTitle';

// Daily report of a board: per assignee -- assigned, done, postponed, cancelled,
// overdue and the average time to finish.
const { t } = useI18n();
const route = useRoute();
const toast = useToast();
const { token: hubToken } = useAuth();
const nsSlug = computed(() => route.params.namespace as string);
const boardSlug = computed(() => route.params.boardSlug as string);

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const day = ref(iso(new Date()));
const board = ref<TaskBoard | null>(null);
usePageTitle('issues', { section: 'report', subject: () => board.value?.name });
const rows = ref<DailyReportRow[]>([]);
const names = ref<Record<string, string>>({});
const loading = ref(true);

const totals = computed(() => rows.value.reduce((a, r) => ({
  assigned: a.assigned + r.assigned, done: a.done + r.done, postponed: a.postponed + r.postponed, cancelled: a.cancelled + r.cancelled, overdue: a.overdue + r.overdue,
}), { assigned: 0, done: 0, postponed: 0, cancelled: 0, overdue: 0 }));
const nameOf = (id?: string | null) => (id ? names.value[id] || t('tasks.unassigned') : t('tasks.unassigned'));
const minutes = (m: number) => (m <= 0 ? '—' : m < 60 ? `${Math.round(m)} min` : m < 1440 ? `${(m / 60).toFixed(1)} h` : `${(m / 1440).toFixed(1)} d`);

async function getToken(): Promise<string> {
  const { current } = useTasksToken();
  const tk = current();
  if (!tk) throw new Error('No tasks token');
  return tk;
}

// done / postponed / cancelled are resolved from the board's own columns.
function statusKeys() {
  let arr: any[] = [];
  try { arr = board.value?.statuses ? JSON.parse(board.value.statuses) : []; } catch { arr = []; }
  const done = arr.filter((s) => s.is_terminal && !s.ask_reason && s.outcome !== 'lost').map((s) => s.key);
  const cancelled = arr.filter((s) => s.is_terminal && (s.ask_reason || s.outcome === 'lost')).map((s) => s.key);
  const postponed = arr.filter((s) => !s.is_terminal && s.ask_reason).map((s) => s.key);
  return { done, postponed, cancelled };
}

async function load() {
  loading.value = true;
  try {
    const token = await getToken();
    if (!board.value) {
      const { tasksBoardsList } = await import('@/api/tasks/board/list');
      board.value = (await tasksBoardsList(token, nsSlug.value)).boards.find((b) => b.slug === boardSlug.value) || null;
      if (!board.value) { navigateTo(`/${nsSlug.value}/issues`); return; }
      if (hubToken.value) {
        const { loadIssuesStaffMemberOptions } = await import('@/utils/issuesMembers');
        const opts = await loadIssuesStaffMemberOptions(hubToken.value, token, nsSlug.value);
        names.value = Object.fromEntries(opts.map((o) => [o.value, o.label]));
      }
    }
    const from = new Date(`${day.value}T00:00:00`);
    const to = new Date(from.getTime() + 24 * 3600 * 1000);
    const k = statusKeys();
    rows.value = await tasksDailyReport(token, nsSlug.value, {
      boardId: board.value.id, from: from.toISOString(), to: to.toISOString(),
      doneKeys: k.done, postponedKeys: k.postponed, cancelledKeys: k.cancelled,
    });
  } catch (e) {
    logError('[issues/report] load failed', e);
    toast.add({ title: getErrorMessage(e, t) || t('common.error'), color: 'red' });
  } finally {
    loading.value = false;
  }
}

function exportXlsx() {
  const data = rows.value.map((r) => ({
    [t('tasks.reportAssignee')]: nameOf(r.assigneeUserId), [t('tasks.reportAssigned')]: r.assigned, [t('tasks.reportDone')]: r.done,
    [t('tasks.reportPostponed')]: r.postponed, [t('tasks.reportCancelled')]: r.cancelled, [t('tasks.reportOverdue')]: r.overdue,
    [t('tasks.reportAvg')]: Math.round(r.avgDoneMinutes),
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Report');
  XLSX.writeFile(wb, `${boardSlug.value}-${day.value}.xlsx`);
}

onMounted(load);

function shiftDay(delta: number) {
  const d = new Date(`${day.value}T12:00:00`);
  d.setDate(d.getDate() + delta);
  day.value = iso(d);
  load();
}
const headerMenu = computed(() => [[
  { label: t('common.refresh'), icon: 'lucide:refresh-cw', click: load },
  { label: t('common.export'), icon: 'lucide:download', disabled: !rows.value.length, click: exportXlsx },
]]);
</script>

<template>
  <div class="at-scope ct-scope flex h-full min-h-0 flex-col p-4 pb-safe-or-4">
    <PageHeader :title="`${t('tasks.reportTitle')}${board ? ' · ' + board.name : ''}`" :subtitle="t('tasks.reportHint')" :menu="headerMenu">
      <template #primary>
        <div class="flex items-center gap-1.5">
          <button type="button" class="at-btn !px-2.5" :aria-label="t('tasks.prevDay')" @click="shiftDay(-1)"><Icon name="lucide:chevron-left" class="h-4 w-4" /></button>
          <UInput v-model="day" type="date" size="sm" class="w-36" @change="load" />
          <button type="button" class="at-btn !px-2.5" :aria-label="t('tasks.nextDay')" @click="shiftDay(1)"><Icon name="lucide:chevron-right" class="h-4 w-4" /></button>
        </div>
      </template>
      <template #actions>
        <NuxtLink :to="`/${nsSlug}/issues/${boardSlug}`" class="at-btn">
          <Icon name="lucide:arrow-left" class="h-4 w-4" /><span class="hidden sm:inline">{{ t('common.back') }}</span>
        </NuxtLink>
      </template>
    </PageHeader>

    <div class="min-h-0 flex-1 space-y-4 overflow-y-auto">
      <div v-if="rows.length" class="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div class="at-stat"><div class="text-xs text-slate-500">{{ t('tasks.reportAssigned') }}</div><div class="text-xl font-bold tabular-nums">{{ totals.assigned }}</div></div>
        <div class="at-stat"><div class="text-xs text-slate-500">{{ t('tasks.reportDone') }}</div><div class="text-xl font-bold tabular-nums">{{ totals.done }}</div></div>
        <div class="at-stat"><div class="text-xs text-slate-500">{{ t('tasks.reportPostponed') }}</div><div class="text-xl font-bold tabular-nums">{{ totals.postponed }}</div></div>
        <div class="at-stat"><div class="text-xs text-slate-500">{{ t('tasks.reportCancelled') }}</div><div class="text-xl font-bold tabular-nums">{{ totals.cancelled }}</div></div>
        <div class="at-stat col-span-2 sm:col-span-1"><div class="text-xs text-slate-500">{{ t('tasks.reportOverdue') }}</div><div class="text-xl font-bold tabular-nums">{{ totals.overdue }}</div></div>
      </div>

      <div class="at-panel !p-2">
        <div v-if="loading" class="px-4 py-6"><AppSkeleton variant="list" :rows="3" /></div>
        <div v-else-if="!rows.length" class="at-empty-box">{{ t('tasks.reportEmpty') }}</div>
        <div v-for="r in rows" :key="r.assigneeUserId || 'none'" class="at-row !py-3 flex flex-wrap items-center gap-3">
          <div class="min-w-0 flex-1 basis-40 truncate font-semibold" :class="r.assigneeUserId ? '' : 'text-slate-500'">{{ nameOf(r.assigneeUserId) }}</div>
          <div class="flex flex-wrap items-center gap-1.5 text-xs">
            <span class="at-chip">{{ t('tasks.reportAssigned') }} {{ r.assigned }}</span>
            <span class="at-chip">{{ t('tasks.reportDone') }} {{ r.done }}</span>
            <span v-if="r.postponed" class="at-chip !bg-amber-500/10 !text-amber-700 dark:!text-amber-300">{{ t('tasks.reportPostponed') }} {{ r.postponed }}</span>
            <span v-if="r.cancelled" class="at-chip !bg-rose-500/10 !text-rose-600">{{ t('tasks.reportCancelled') }} {{ r.cancelled }}</span>
            <span v-if="r.overdue" class="at-chip !bg-rose-500/10 !text-rose-600">{{ t('tasks.reportOverdue') }} {{ r.overdue }}</span>
            <span class="tabular-nums text-slate-500">⌀ {{ minutes(r.avgDoneMinutes) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
