<script lang="ts" setup>
import { presetRange, presetOf, type PeriodPreset } from '@/utils/reportPeriods';
import { useGoodsMoney } from '@/composables/useGoodsMoney';
import AppSkeleton from '@/components/ui/AppSkeleton.vue';
definePageMeta({ layout: 'workspace' });

import { useI18n } from '@/composables/useI18n';
import { useGoodsAuth } from '@/composables/useGoodsAuth';
import { useNamespace } from '@/composables/useNamespace';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import type { GoodsTopGoodsEntry, GoodsAbcEntry, GoodsMarginReport, GoodsTurnoverEntry } from '@/api/goods/analytics';
import type { GoodsStock } from '@/api/goods/stock';
import type { GoodsBatch } from '@/api/goods/goodbatch';
import type { GoodsGood } from '@/api/goods/good';
import GoodsNavTabs from '@/components/goods/GoodsNavTabs.vue';
import GoodsRegisterButton from '@/components/goods/GoodsRegisterButton.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import { usePageTitle } from '@/composables/usePageTitle';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const { titleBySlug } = useNamespace();

usePageTitle('goods', { section: 'reports' });
const { money } = useGoodsMoney();

const { getToken: getGoodsTokenRaw } = useGoodsAuth();
async function getToken(): Promise<string> {
  return getGoodsTokenRaw(nsSlug.value);
}

const TABS = [
  { key: 'top', labelKey: 'goods.topGoods', icon: 'lucide:trending-up' },
  { key: 'abc', labelKey: 'goods.abcAnalysis', icon: 'lucide:layers' },
  { key: 'margin', labelKey: 'goods.marginReport', icon: 'lucide:percent' },
  { key: 'turnover', labelKey: 'goods.turnoverReport', icon: 'lucide:arrow-left-right' },
  { key: 'documents', labelKey: 'goods.docsReport', icon: 'lucide:files' },
  { key: 'suppliers', labelKey: 'goods.suppliersReport', icon: 'lucide:truck' },
  { key: 'alerts', labelKey: 'goods.lowStockAlerts', icon: 'lucide:bell' },
] as const;
const activeTab = ref<(typeof TABS)[number]['key']>('top');
const loading = ref(false);
const goods = ref<GoodsGood[]>([]);
const goodName = (id: string) => goods.value.find((g) => g.id === id)?.name || t('goods.unknownItem');

const today = new Date();
const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
const from = ref(monthAgo.toISOString().slice(0, 10));
const to = ref(today.toISOString().slice(0, 10));

const PRESETS = [
  { key: 'today', label: 'menu.periodToday' },
  { key: 'week', label: 'menu.period7' },
  { key: 'month', label: 'menu.periodMonth' },
  { key: 'prevMonth', label: 'menu.periodPrevMonth' },
  { key: 'all', label: 'menu.periodAll' },
] as const;
function applyPreset(key: PeriodPreset) {
  const r = presetRange(key, new Date());
  from.value = r.from;
  to.value = r.to;
}
const activePreset = computed(() => presetOf(from.value, to.value, new Date()));

