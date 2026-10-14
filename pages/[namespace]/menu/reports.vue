<script lang="ts" setup>
definePageMeta({ layout: 'workspace' });
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import { useAuth } from '@/composables/useAuth';
import { useMenuToken } from '@/composables/useMenuToken';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import { memberDisplayNameWithFallback } from '@/utils/memberDisplayName';
import { FilterPaginationLengthEnum } from '@gql-hub';
import { menuExecutorReport, menuStatusTimesReport, menuFieldValueReport, menuOrderEvents, type ExecutorReportRow, type StatusTimeRow, type FieldValueRow, type OrderEvent } from '@/api/menu/order/extra';
import { menuOrderFieldsList, type MenuOrderField } from '@/api/menu/orderfield/list';
import { useOrderStages } from '@/composables/useOrderStages';
import { defaultStatusLabel } from '@/utils/orderStatusLabels';
import { formatDateTime } from '@/utils/formatDate';
import EmptyState from '@/components/ui/EmptyState.vue';
import AppSkeleton from '@/components/ui/AppSkeleton.vue';

// Pay-by-executor report: closed orders of a period, lines, revenue and the
// executors' share of WORK lines.
const { t, locale } = useI18n();
const route = useRoute();
const router = useRouter();
const toast = useToast();
const { token: hubToken } = useAuth();
const nsSlug = computed(() => route.params.namespace as string);

const today = new Date();
const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const from = ref(iso(monthStart));
const to = ref(iso(today));
type TabKey = 'executors' | 'times' | 'field' | 'journal';
const TAB_KEYS: TabKey[] = ['executors', 'times', 'field', 'journal'];
const TAB_ICONS: Record<TabKey, string> = { executors: 'lucide:users', times: 'lucide:timer', field: 'lucide:list-filter', journal: 'lucide:scroll-text' };
// The open tab lives in the URL (?tab=) so a report can be reloaded or linked.
const tab = ref<TabKey>(TAB_KEYS.includes(route.query.tab as TabKey) ? (route.query.tab as TabKey) : 'executors');
const rows = ref<ExecutorReportRow[]>([]);
const times = ref<StatusTimeRow[]>([]);
const fieldRows = ref<FieldValueRow[]>([]);
const events = ref<OrderEvent[]>([]);
const eventsTotal = ref(0);
const eventsPage = ref(1);
const fields = ref<MenuOrderField[]>([]);
const fieldId = ref('');
const { stages, load: loadStages } = useOrderStages();
const listFields = computed(() => fields.value.filter((f) => f.dataType !== 'HEADING' && f.dataType !== 'TEXTAREA'));
const fieldOptions = computed(() => listFields.value.map((f) => ({ label: f.label, value: f.id })));
const stageName = (id?: string | null) => stages.value.find((x) => x.id === id)?.name || '';
const minutes = (m: number) => (m < 1 ? `<1 ${t('menu.unitMin')}` : m < 60 ? `${Math.round(m)} ${t('menu.unitMin')}` : m < 1440 ? `${(m / 60).toFixed(1)} ${t('menu.unitHour')}` : `${(m / 1440).toFixed(1)} ${t('menu.unitDay')}`);
const maxAvg = computed(() => Math.max(1, ...times.value.map((x) => x.avgMinutes)));
const names = ref<Record<string, string>>({});
const loading = ref(true);
const loadError = ref('');

