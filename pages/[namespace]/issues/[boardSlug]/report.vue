<script lang="ts" setup>
definePageMeta({ layout: 'workspace' });

import { ref, computed, onMounted } from 'vue';
import * as XLSX from 'xlsx';
import { useI18n } from '@/composables/useI18n';
import { useTasksToken } from '@/composables/useTasksToken';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import type { TaskBoard } from '@/api/tasks/board/list';
import { tasksDailyReport, type DailyReportRow } from '@/api/tasks/task/extra';

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
</script>

<template>
  <div class="mx-auto w-full max-w-4xl space-y-4 p-4">
    <div class="flex items-center gap-2">
      <NuxtLink :to="`/${nsSlug}/issues/${boardSlug}`" class="cp-icon" :aria-label="t('common.back')"><Icon name="lucide:arrow-left" class="w-4 h-4" /></NuxtLink>
      <div class="min-w-0 flex-1">
        <h1 class="at-h2 truncate">{{ t('tasks.reportTitle') }}<span v-if="board"> · {{ board.name }}</span></h1>
        <p class="at-hint">{{ t('tasks.reportHint') }}</p>
      </div>
      <button type="button" class="at-btn hidden sm:inline-flex" :disabled="!rows.length" @click="exportXlsx"><Icon name="lucide:file-spreadsheet" class="w-4 h-4" />{{ t('common.export') }}</button>
    </div>

    <div class="at-panel !p-4 flex items-end gap-3 flex-wrap">
      <div class="space-y-1"><label class="text-xs font-medium text-slate-500">{{ t('tasks.reportDay') }}</label><UInput v-model="day" type="date" @change="load" /></div>
      <button type="button" class="at-btn at-btn--blue" :disabled="loading" @click="load"><Icon :name="loading ? 'lucide:loader-2' : 'lucide:refresh-cw'" class="w-4 h-4" :class="{ 'animate-spin': loading }" />{{ t('common.refresh') }}</button>
    </div>

    <div v-if="rows.length" class="grid grid-cols-2 sm:grid-cols-5 gap-3">
      <div class="at-stat"><div class="text-xs text-slate-500">{{ t('tasks.reportAssigned') }}</div><div class="text-xl font-bold tabular-nums">{{ totals.assigned }}</div></div>
      <div class="at-stat"><div class="text-xs text-slate-500">{{ t('tasks.reportDone') }}</div><div class="text-xl font-bold tabular-nums">{{ totals.done }}</div></div>
      <div class="at-stat"><div class="text-xs text-slate-500">{{ t('tasks.reportPostponed') }}</div><div class="text-xl font-bold tabular-nums">{{ totals.postponed }}</div></div>
      <div class="at-stat"><div class="text-xs text-slate-500">{{ t('tasks.reportCancelled') }}</div><div class="text-xl font-bold tabular-nums">{{ totals.cancelled }}</div></div>
      <div class="at-stat col-span-2 sm:col-span-1"><div class="text-xs text-slate-500">{{ t('tasks.reportOverdue') }}</div><div class="text-xl font-bold tabular-nums">{{ totals.overdue }}</div></div>
    </div>

    <div class="at-panel !p-2">
      <div v-if="!loading && !rows.length" class="at-empty-box">{{ t('tasks.reportEmpty') }}</div>
      <div v-for="r in rows" :key="r.assigneeUserId || 'none'" class="at-row !py-3 flex items-center gap-3 flex-wrap">
        <div class="min-w-0 flex-1 basis-40 font-semibold truncate" :class="r.assigneeUserId ? '' : 'text-slate-500'">{{ nameOf(r.assigneeUserId) }}</div>
        <div class="flex items-center gap-1.5 flex-wrap text-xs">
          <span class="at-chip">{{ t('tasks.reportAssigned') }} {{ r.assigned }}</span>
          <span class="at-chip">{{ t('tasks.reportDone') }} {{ r.done }}</span>
          <span v-if="r.postponed" class="at-chip !bg-amber-500/10 !text-amber-700 dark:!text-amber-300">{{ t('tasks.reportPostponed') }} {{ r.postponed }}</span>
          <span v-if="r.cancelled" class="at-chip !bg-rose-500/10 !text-rose-600">{{ t('tasks.reportCancelled') }} {{ r.cancelled }}</span>
          <span v-if="r.overdue" class="at-chip !bg-rose-500/10 !text-rose-600">{{ t('tasks.reportOverdue') }} {{ r.overdue }}</span>
          <span class="text-slate-500 tabular-nums">⌀ {{ minutes(r.avgDoneMinutes) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
