<script lang="ts" setup>
definePageMeta({ layout: 'workspace' });
import { ref, computed, onMounted } from 'vue';
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
import * as XLSX from 'xlsx';

// Pay-by-executor report: closed orders of a period, lines, revenue and the
// executors' share of WORK lines.
const { t } = useI18n();
const route = useRoute();
const toast = useToast();
const { token: hubToken } = useAuth();
const nsSlug = computed(() => route.params.namespace as string);

const today = new Date();
const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const from = ref(iso(monthStart));
const to = ref(iso(today));
const tab = ref<'executors' | 'times' | 'field' | 'journal'>('executors');
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
const stageName = (id?: string | null) => stages.value.find((x) => x.id === id)?.name || '';
const minutes = (m: number) => (m < 1 ? '<1 min' : m < 60 ? `${Math.round(m)} min` : m < 1440 ? `${(m / 60).toFixed(1)} h` : `${(m / 1440).toFixed(1)} d`);
const maxAvg = computed(() => Math.max(1, ...times.value.map((x) => x.avgMinutes)));
const names = ref<Record<string, string>>({});
const loading = ref(true);

const totals = computed(() => rows.value.reduce((a, r) => ({ lines: a.lines + r.lines, revenue: a.revenue + r.revenue, pay: a.pay + r.pay }), { lines: 0, revenue: 0, pay: 0 }));
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
    logError('[menu/executors] load failed', e);
    toast.add({ title: getErrorMessage(e, t) || t('common.error'), color: 'red' });
  } finally { loading.value = false; }
}