// Period presets: one tap instead of two date pickers.
const PRESETS = [
  { key: 'today', label: 'menu.periodToday' },
  { key: 'week', label: 'menu.period7' },
  { key: 'month', label: 'menu.periodMonth' },
  { key: 'prevMonth', label: 'menu.periodPrevMonth' },
  { key: 'all', label: 'menu.periodAll' },
] as const;
function applyPreset(key: (typeof PRESETS)[number]['key']) {
  const now = new Date();
  if (key === 'today') { from.value = iso(now); to.value = iso(now); }
  else if (key === 'week') { from.value = iso(new Date(now.getTime() - 6 * 86400000)); to.value = iso(now); }
  else if (key === 'month') { from.value = iso(new Date(now.getFullYear(), now.getMonth(), 1)); to.value = iso(now); }
  else if (key === 'prevMonth') { from.value = iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)); to.value = iso(new Date(now.getFullYear(), now.getMonth(), 0)); }
  else { from.value = '2020-01-01'; to.value = iso(now); }
}
const activePreset = computed(() => {
  const now = new Date();
  const cand: Record<string, [string, string]> = {
    today: [iso(now), iso(now)],
    week: [iso(new Date(now.getTime() - 6 * 86400000)), iso(now)],
    month: [iso(new Date(now.getFullYear(), now.getMonth(), 1)), iso(now)],
    prevMonth: [iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), iso(new Date(now.getFullYear(), now.getMonth(), 0))],
    all: ['2020-01-01', iso(now)],
  };
  return Object.keys(cand).find((k) => cand[k][0] === from.value && cand[k][1] === to.value) || '';
});

const totals = computed(() => rows.value.reduce((a, r) => ({ lines: a.lines + r.lines, revenue: a.revenue + r.revenue, pay: a.pay + r.pay }), { lines: 0, revenue: 0, pay: 0 }));
const sortedRows = computed(() => [...rows.value].sort((a, b) => b.revenue - a.revenue));
const maxRevenue = computed(() => Math.max(1, ...rows.value.map((r) => r.revenue)));
const sortedTimes = computed(() => [...times.value].sort((a, b) => b.avgMinutes - a.avgMinutes));
const slowest = computed(() => sortedTimes.value[0] || null);
const fieldTotals = computed(() => {
  const done = fieldRows.value.reduce((a, r) => a + r.completed, 0);
  const cancelled = fieldRows.value.reduce((a, r) => a + r.cancelled, 0);
  const revenue = fieldRows.value.reduce((a, r) => a + r.revenue, 0);
  return { done, cancelled, avgCheck: done ? revenue / done : 0 };
});
const maxFieldCount = computed(() => Math.max(1, ...fieldRows.value.map((r) => r.completed + r.cancelled)));
const hasData = computed(() => (tab.value === 'executors' ? rows.value.length : tab.value === 'times' ? times.value.length : tab.value === 'field' ? fieldRows.value.length : events.value.length) > 0);
const nameOf = (id?: string | null) => (id ? names.value[id] || t('menu.unknownMember') : t('menu.executorsUnassigned'));
const money = (v: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(v);

async function loadNames() {
  if (!hubToken.value) return;
  try {
    const { hubNamespaceBySlug } = await import('@/api/hub/namespaces/get');
    const { hubMembersList } = await import('@/api/hub/members/list');
    const ns = await hubNamespaceBySlug(hubToken.value, nsSlug.value);
    if (!ns?.id) return;
    let page = 1;
    let batch: Array<{ userId: string; username: string; email: string; nickname?: string | null }>;
    const map: Record<string, string> = {};
    do {
      batch = await hubMembersList(hubToken.value, ns.id, page, FilterPaginationLengthEnum.Fifty);
      for (const m of batch) map[m.userId] = memberDisplayNameWithFallback(m, m.email);
      page += 1;
    } while (batch.length >= 50);
    names.value = map;
  } catch (e) { logError('[menu/executors] names failed', e); }
}

async function load() {
  loading.value = true;
  loadError.value = '';
  try {
    const tk = useMenuToken().current();
    if (!tk) throw new Error('No menu token');
    const closedFrom = new Date(`${from.value}T00:00:00`).toISOString();
    const closedTo = new Date(`${to.value}T23:59:59`).toISOString();
    if (tab.value === 'executors') rows.value = await menuExecutorReport(tk, nsSlug.value, closedFrom, closedTo);
    else if (tab.value === 'times') {
      await loadStages(tk, nsSlug.value);
      times.value = await menuStatusTimesReport(tk, nsSlug.value, closedFrom, closedTo);
    } else if (tab.value === 'field') {
      if (!fields.value.length) fields.value = (await menuOrderFieldsList(tk, nsSlug.value)).fields;
      if (!fieldId.value && listFields.value.length) fieldId.value = listFields.value[0].id;
      fieldRows.value = fieldId.value ? await menuFieldValueReport(tk, nsSlug.value, fieldId.value, closedFrom, closedTo) : [];
    } else {
      const r = await menuOrderEvents(tk, nsSlug.value, { from: closedFrom, to: closedTo, page: eventsPage.value });
      events.value = r.rows; eventsTotal.value = r.count;
    }
  } catch (e) {
    logError('[menu/reports] load failed', e);
    loadError.value = getErrorMessage(e, t) || t('common.error');
  } finally { loading.value = false; }
}

async function exportXlsx() {
  const XLSX = await import('xlsx');
  let data: Record<string, unknown>[] = [];
  if (tab.value === 'executors') {
    data = sortedRows.value.map((r) => ({ [t('menu.reportTab_executors')]: nameOf(r.executorId), [t('menu.executorsLines')]: r.lines, [t('menu.executorsOrders')]: r.orders, [t('menu.executorsRevenue')]: r.revenue, [t('menu.executorsPay')]: r.pay }));
  } else if (tab.value === 'times') {
    data = sortedTimes.value.map((r) => ({ [t('menu.reportStatus')]: stageName(r.stageId) || statusText(r.status), [t('menu.reportAvg')]: Math.round(r.avgMinutes), [t('menu.reportMax')]: Math.round(r.maxMinutes), [t('menu.reportVisits')]: r.visits }));
  } else if (tab.value === 'field') {
    data = fieldRows.value.map((r) => ({ [t('menu.reportField')]: r.value || t('menu.reportBlank'), [t('menu.reportDone')]: r.completed, [t('menu.reportCancelled')]: r.cancelled, [t('menu.reportAvgCheck')]: r.avgCheck, [t('menu.executorsRevenue')]: r.revenue }));
  } else {
    data = events.value.map((e) => ({ '#': e.displayNumber || e.number, [t('menu.reportEvent')]: eventLabel(e), [t('menu.reportBy')]: e.userId ? names.value[e.userId] || '' : '', [t('menu.reportWhen')]: formatDateTime(e.createdAt, locale.value) }));
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), tab.value);
  XLSX.writeFile(wb, `menu-${tab.value}-${from.value}_${to.value}.xlsx`);
}

