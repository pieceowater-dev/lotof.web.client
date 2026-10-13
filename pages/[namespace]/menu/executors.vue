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
import { menuExecutorReport, type ExecutorReportRow } from '@/api/menu/order/extra';
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
const rows = ref<ExecutorReportRow[]>([]);
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
    rows.value = await menuExecutorReport(tk, nsSlug.value, closedFrom, closedTo);
  } catch (e) {
    logError('[menu/executors] load failed', e);
    toast.add({ title: getErrorMessage(e, t) || t('common.error'), color: 'red' });
  } finally { loading.value = false; }
}

function exportXlsx() {
  const data = rows.value.map((r) => ({
    [t('menu.executorsTitle')]: nameOf(r.executorId), [t('menu.executorsLines')]: r.lines, [t('menu.executorsOrders')]: r.orders,
    [t('menu.executorsRevenue')]: r.revenue, [t('menu.executorsPay')]: r.pay,
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Executors');
  XLSX.writeFile(wb, `executors-${from.value}_${to.value}.xlsx`);
}

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
      <button type="button" class="at-btn" :disabled="!rows.length" @click="exportXlsx"><Icon name="lucide:file-spreadsheet" class="w-4 h-4" />Excel</button>
    </div>

    <div class="at-panel !p-4 flex items-end gap-3 flex-wrap">
      <div class="space-y-1"><label class="text-xs font-medium text-slate-500">{{ t('menu.executorsFrom') }}</label><UInput v-model="from" type="date" /></div>
      <div class="space-y-1"><label class="text-xs font-medium text-slate-500">{{ t('menu.executorsTo') }}</label><UInput v-model="to" type="date" /></div>
      <button type="button" class="at-btn at-btn--blue" :disabled="loading" @click="load"><Icon :name="loading ? 'lucide:loader-2' : 'lucide:refresh-cw'" class="w-4 h-4" :class="{ 'animate-spin': loading }" />{{ t('common.refresh') }}</button>
    </div>

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
  </div>
</template>