const topGoods = ref<GoodsTopGoodsEntry[]>([]);
const abcEntries = ref<GoodsAbcEntry[]>([]);
const marginReport = ref<GoodsMarginReport | null>(null);
const turnover = ref<GoodsTurnoverEntry[]>([]);
const turnoverTotals = computed(() => ({
  received: turnover.value.reduce((s, e) => s + e.received, 0),
  issued: turnover.value.reduce((s, e) => s + e.issued, 0),
  value: turnover.value.reduce((s, e) => s + e.closingValueCents, 0),
}));
async function exportTurnover() {
  const XLSX = await import('xlsx');
  const rows = turnover.value.map((e) => ({
    [t('goods.goodName')]: e.goodName, [t('goods.turnOpening')]: e.opening, [t('goods.turnReceived')]: e.received,
    [t('goods.turnIssued')]: e.issued, [t('goods.turnClosing')]: e.closing, [t('goods.stockValue')]: e.closingValueCents / 100,
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'turnover');
  XLSX.writeFile(wb, `turnover-${from.value}-${to.value}.xlsx`);
}
const lowStock = ref<GoodsStock[]>([]);
const thresholds = ref<Array<{ goodId: string; warehouseId?: string | null; thresholdQty: number }>>([]);
// How many to buy to get back to the threshold (the warehouse's own threshold wins over the shared one).
function toBuy(s: GoodsStock): number {
  const own = thresholds.value.find((x) => x.goodId === s.goodId && x.warehouseId === s.warehouseId)
    || thresholds.value.find((x) => x.goodId === s.goodId && !x.warehouseId);
  return own ? Math.max(0, own.thresholdQty - s.available) : 0;
}
async function exportToBuy() {
  const XLSX = await import('xlsx');
  const rows = lowStock.value.map((s) => ({
    [t('goods.good')]: goodName(s.goodId), [t('goods.available')]: s.available, [t('goods.toBuy')]: toBuy(s),
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'to-buy');
  XLSX.writeFile(wb, `to-buy-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
const expiringBatches = ref<GoodsBatch[]>([]);

// Documents and suppliers reports are computed from the document lists for the chosen period.
type DocRow = { kind: string; count: number; cancelled: number; sumCents: number };
type SupplierRow = { id: string; name: string; receipts: number; receivedCents: number; returns: number; returnedCents: number };
const docRows = ref<DocRow[]>([]);
const supplierRows = ref<SupplierRow[]>([]);
async function loadDocsAndSuppliers() {
  const token = await getToken();
  const [{ goodsListReceipts }, { goodsListWriteOffs }, { goodsListStockTransfers }, { goodsListSupplierReturns }, { goodsListSuppliers }] = await Promise.all([
    import('@/api/goods/goodsreceipt'), import('@/api/goods/writeoff'), import('@/api/goods/stocktransfer'), import('@/api/goods/supplierreturn'), import('@/api/goods/supplier'),
  ]);
  const [rc, wo, tr, sr, su] = await Promise.all([
    goodsListReceipts(token, nsSlug.value), goodsListWriteOffs(token, nsSlug.value), goodsListStockTransfers(token, nsSlug.value),
    goodsListSupplierReturns(token, nsSlug.value), goodsListSuppliers(token, nsSlug.value),
  ]);
  const fromMs = new Date(from.value).getTime();
  const toMs = new Date(to.value + 'T23:59:59').getTime();
  const inRange = (iso: string) => { const ms = new Date(iso).getTime(); return ms >= fromMs && ms <= toMs; };
  const receipts = rc.receipts.filter((r) => inRange(r.createdAt));
  const returns = sr.returns.filter((r) => inRange(r.createdAt));
  const receiptSum = (r: (typeof receipts)[number]) => r.items.reduce((a, i) => a + Math.round((i.costPriceCents || 0) * i.quantity), 0);
  docRows.value = [
    { kind: 'goods.receiving', count: receipts.length, cancelled: receipts.filter((r) => r.cancelledAt).length, sumCents: receipts.filter((r) => !r.cancelledAt).reduce((a, r) => a + receiptSum(r), 0) },
    { kind: 'goods.supplierReturns', count: returns.length, cancelled: returns.filter((r) => r.cancelledAt).length, sumCents: returns.filter((r) => !r.cancelledAt).reduce((a, r) => a + r.totalCents, 0) },
    { kind: 'goods.writeoffs', count: wo.writeOffs.filter((r) => inRange(r.createdAt)).length, cancelled: wo.writeOffs.filter((r) => inRange(r.createdAt) && r.cancelledAt).length, sumCents: 0 },
    { kind: 'goods.transfers', count: tr.transfers.filter((r) => inRange(r.createdAt)).length, cancelled: 0, sumCents: 0 },
  ];
  const names = new Map(su.suppliers.map((x) => [x.id, x.name]));
  const bySupplier = new Map<string, SupplierRow>();
  const row = (id: string) => {
    if (!bySupplier.has(id)) bySupplier.set(id, { id, name: id ? names.get(id) || t('goods.unknownSupplier') : t('goods.noSupplier'), receipts: 0, receivedCents: 0, returns: 0, returnedCents: 0 });
    return bySupplier.get(id)!;
  };
  for (const r of receipts.filter((x) => !x.cancelledAt)) { const x = row(r.supplierId || ''); x.receipts += 1; x.receivedCents += receiptSum(r); }
  for (const r of returns.filter((x) => !x.cancelledAt)) { const x = row(r.supplierId || ''); x.returns += 1; x.returnedCents += r.totalCents; }
  supplierRows.value = [...bySupplier.values()].sort((a, b) => b.receivedCents - a.receivedCents);
}

// Lightweight bar visualization without pulling in a charting dependency --
// each row's bar is sized relative to the largest value in the list.
const maxRevenue = computed(() => Math.max(1, ...topGoods.value.map((e) => e.revenueCents)));

function rangeIso() {
  return { from: new Date(from.value).toISOString(), to: new Date(to.value + 'T23:59:59').toISOString() };
}

async function loadReport() {
  loading.value = true;
  try {
    const token = await getToken();
    const { from: f, to: tt } = rangeIso();
    if (activeTab.value === 'top') {
      const { goodsTopGoods } = await import('@/api/goods/analytics');
      topGoods.value = await goodsTopGoods(token, nsSlug.value, f, tt);
    } else if (activeTab.value === 'abc') {
      const { goodsAbcAnalysis } = await import('@/api/goods/analytics');
      abcEntries.value = await goodsAbcAnalysis(token, nsSlug.value, f, tt);
    } else if (activeTab.value === 'turnover') {
      const { goodsTurnoverReport } = await import('@/api/goods/analytics');
      turnover.value = await goodsTurnoverReport(token, nsSlug.value, f, tt);
    } else if (activeTab.value === 'margin') {
      const { goodsMarginReport } = await import('@/api/goods/analytics');
      marginReport.value = await goodsMarginReport(token, nsSlug.value, f, tt);
    } else if (activeTab.value === 'documents' || activeTab.value === 'suppliers') {
      await loadDocsAndSuppliers();
    } else {
      const { goodsListStock } = await import('@/api/goods/stock');
      const { goodsListExpiringBatches } = await import('@/api/goods/goodbatch');
      const { goodsListLowStockThresholds } = await import('@/api/goods/lowstock');
      const [{ stock }, batches, ths] = await Promise.all([
        goodsListStock(token, nsSlug.value, { lowStockOnly: true }),
        goodsListExpiringBatches(token, nsSlug.value),
        goodsListLowStockThresholds(token, nsSlug.value),
      ]);
      thresholds.value = ths;
      lowStock.value = stock;
      expiringBatches.value = batches;
    }
  } catch (e) {
    logError('[goods/reports] loadReport failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to load report', color: 'red' });
  } finally {
    loading.value = false;
  }
}

watch(activeTab, loadReport);
// The period applies by itself (no Apply button): any change of a date reloads the report.
watch([from, to], () => { if (from.value && to.value && from.value <= to.value) void loadReport(); });

onMounted(async () => {
  try {
    const token = await getToken();
    const { goodsListGoods } = await import('@/api/goods/good');
    const { goods: g } = await goodsListGoods(token, nsSlug.value);
    goods.value = g;
  } catch {}
  await loadReport();
});
</script>

<template>
  <div class="at-scope ct-scope min-h-full md:h-full flex flex-col p-4 pb-safe-or-4 md:min-h-0">
    <div class="flex items-center justify-between gap-3 flex-shrink-0">
      <div>
        <h1 class="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">{{ t('goods.reports') }}</h1>
        <p class="hidden sm:block text-sm text-gray-600 dark:text-gray-400 mt-0.5">{{ t('goods.reportsSubtitle') }}</p>
      </div>
      <GoodsRegisterButton />
    </div>

    <div class="flex-shrink-0 mt-3">
      <GoodsNavTabs>
        <template #search>
          <!-- Report-type pill switcher shares this row now -- deliberately
               NOT styled like the real route tabs below, since this
               switches local component state, not the URL. -->
          <div class="flex items-center gap-2 overflow-x-auto pb-0.5">
            <button
              v-for="tab in TABS"
              :key="tab.key"
              type="button"
              class="px-3 py-1.5 rounded-full text-sm font-medium border transition whitespace-nowrap flex items-center gap-1.5"
              :class="activeTab === tab.key
                ? 'bg-primary-100 text-primary-700 border-primary-200 dark:bg-primary-900/40 dark:text-primary-100 dark:border-primary-900/60'
                : 'bg-gray-50 dark:bg-gray-900/60 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300'"
              @click="activeTab = tab.key"
            >
              <UIcon :name="tab.icon" class="w-4 h-4" />
              {{ t(tab.labelKey) }}
            </button>
          </div>
        </template>
      </GoodsNavTabs>
    </div>

    <!-- period: presets + exact dates; the dates wrap on phones instead of running off the edge -->
    <div v-if="activeTab !== 'alerts'" class="mt-3 flex-shrink-0 space-y-2.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5 dark:border-gray-800 dark:bg-gray-900">
      <div class="flex flex-wrap gap-1.5">
        <button v-for="p in PRESETS" :key="p.key" type="button" class="pill-filter" :class="activePreset === p.key ? 'pill-filter--active' : ''" @click="applyPreset(p.key)">{{ t(p.label) }}</button>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <UInput v-model="from" type="date" size="sm" class="min-w-[9.5rem] flex-1" :max="to" />
        <span class="hidden flex-shrink-0 text-gray-300 sm:inline dark:text-gray-600">—</span>
        <UInput v-model="to" type="date" size="sm" class="min-w-[9.5rem] flex-1" :min="from" />
        <button type="button" class="at-btn flex-shrink-0 !px-2.5" :disabled="loading" :aria-label="t('common.refresh')" :title="t('common.refresh')" @click="loadReport"><Icon :name="loading ? 'lucide:loader-2' : 'lucide:refresh-cw'" class="h-4 w-4" :class="{ 'animate-spin': loading }" /></button>
      </div>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto mt-3">
      <div v-if="loading" class="py-4"><AppSkeleton variant="list" :rows="3" /></div>

      <div v-else-if="activeTab === 'top'" class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
        <div v-for="(e, idx) in topGoods" :key="e.goodId" class="px-4 py-2.5 text-sm flex items-center gap-3">
          <span class="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs font-semibold flex items-center justify-center tabular-nums">{{ idx + 1 }}</span>
          <div class="flex-1 min-w-0 space-y-1">
            <div class="flex items-center justify-between gap-2">
              <span class="font-medium truncate">{{ e.goodName }}</span>
              <span class="tabular-nums text-gray-500 dark:text-gray-400 flex-shrink-0">{{ e.quantitySold }} · {{ money(e.revenueCents) }}</span>
            </div>
            <div class="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
              <div class="h-full rounded-full bg-primary-400 dark:bg-primary-600" :style="{ width: `${(e.revenueCents / maxRevenue) * 100}%` }" />
            </div>
          </div>
        </div>
        <EmptyState v-if="!topGoods.length" icon="lucide:trending-up" :title="t('goods.noReportData')" />
      </div>

      <div v-else-if="activeTab === 'abc'" class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
        <div v-for="e in abcEntries" :key="e.goodId" class="px-4 py-2.5 text-sm space-y-1">
          <div class="flex items-center justify-between">
            <span class="font-medium">{{ e.goodName }}</span>
            <div class="flex items-center gap-2">
              <UBadge :color="e.class === 'A' ? 'green' : e.class === 'B' ? 'amber' : 'gray'" variant="soft" size="xs">{{ e.class }}</UBadge>
              <span class="tabular-nums text-gray-500 dark:text-gray-400">{{ money(e.revenueCents) }} ({{ e.revenueSharePercent.toFixed(1) }}%)</span>
            </div>
          </div>
          <div class="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div
              class="h-full rounded-full"
              :class="e.class === 'A' ? 'bg-emerald-500' : e.class === 'B' ? 'bg-amber-500' : 'bg-gray-400'"
              :style="{ width: `${Math.min(100, e.revenueSharePercent)}%` }"
            />
          </div>
        </div>
        <EmptyState v-if="!abcEntries.length" icon="lucide:layers" :title="t('goods.noReportData')" />
      </div>

      <div v-else-if="activeTab === 'margin' && marginReport" class="space-y-3">
        <div class="grid grid-cols-3 gap-3">
          <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <div class="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{{ money(marginReport.totalRevenueCents) }}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ t('goods.total') }}</div>
          </div>
          <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <div class="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{{ money(marginReport.totalCostCents) }}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ t('goods.costPrice') }}</div>
          </div>
          <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <div class="text-2xl font-bold tabular-nums" :class="marginReport.totalMarginCents >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'">
              {{ money(marginReport.totalMarginCents) }}
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ t('goods.marginReport') }} ({{ marginReport.totalMarginPercent.toFixed(1) }}%)</div>
          </div>
        </div>
        <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
          <div v-for="e in marginReport.entries" :key="e.saleId" class="flex items-center justify-between px-4 py-2.5 text-sm">
            <span class="font-medium">{{ e.number }}</span>
            <span class="tabular-nums text-gray-500 dark:text-gray-400">{{ money(e.marginCents) }} ({{ e.marginPercent.toFixed(1) }}%)</span>
          </div>
          <EmptyState v-if="!marginReport.entries.length" icon="lucide:percent" :title="t('goods.noReportData')" />
        </div>
      </div>

      <div v-else-if="activeTab === 'turnover'" class="space-y-3">
        <div class="flex items-center justify-between gap-2">
          <div class="flex flex-wrap gap-2">
            <span class="at-chip">{{ t('goods.turnReceived') }}: <b class="tabular-nums">{{ turnoverTotals.received }}</b></span>
            <span class="at-chip">{{ t('goods.turnIssued') }}: <b class="tabular-nums">{{ turnoverTotals.issued }}</b></span>
            <span class="at-chip">{{ t('goods.stockValue') }}: <b class="tabular-nums">{{ money(turnoverTotals.value) }}</b></span>
          </div>
          <button type="button" class="at-btn !px-3 !py-1.5 hidden sm:inline-flex" :disabled="!turnover.length" @click="exportTurnover"><Icon name="lucide:file-spreadsheet" class="h-4 w-4" />{{ t('common.export') }}</button>
        </div>
        <div class="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <table class="w-full text-sm">
            <thead class="text-xs uppercase tracking-wide text-gray-500">
              <tr class="border-b border-gray-100 dark:border-gray-800">
                <th class="px-4 py-2 text-left font-medium">{{ t('goods.goodName') }}</th>
                <th class="px-3 py-2 text-right font-medium">{{ t('goods.turnOpening') }}</th>
                <th class="px-3 py-2 text-right font-medium">{{ t('goods.turnReceived') }}</th>
                <th class="px-3 py-2 text-right font-medium">{{ t('goods.turnIssued') }}</th>
                <th class="px-3 py-2 text-right font-medium">{{ t('goods.turnClosing') }}</th>
                <th class="hidden px-4 py-2 text-right font-medium sm:table-cell">{{ t('goods.stockValue') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
              <tr v-for="e in turnover" :key="e.goodId">
                <td class="px-4 py-2 font-medium">{{ e.goodName }}</td>
                <td class="px-3 py-2 text-right tabular-nums text-gray-500">{{ e.opening }}</td>
                <td class="px-3 py-2 text-right tabular-nums text-emerald-600">{{ e.received || '' }}</td>
                <td class="px-3 py-2 text-right tabular-nums text-rose-600">{{ e.issued || '' }}</td>
                <td class="px-3 py-2 text-right font-semibold tabular-nums">{{ e.closing }}</td>
                <td class="hidden px-4 py-2 text-right tabular-nums text-gray-500 sm:table-cell">{{ money(e.closingValueCents) }}</td>
              </tr>
            </tbody>
          </table>
          <EmptyState v-if="!turnover.length" icon="lucide:arrow-left-right" :title="t('goods.noReportData')" />
        </div>
      </div>

      <div v-else-if="activeTab === 'documents'" class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
        <div v-for="d in docRows" :key="d.kind" class="flex items-center justify-between gap-3 px-4 py-3 text-sm">
          <span class="font-medium">{{ t(d.kind) }}</span>
          <span class="flex items-center gap-3 text-gray-500">
            <span>{{ t('goods.docsCount') }}: <b class="tabular-nums text-gray-900 dark:text-white">{{ d.count }}</b></span>
            <span v-if="d.cancelled">{{ t('goods.cancelledBadge') }}: <b class="tabular-nums">{{ d.cancelled }}</b></span>
            <span v-if="d.sumCents" class="tabular-nums text-gray-900 dark:text-white">{{ money(d.sumCents) }}</span>
          </span>
        </div>
      </div>

      <div v-else-if="activeTab === 'suppliers'" class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
        <div v-for="x in supplierRows" :key="x.id || 'none'" class="flex items-center justify-between gap-3 px-4 py-3 text-sm">
          <span class="min-w-0 truncate font-medium">{{ x.name }}</span>
          <span class="flex flex-shrink-0 items-center gap-3 text-gray-500">
            <span>{{ t('goods.receiving') }}: <b class="tabular-nums text-gray-900 dark:text-white">{{ x.receipts }}</b> · {{ money(x.receivedCents) }}</span>
            <span v-if="x.returns">{{ t('goods.supplierReturns') }}: <b class="tabular-nums">{{ x.returns }}</b> · {{ money(x.returnedCents) }}</span>
          </span>
        </div>
        <EmptyState v-if="!supplierRows.length" icon="lucide:truck" :title="t('goods.noReportData')" />
      </div>

      <div v-else-if="activeTab === 'alerts'" class="space-y-4">
        <div>
          <div class="mb-2 flex items-center justify-between">
            <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ t('goods.lowStockAlerts') }}</h3>
            <button type="button" class="at-btn !px-3 !py-1.5 hidden sm:inline-flex" :disabled="!lowStock.length" @click="exportToBuy"><Icon name="lucide:file-spreadsheet" class="h-4 w-4" />{{ t('common.export') }}</button>
          </div>
          <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
            <div v-for="s in lowStock" :key="`${s.warehouseId}-${s.goodId}`" class="flex items-center justify-between px-4 py-2.5 text-sm">
              <span class="font-medium">{{ goodName(s.goodId) }}</span>
              <span class="flex items-center gap-2">
                <span v-if="toBuy(s)" class="text-xs text-gray-500">{{ t('goods.toBuy') }}: <b class="tabular-nums">{{ toBuy(s) }}</b></span>
                <UBadge color="amber" variant="soft">{{ s.available }}</UBadge>
              </span>
            </div>
            <EmptyState v-if="!lowStock.length" icon="lucide:package-check" :title="t('goods.noLowStock')" />
          </div>
        </div>
        <div>
          <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">{{ t('goods.expiringBatches') }}</h3>
          <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
            <div v-for="b in expiringBatches" :key="b.id" class="flex items-center justify-between px-4 py-2.5 text-sm">
              <span class="font-medium">{{ goodName(b.goodId) }} <span v-if="b.batchNumber" class="text-gray-400">({{ b.batchNumber }})</span></span>
              <UBadge color="red" variant="soft">{{ b.expiryDate }}</UBadge>
            </div>
            <EmptyState v-if="!expiringBatches.length" icon="lucide:calendar-check" :title="t('goods.noExpiringBatches')" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
