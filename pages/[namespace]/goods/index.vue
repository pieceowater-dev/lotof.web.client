<script lang="ts" setup>
definePageMeta({ layout: 'workspace' });

import { useI18n } from '@/composables/useI18n';
import { useGoodsAuth } from '@/composables/useGoodsAuth';
import { useNamespace } from '@/composables/useNamespace';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import AppTable from '@/components/ui/AppTable.vue';
import GoodsNavTabs from '@/components/goods/GoodsNavTabs.vue';
import GoodsRegisterButton from '@/components/goods/GoodsRegisterButton.vue';
import GoodFormModal from '@/components/goods/GoodFormModal.vue';
import GoodHistoryModal from '@/components/goods/GoodHistoryModal.vue';
import type { GoodsWarehouse } from '@/api/goods/warehouse';
import type { GoodsGood, CreateGoodInput, UpdateGoodInput } from '@/api/goods/good';
import type { GoodsStock } from '@/api/goods/stock';
import type { GoodsUnit } from '@/api/goods/unit';
import { useOnboarding } from '@/composables/useOnboarding';
import { goodsTour } from '@/config/tours';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const { titleBySlug } = useNamespace();

useHead(() => ({
  title: titleBySlug(nsSlug.value) ? `${t('app.goods')} — ${titleBySlug(nsSlug.value)}` : t('app.goods'),
}));

const { getToken: getGoodsTokenRaw } = useGoodsAuth();
async function getToken(): Promise<string> {
  return getGoodsTokenRaw(nsSlug.value);
}

const loading = ref(true);
const warehouses = ref<GoodsWarehouse[]>([]);
const goods = ref<GoodsGood[]>([]);
const stock = ref<GoodsStock[]>([]);
const units = ref<GoodsUnit[]>([]);

// Global warehouse filter (plan §7) -- persisted per namespace so the
// choice survives a reload/navigation, same pattern as Menu's branch
// quick-filter.
const STORAGE_KEY = computed(() => `goods:activeWarehouse:${nsSlug.value}`);
const activeWarehouseId = ref<string | null>(null);

function restoreActiveWarehouse() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY.value);
    if (saved) activeWarehouseId.value = saved;
  } catch {}
}
watch(activeWarehouseId, (v) => {
  try {
    if (v) localStorage.setItem(STORAGE_KEY.value, v);
  } catch {}
});

async function loadAll() {
  loading.value = true;
  try {
    const goodsToken = await getToken();
    const [{ warehouses: w }, { goods: g }, { units: u }] = await Promise.all([
      (await import('@/api/goods/warehouse')).goodsListWarehouses(goodsToken, nsSlug.value),
      (await import('@/api/goods/good')).goodsListGoods(goodsToken, nsSlug.value),
      (await import('@/api/goods/unit')).goodsListUnits(goodsToken, nsSlug.value),
    ]);
    warehouses.value = w;
    goods.value = g;
    units.value = u;

    if (!warehouses.value.length) {
      return navigateTo(`/${nsSlug.value}/goods/onboarding`);
    }
    if (!activeWarehouseId.value || !warehouses.value.some((x) => x.id === activeWarehouseId.value)) {
      activeWarehouseId.value = warehouses.value[0].id;
    }
    await loadStock();
  } catch (e) {
    logError('[goods/index] loadAll failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to load warehouse data', color: 'red' });
  } finally {
    loading.value = false;
  }
}

async function loadStock() {
  if (!activeWarehouseId.value) return;
  const goodsToken = await getToken();
  const { goodsListStock } = await import('@/api/goods/stock');
  const { stock: s } = await goodsListStock(goodsToken, nsSlug.value, { warehouseId: activeWarehouseId.value });
  stock.value = s;
}
watch(activeWarehouseId, () => { if (!loading.value) loadStock(); });

const goodById = computed(() => new Map(goods.value.map((g) => [g.id, g])));

// Quick stats -- fills what was otherwise a mostly-empty header area on a
// fresh/small catalog, and gives an at-a-glance read before scanning the
// full table below.
const lowStockCount = computed(() => stock.value.filter((s) => s.available <= 5).length);
const stockedItemsCount = computed(() => stock.value.length);

// Stat tiles double as quick filters (mirrors Menu's order-status cards) --
// clicking "low stock" narrows the table instead of just reporting a number.
const statFilter = ref<'all' | 'inStock' | 'outOfStock' | 'lowStock' | 'reserved'>('all');