function setTab(k: TabKey) { tab.value = k; eventsPage.value = 1; }
// Everything that changes the report reloads it by itself (no separate "refresh" step), and the tab goes to the URL.
let reloadTimer: ReturnType<typeof setTimeout> | null = null;
watch([tab, from, to, fieldId], () => {
  if (reloadTimer) clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => { void load(); }, 250);
});
watch(tab, (k) => { void router.replace({ query: { ...route.query, tab: k === 'executors' ? undefined : k } }); });
watch(eventsPage, () => { void load(); });
const statusText = (s: string) => defaultStatusLabel(s, t);
const eventLabel = (e: OrderEvent) => {
  if (e.comment?.startsWith('[')) return e.comment;
  const stage = stageName(e.stageId);
  return `${statusText(e.previousStatus)} → ${stage || statusText(e.newStatus)}`;
};
onMounted(async () => { await Promise.all([loadNames(), load()]); });
onBeforeUnmount(() => { if (reloadTimer) clearTimeout(reloadTimer); });
</script>

<template>
  <div class="mx-auto w-full max-w-5xl space-y-4 p-4 pb-safe-or-4">
    <!-- header: the title and hint follow the open report -->
    <div class="flex items-start gap-3">
      <NuxtLink :to="`/${nsSlug}/menu`" class="cp-icon mt-1 flex-shrink-0" :aria-label="t('common.back')"><Icon name="lucide:arrow-left" class="w-4 h-4" /></NuxtLink>
      <div class="min-w-0 flex-1">
        <h1 class="at-h2">{{ t('menu.reportTitle_' + tab) }}</h1>
        <p class="at-hint">{{ t('menu.reportHint_' + tab) }}</p>
      </div>
      <button type="button" class="at-btn flex-shrink-0" :disabled="!hasData" @click="exportXlsx"><Icon name="lucide:file-spreadsheet" class="w-4 h-4" /><span class="hidden sm:inline">Excel</span></button>
    </div>

    <div class="overflow-x-auto -mx-1 px-1"><div class="at-seg">
      <button v-for="k in TAB_KEYS" :key="k" type="button" class="at-seg__btn inline-flex items-center gap-1.5 whitespace-nowrap" :class="tab === k ? 'at-seg__btn--on' : ''" @click="setTab(k)">
        <Icon :name="TAB_ICONS[k]" class="w-4 h-4" />{{ t('menu.reportTab_' + k) }}
      </button>
    </div></div>

    <!-- period: presets + exact dates; changes reload the report by themselves -->
    <div class="at-panel !p-4 space-y-3">
      <div class="flex flex-wrap gap-1.5">
        <button v-for="p in PRESETS" :key="p.key" type="button" class="pill-filter" :class="activePreset === p.key ? 'pill-filter--active' : ''" @click="applyPreset(p.key)">{{ t(p.label) }}</button>
      </div>
      <div class="flex flex-wrap items-end gap-3">
        <div class="space-y-1"><label class="text-xs font-medium text-slate-500">{{ t('menu.executorsFrom') }}</label><UInput v-model="from" type="date" :max="to" /></div>
        <div class="space-y-1"><label class="text-xs font-medium text-slate-500">{{ t('menu.executorsTo') }}</label><UInput v-model="to" type="date" :min="from" /></div>
        <div v-if="tab === 'field' && fieldOptions.length" class="min-w-[14rem] flex-1 space-y-1 sm:max-w-xs">
          <label class="text-xs font-medium text-slate-500">{{ t('menu.reportField') }}</label>
          <USelectMenu v-model="fieldId" :options="fieldOptions" value-attribute="value" option-attribute="label" :ui="{ rounded: 'rounded-xl' }" :popper="{ strategy: 'fixed' }" />
        </div>
        <button type="button" class="at-btn ml-auto" :disabled="loading" :aria-label="t('common.refresh')" @click="load"><Icon :name="loading ? 'lucide:loader-2' : 'lucide:refresh-cw'" class="w-4 h-4" :class="{ 'animate-spin': loading }" /></button>
      </div>
    </div>

    <!-- state: error / first load / content -->
    <div v-if="loadError" class="at-panel">
      <EmptyState icon="lucide:triangle-alert" :title="t('menu.reportLoadFailed')" :description="loadError">
        <button type="button" class="at-btn mt-2" @click="load"><Icon name="lucide:refresh-cw" class="w-4 h-4" />{{ t('menu.reportRetry') }}</button>
      </EmptyState>
    </div>
    <div v-else-if="loading && !hasData" class="at-panel !p-4"><AppSkeleton variant="list" :rows="5" /></div>

    <template v-else>
      <!-- executors -->
      <template v-if="tab === 'executors'">
        <template v-if="rows.length">
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div class="at-stat"><div class="text-xs text-slate-500">{{ t('menu.reportExecutorsCount') }}</div><div class="text-xl font-bold tabular-nums">{{ rows.length }}</div></div>
            <div class="at-stat"><div class="text-xs text-slate-500">{{ t('menu.executorsLines') }}</div><div class="text-xl font-bold tabular-nums">{{ totals.lines }}</div></div>
            <div class="at-stat"><div class="text-xs text-slate-500">{{ t('menu.executorsRevenue') }}</div><div class="text-xl font-bold tabular-nums">{{ money(totals.revenue) }}</div></div>
            <div class="at-stat"><div class="text-xs text-slate-500">{{ t('menu.executorsPay') }}</div><div class="text-xl font-bold tabular-nums">{{ money(totals.pay) }}</div></div>
          </div>
          <div class="at-panel !p-2">
            <div v-for="r in sortedRows" :key="r.executorId || 'none'" class="at-row !py-3 space-y-1.5">
              <div class="flex items-center gap-3">
                <div class="min-w-0 flex-1">
                  <div class="truncate font-semibold" :class="r.executorId ? '' : 'text-slate-500'">{{ nameOf(r.executorId) }}</div>
                  <div class="text-xs text-slate-500">{{ r.orders }} {{ t('menu.executorsOrders').toLowerCase() }} · {{ r.lines }} {{ t('menu.executorsLines').toLowerCase() }}</div>
                </div>
                <div class="flex-shrink-0 text-right text-sm tabular-nums">
                  <div class="font-medium">{{ money(r.revenue) }}</div>
                  <div class="text-xs font-semibold text-accent-700 dark:text-blue-300">{{ t('menu.executorsPay') }}: {{ money(r.pay) }}</div>
                </div>
              </div>
              <div class="h-1.5 rounded-full bg-slate-100 dark:bg-white/10"><div class="h-1.5 rounded-full bg-accent-500" :style="{ width: Math.max(2, (r.revenue / maxRevenue) * 100) + '%' }" /></div>
            </div>
          </div>
        </template>
        <div v-else class="at-panel"><EmptyState icon="lucide:users" :title="t('menu.executorsEmpty')" :description="t('menu.reportEmptyHint')" /></div>
      </template>

      <!-- time in statuses -->
      <template v-else-if="tab === 'times'">
        <template v-if="times.length">
          <div v-if="slowest" class="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div class="at-stat col-span-2 sm:col-span-1"><div class="text-xs text-slate-500">{{ t('menu.reportSlowest') }}</div><div class="truncate text-base font-bold">{{ stageName(slowest.stageId) || statusText(slowest.status) }}</div></div>
            <div class="at-stat"><div class="text-xs text-slate-500">{{ t('menu.reportAvg') }}</div><div class="text-xl font-bold tabular-nums">{{ minutes(slowest.avgMinutes) }}</div></div>
            <div class="at-stat"><div class="text-xs text-slate-500">{{ t('menu.reportMax') }}</div><div class="text-xl font-bold tabular-nums">{{ minutes(slowest.maxMinutes) }}</div></div>
          </div>
          <div class="at-panel !p-2">
            <div v-for="r in sortedTimes" :key="r.status + (r.stageId || '')" class="at-row !py-3 space-y-1.5">
              <div class="flex items-center gap-2">
                <div class="min-w-0 flex-1 truncate font-semibold">{{ stageName(r.stageId) || statusText(r.status) }}<span v-if="r.stageId" class="ml-2 text-xs font-normal text-slate-500">{{ statusText(r.status) }}</span></div>
                <div class="flex-shrink-0 text-sm tabular-nums">{{ minutes(r.avgMinutes) }} <span class="text-xs text-slate-500">· {{ t('menu.reportMax').toLowerCase() }} {{ minutes(r.maxMinutes) }} · ×{{ r.visits }}</span></div>
              </div>
              <div class="h-1.5 rounded-full bg-slate-100 dark:bg-white/10"><div class="h-1.5 rounded-full bg-accent-500" :style="{ width: Math.max(2, (r.avgMinutes / maxAvg) * 100) + '%' }" /></div>
            </div>
          </div>
        </template>
        <div v-else class="at-panel"><EmptyState icon="lucide:timer" :title="t('menu.reportNoOrders')" :description="t('menu.reportEmptyHint')" /></div>
      </template>

      <!-- by field value -->
      <template v-else-if="tab === 'field'">
        <div v-if="!fieldOptions.length" class="at-panel">
          <EmptyState icon="lucide:list-filter" :title="t('menu.reportNoFields')" :description="t('menu.reportNoFieldsHint')">
            <NuxtLink :to="`/${nsSlug}/menu/settings`" class="at-btn mt-2"><Icon name="lucide:settings" class="w-4 h-4" />{{ t('menu.reportOpenSettings') }}</NuxtLink>
          </EmptyState>
        </div>
        <template v-else-if="fieldRows.length">
          <div class="grid grid-cols-3 gap-3">
            <div class="at-stat"><div class="text-xs text-slate-500">{{ t('menu.reportDone') }}</div><div class="text-xl font-bold tabular-nums">{{ fieldTotals.done }}</div></div>
            <div class="at-stat"><div class="text-xs text-slate-500">{{ t('menu.reportCancelled') }}</div><div class="text-xl font-bold tabular-nums">{{ fieldTotals.cancelled }}</div></div>
            <div class="at-stat"><div class="text-xs text-slate-500">{{ t('menu.reportAvgCheck') }}</div><div class="text-xl font-bold tabular-nums">{{ money(fieldTotals.avgCheck) }}</div></div>
          </div>
          <div class="at-panel !p-2">
            <div v-for="r in fieldRows" :key="r.value" class="at-row !py-3 space-y-1.5">
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                <div class="min-w-0 flex-1 basis-40 truncate font-semibold" :class="r.value ? '' : 'text-slate-500'">{{ r.value || t('menu.reportBlank') }}</div>
                <span class="at-chip !text-xs">{{ t('menu.reportDone') }} {{ r.completed }}</span>
                <span v-if="r.cancelled" class="at-chip !text-xs !bg-rose-500/10 !text-rose-600">{{ t('menu.reportCancelled') }} {{ r.cancelled }}</span>
                <span class="w-24 text-right text-sm tabular-nums">{{ money(r.avgCheck) }}</span>
              </div>
              <div class="h-1.5 rounded-full bg-slate-100 dark:bg-white/10"><div class="h-1.5 rounded-full bg-accent-500" :style="{ width: Math.max(2, ((r.completed + r.cancelled) / maxFieldCount) * 100) + '%' }" /></div>
            </div>
          </div>
        </template>
        <div v-else class="at-panel"><EmptyState icon="lucide:list-filter" :title="t('menu.executorsEmpty')" :description="t('menu.reportEmptyHint')" /></div>
      </template>

      <!-- journal -->
      <template v-else>
        <div v-if="events.length" class="at-panel !p-2">
          <div v-for="e in events" :key="e.id" class="at-row !py-2.5 flex items-center gap-3">
            <div class="w-20 shrink-0 font-mono font-semibold tabular-nums">{{ e.displayNumber || '#' + e.number }}</div>
            <div class="min-w-0 flex-1 truncate text-sm">{{ eventLabel(e) }}<span v-if="e.comment && !e.comment.startsWith('[')" class="text-slate-500"> · {{ e.comment }}</span></div>
            <div class="shrink-0 text-right text-xs text-slate-500">{{ e.userId ? (names[e.userId] || '') : '' }}<br>{{ formatDateTime(e.createdAt, locale) }}</div>
          </div>
          <div v-if="eventsTotal > 50" class="flex items-center justify-center gap-2 py-2">
            <button type="button" class="at-btn !px-3 !py-1" :disabled="eventsPage <= 1" @click="eventsPage--"><Icon name="lucide:chevron-left" class="w-4 h-4" /></button>
            <span class="text-sm tabular-nums">{{ eventsPage }} / {{ Math.ceil(eventsTotal / 50) }}</span>
            <button type="button" class="at-btn !px-3 !py-1" :disabled="eventsPage >= Math.ceil(eventsTotal / 50)" @click="eventsPage++"><Icon name="lucide:chevron-right" class="w-4 h-4" /></button>
          </div>
        </div>
        <div v-else class="at-panel"><EmptyState icon="lucide:scroll-text" :title="t('menu.reportNoEvents')" :description="t('menu.reportEmptyHint')" /></div>
      </template>
    </template>
  </div>
</template>