function exportXlsx() {
  if (tab.value !== 'executors') return;
  const data = rows.value.map((r) => ({
    [t('menu.executorsTitle')]: nameOf(r.executorId), [t('menu.executorsLines')]: r.lines, [t('menu.executorsOrders')]: r.orders,
    [t('menu.executorsRevenue')]: r.revenue, [t('menu.executorsPay')]: r.pay,
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Executors');
  XLSX.writeFile(wb, `executors-${from.value}_${to.value}.xlsx`);
}

function setTab(k: 'executors' | 'times' | 'field' | 'journal') { tab.value = k; eventsPage.value = 1; load(); }
const statusText = (s: string) => defaultStatusLabel(s, t);
const eventLabel = (e: OrderEvent) => {
  if (e.comment?.startsWith('[')) return e.comment;
  const stage = stageName(e.stageId);
  return `${statusText(e.previousStatus)} → ${stage || statusText(e.newStatus)}`;
};
onMounted(async () => { await Promise.all([loadNames(), load()]); });
</script>

<template>
  <div class="mx-auto w-full max-w-4xl space-y-4 p-4">
    <div class="flex items-center gap-2">
      <NuxtLink :to="`/${nsSlug}/menu`" class="cp-icon" :aria-label="t('common.back')"><Icon name="lucide:arrow-left" class="w-4 h-4" /></NuxtLink>
      <div class="min-w-0 flex-1">
        <h1 class="at-h2">{{ t('menu.executorsTitle') }}</h1>
        <p class="at-hint">{{ t('menu.executorsHint') }}</p>
      </div>
      <button v-if="tab === 'executors'" type="button" class="at-btn" :disabled="!rows.length" @click="exportXlsx"><Icon name="lucide:file-spreadsheet" class="w-4 h-4" />Excel</button>
    </div>

    <div class="at-seg">
      <button v-for="k in (['executors', 'times', 'field', 'journal'] as const)" :key="k" type="button" class="at-seg__btn" :class="tab === k ? 'at-seg__btn--on' : ''" @click="setTab(k)">{{ t('menu.reportTab_' + k) }}</button>
    </div>

    <div class="at-panel !p-4 flex items-end gap-3 flex-wrap">
      <div class="space-y-1"><label class="text-xs font-medium text-slate-500">{{ t('menu.executorsFrom') }}</label><UInput v-model="from" type="date" /></div>
      <div class="space-y-1"><label class="text-xs font-medium text-slate-500">{{ t('menu.executorsTo') }}</label><UInput v-model="to" type="date" /></div>
      <div v-if="tab === 'field'" class="space-y-1 min-w-[12rem]">
        <label class="text-xs font-medium text-slate-500">{{ t('menu.reportField') }}</label>
        <USelectMenu v-model="fieldId" :options="listFields.map((f) => ({ label: f.label, value: f.id }))" value-attribute="value" option-attribute="label" :ui="{ rounded: 'rounded-xl' }" :popper="{ strategy: 'fixed' }" @update:model-value="load" />
      </div>
      <button type="button" class="at-btn at-btn--blue" :disabled="loading" @click="load"><Icon :name="loading ? 'lucide:loader-2' : 'lucide:refresh-cw'" class="w-4 h-4" :class="{ 'animate-spin': loading }" />{{ t('common.refresh') }}</button>
    </div>

    <template v-if="tab === 'executors'">
    <div v-if="rows.length" class="grid grid-cols-3 gap-3">
      <div class="at-stat"><div class="text-xs text-slate-500">{{ t('menu.executorsLines') }}</div><div class="text-xl font-bold tabular-nums">{{ totals.lines }}</div></div>
      <div class="at-stat"><div class="text-xs text-slate-500">{{ t('menu.executorsRevenue') }}</div><div class="text-xl font-bold tabular-nums">{{ money(totals.revenue) }}</div></div>
      <div class="at-stat"><div class="text-xs text-slate-500">{{ t('menu.executorsPay') }}</div><div class="text-xl font-bold tabular-nums">{{ money(totals.pay) }}</div></div>
    </div>

    <div class="at-panel !p-2">
      <div v-if="!loading && !rows.length" class="at-empty-box">{{ t('menu.executorsEmpty') }}</div>
      <div v-for="r in rows" :key="r.executorId || 'none'" class="at-row !py-3 flex items-center gap-3">
        <div class="min-w-0 flex-1">
          <div class="font-semibold truncate" :class="r.executorId ? '' : 'text-slate-500'">{{ nameOf(r.executorId) }}</div>
          <div class="text-xs text-slate-500">{{ r.orders }} {{ t('menu.executorsOrders').toLowerCase() }} · {{ r.lines }} {{ t('menu.executorsLines').toLowerCase() }}</div>
        </div>
        <div class="text-right text-sm tabular-nums">
          <div>{{ money(r.revenue) }}</div>
          <div class="text-xs font-semibold text-accent-700 dark:text-blue-300">{{ t('menu.executorsPay') }}: {{ money(r.pay) }}</div>
        </div>
      </div>
    </div>
    </template>

    <!-- status times -->
    <div v-if="tab === 'times'" class="at-panel !p-2">
      <p class="at-hint px-3 pt-2">{{ t('menu.reportTimesHint') }}</p>
      <div v-if="!loading && !times.length" class="at-empty-box">{{ t('menu.executorsEmpty') }}</div>
      <div v-for="r in times" :key="r.status + (r.stageId || '')" class="at-row !py-3 space-y-1.5">
        <div class="flex items-center gap-2">
          <div class="min-w-0 flex-1 font-semibold truncate">{{ stageName(r.stageId) || statusText(r.status) }}<span v-if="r.stageId" class="ml-2 text-xs font-normal text-slate-500">{{ statusText(r.status) }}</span></div>
          <div class="text-sm tabular-nums">{{ minutes(r.avgMinutes) }} <span class="text-xs text-slate-500">· max {{ minutes(r.maxMinutes) }} · ×{{ r.visits }}</span></div>
        </div>
        <div class="h-1.5 rounded-full bg-slate-100 dark:bg-white/10"><div class="h-1.5 rounded-full bg-accent-500" :style="{ width: Math.max(2, (r.avgMinutes / maxAvg) * 100) + '%' }" /></div>
      </div>
    </div>

    <!-- by field value -->
    <div v-if="tab === 'field'" class="at-panel !p-2">
      <p class="at-hint px-3 pt-2">{{ t('menu.reportFieldHint') }}</p>
      <div v-if="!loading && !fieldRows.length" class="at-empty-box">{{ t('menu.executorsEmpty') }}</div>
      <div v-for="r in fieldRows" :key="r.value" class="at-row !py-3 flex items-center gap-3">
        <div class="min-w-0 flex-1 font-semibold truncate" :class="r.value ? '' : 'text-slate-500'">{{ r.value || t('menu.reportBlank') }}</div>
        <div class="flex items-center gap-3 text-sm tabular-nums">
          <span class="at-chip !text-xs">{{ t('menu.reportDone') }} {{ r.completed }}</span>
          <span class="at-chip !text-xs !bg-rose-500/10 !text-rose-600">{{ t('menu.reportCancelled') }} {{ r.cancelled }}</span>
          <span class="text-right w-24">{{ money(r.avgCheck) }}</span>
        </div>
      </div>
    </div>

    <!-- journal -->
    <div v-if="tab === 'journal'" class="at-panel !p-2">
      <div v-if="!loading && !events.length" class="at-empty-box">{{ t('menu.executorsEmpty') }}</div>
      <div v-for="e in events" :key="e.id" class="at-row !py-2.5 flex items-center gap-3">
        <div class="font-mono font-semibold tabular-nums w-20 shrink-0">{{ e.displayNumber || '#' + e.number }}</div>
        <div class="min-w-0 flex-1 text-sm truncate">{{ eventLabel(e) }}<span v-if="e.comment && !e.comment.startsWith('[')" class="text-slate-500"> · {{ e.comment }}</span></div>
        <div class="text-xs text-slate-500 text-right shrink-0">{{ e.userId ? (names[e.userId] || '') : '' }}<br>{{ new Date(e.createdAt).toLocaleString() }}</div>
      </div>
      <div v-if="eventsTotal > 50" class="flex items-center justify-center gap-2 py-2">
        <button type="button" class="at-btn !px-3 !py-1" :disabled="eventsPage <= 1" @click="eventsPage--; load()"><Icon name="lucide:chevron-left" class="w-4 h-4" /></button>
        <span class="text-sm tabular-nums">{{ eventsPage }} / {{ Math.ceil(eventsTotal / 50) }}</span>
        <button type="button" class="at-btn !px-3 !py-1" :disabled="eventsPage >= Math.ceil(eventsTotal / 50)" @click="eventsPage++; load()"><Icon name="lucide:chevron-right" class="w-4 h-4" /></button>
      </div>
    </div>
  </div>
</template>