const allRows = computed(() => stock.value.map((s) => {
  const good = goodById.value.get(s.goodId);
  return {
    id: s.goodId,
    goodId: s.goodId,
    name: good?.name || t('goods.unknownItem'),
    sku: good?.sku || '',
    quantity: s.quantity,
    reservedQuantity: s.reservedQuantity,
    available: s.available,
    costCents: good?.costPriceCents || 0,
    valueCents: s.quantity * (good?.costPriceCents || 0),
  };
}));
const stockValueCents = computed(() => allRows.value.reduce((sum, r) => sum + Math.max(0, r.valueCents), 0));
const money = (cents: number) => (cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const STOCK_FILTERS = [
  { key: 'all', label: 'goods.stockFilterAll' },
  { key: 'inStock', label: 'goods.stockFilterIn' },
  { key: 'outOfStock', label: 'goods.stockFilterOut' },
  { key: 'lowStock', label: 'goods.lowStock' },
  { key: 'reserved', label: 'goods.stockFilterReserved' },
] as const;
const searchQuery = ref('');
const rows = computed(() => {
  let list = allRows.value;
  if (statFilter.value === 'inStock') list = list.filter((r) => r.quantity > 0);
  else if (statFilter.value === 'outOfStock') list = list.filter((r) => r.quantity <= 0);
  else if (statFilter.value === 'lowStock') list = list.filter((r) => r.available <= 5);
  else if (statFilter.value === 'reserved') list = list.filter((r) => r.reservedQuantity > 0);
  const q = searchQuery.value.trim().toLowerCase();
  if (q) list = list.filter((r) => r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q));
  return list;
});

const columns = computed(() => [
  { key: 'name', label: t('goods.goodName') },
  { key: 'sku', label: t('goods.goodSku') },
  { key: 'quantity', label: t('goods.quantity') },
  { key: 'reservedQuantity', label: t('goods.reserved') },
  { key: 'available', label: t('goods.available') },
  { key: 'costCents', label: t('goods.costPrice') },
  { key: 'valueCents', label: t('goods.stockValue') },
]);

// Ticked rows: their own totals and their own Excel.
const selectedRows = ref<any[]>([]);
const selectedTotals = computed(() => ({
  qty: selectedRows.value.reduce((a, r) => a + r.quantity, 0),
  value: selectedRows.value.reduce((a, r) => a + Math.max(0, r.valueCents), 0),
}));
watch(rows, (list) => { selectedRows.value = selectedRows.value.filter((r) => list.some((x) => x.id === r.id)); });

async function exportStock() {
  const { exportStockToXlsx } = await import('@/utils/exportStock');
  exportStockToXlsx(selectedRows.value.length ? selectedRows.value : rows.value, {
    name: t('goods.goodName'), sku: t('goods.goodSku'), quantity: t('goods.quantity'), reserved: t('goods.reserved'),
    available: t('goods.available'), cost: t('goods.costPrice'), value: t('goods.stockValue'), sheet: t('goods.warehouse'),
  }, 'stock');
}

// --- Edit good (shared GoodFormModal) -- adding a new good lives on the
// Catalog page, not here; the dashboard only edits what's already in stock. ---
const historyGoodId = ref<string | null>(null);
const showHistory = ref(false);
const historyName = computed(() => (historyGoodId.value ? goodById.value.get(historyGoodId.value)?.name || '' : ''));
function openHistory(goodId: string) { historyGoodId.value = goodId; showHistory.value = true; }

const showGoodModal = ref(false);
const savingGood = ref(false);
const editingGood = ref<GoodsGood | null>(null);

function openEditGood(goodId: string) {
  const g = goodById.value.get(goodId);
  if (!g) return;
  editingGood.value = g;
  showGoodModal.value = true;
}

async function submitGoodForm(payload: CreateGoodInput | UpdateGoodInput) {
  if (!('id' in payload)) return; // this page only edits goods already in stock
  savingGood.value = true;
  try {
    const goodsToken = await getToken();
    const { goodsUpdateGood } = await import('@/api/goods/good');
    await goodsUpdateGood(goodsToken, nsSlug.value, payload);
    showGoodModal.value = false;
    await loadAll();
  } catch (e) {
    logError('[goods/index] submitGoodForm failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to save good', color: 'red' });
  } finally {
    savingGood.value = false;
  }
}

onMounted(async () => {
  restoreActiveWarehouse();
  await loadAll();

  if (process.client) {
    const { isCompleted, startTour } = useOnboarding();
    // warehouses.value.length is required too: loadAll() redirects to
    // /onboarding when there's no warehouse yet, but navigateTo() from
    // inside an async function doesn't actually stop this onMounted from
    // continuing to run -- without this guard the tour would still get
    // scheduled and pop up on top of the onboarding wizard a second later.
    if (warehouses.value.length && !goods.value.length && !isCompleted(goodsTour.id)) {
      setTimeout(() => startTour(goodsTour), 1000);
    }
  }
});
</script>

<template>
  <div class="at-scope ct-scope min-h-full md:h-full flex flex-col p-4 pb-safe-or-4 md:min-h-0">
    <div class="flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
      <div>
        <h1 data-tour="goods-warehouse-title" class="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">{{ t('goods.warehouse') }}</h1>
        <p class="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{{ t('goods.warehouseSubtitle') }}</p>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <!-- Current warehouse as pills, not a dropdown -- which one is active
             should be readable at a glance, not hidden behind a click. -->
        <div v-if="warehouses.length > 1" class="flex items-center gap-1.5 flex-wrap">
          <button
            v-for="w in warehouses"
            :key="w.id"
            type="button"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors"
            :class="activeWarehouseId === w.id
              ? 'bg-primary-500 border-primary-500 text-white'
              : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:border-primary-300 dark:hover:border-primary-700 hover:text-primary-600 dark:hover:text-primary-400'"
            @click="activeWarehouseId = w.id"
          >
            <Icon name="lucide:warehouse" class="w-3.5 h-3.5 flex-shrink-0" />
            {{ w.name }}
          </button>
        </div>
        <GoodsRegisterButton />
      </div>
    </div>

    <div class="flex-shrink-0 mt-3">
      <GoodsNavTabs>
        <template #search>
          <UInput v-model="searchQuery" icon="lucide:search" size="sm" class="max-w-xs" :placeholder="t('common.search')" />
        </template>
      </GoodsNavTabs>
    </div>

    <div v-if="!loading" class="grid grid-cols-3 gap-3 flex-shrink-0 mt-3">
      <button type="button" class="text-left rounded-2xl border p-4 transition-colors" :class="statFilter === 'all' ? 'border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-950/40' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'" @click="statFilter = 'all'">
        <div class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tabular-nums truncate">{{ goods.length }}</div>
        <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ t('goods.catalog') }}</div>
      </button>
      <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
        <div class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tabular-nums truncate">{{ money(stockValueCents) }}</div>
        <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ t('goods.stockValue') }} · {{ stockedItemsCount }} {{ t('goods.stockPositions') }}</div>
      </div>
      <button type="button" class="text-left rounded-2xl border p-4 transition-colors" :class="statFilter === 'lowStock' ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'" @click="statFilter = statFilter === 'lowStock' ? 'all' : 'lowStock'">
        <div class="text-xl sm:text-2xl font-bold tabular-nums truncate" :class="lowStockCount ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'">{{ lowStockCount }}</div>
        <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ t('goods.lowStock') }}</div>
      </button>
    </div>

    <div v-if="!loading" class="flex items-center justify-between gap-2 flex-shrink-0 mt-3">
      <div class="flex items-center gap-1.5 overflow-x-auto pb-0.5">
        <button v-for="f in STOCK_FILTERS" :key="f.key" type="button" class="pill-filter whitespace-nowrap" :class="statFilter === f.key ? 'pill-filter--active' : ''" @click="statFilter = f.key">{{ t(f.label) }}</button>
      </div>
      <button type="button" class="at-btn !px-3 !py-1.5 hidden sm:inline-flex flex-shrink-0" :disabled="!rows.length" @click="exportStock">
        <Icon name="lucide:file-spreadsheet" class="w-4 h-4" />{{ t('goods.exportExcel') }}
      </button>
    </div>

    <div v-if="selectedRows.length" class="mt-3 flex flex-wrap items-center gap-2 text-sm flex-shrink-0">
      <span class="at-chip">{{ t('goods.selectedCount') }}: <b class="tabular-nums">{{ selectedRows.length }}</b></span>
      <span class="at-chip">{{ t('goods.quantity') }}: <b class="tabular-nums">{{ selectedTotals.qty }}</b></span>
      <span class="at-chip">{{ t('goods.stockValue') }}: <b class="tabular-nums">{{ money(selectedTotals.value) }}</b></span>
      <button type="button" class="at-btn !px-2 !py-1" @click="selectedRows = []"><Icon name="lucide:x" class="w-4 h-4" /></button>
    </div>

    <div data-tour="goods-stock-table" class="flex-1 min-h-0 mt-3">
      <AppTable v-model:selected="selectedRows" soft :rows="rows" :columns="columns" :loading="loading" empty-icon="lucide:package">
        <template #costCents-data="{ row }"><span class="tabular-nums text-gray-500 dark:text-gray-400">{{ money(row.costCents) }}</span></template>
        <template #valueCents-data="{ row }"><span class="tabular-nums font-medium">{{ money(row.valueCents) }}</span></template>
        <template #name-data="{ row }">
          <button type="button" class="font-medium text-left hover:underline hover:text-primary-600 dark:hover:text-primary-400" @click="openEditGood(row.goodId)">
            {{ row.name }}
          </button>
          <button type="button" class="ml-1.5 align-middle text-gray-400 hover:text-primary-600" :title="t('goods.history')" :aria-label="t('goods.history')" @click="openHistory(row.goodId)"><Icon name="lucide:history" class="h-3.5 w-3.5" /></button>
        </template>
      </AppTable>
    </div>

    <GoodHistoryModal v-model="showHistory" :good-id="historyGoodId" :good-name="historyName" :warehouse-id="activeWarehouseId || undefined" :ns-slug="nsSlug" :get-token="getToken" />
    <GoodFormModal v-model="showGoodModal" :good="editingGood" :units="units" :saving="savingGood" :ns-slug="nsSlug" @submit="submitGoodForm" />
  </div>
</template>
