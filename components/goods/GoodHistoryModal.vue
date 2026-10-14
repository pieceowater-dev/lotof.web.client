<script lang="ts" setup>
import { atModalUi, atCardUiFit } from '@/utils/atraceUi';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import type { GoodsStockMovement } from '@/api/goods/stock';
import { formatDateTime } from '@/utils/formatDate';

// The history of one good: what moved, by how much, the balance before and
// after, and which document it came from.
const props = defineProps<{
  modelValue: boolean;
  goodId: string | null;
  goodName: string;
  warehouseId?: string;
  nsSlug: string;
  getToken: () => Promise<string>;
}>();
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>();
const { t, locale } = useI18n();

const rows = ref<GoodsStockMovement[]>([]);
// Tabs of the good's card: all movements, the orders that used it, and who supplied it at what price.
const tab = ref<'moves' | 'orders' | 'suppliers'>('moves');
const orderRows = computed(() => rows.value.filter((m) => m.type === 'ORDER_CONSUMPTION' || m.type === 'ORDER_RETURN'));
type SupplierPrice = { supplierId: string; name: string; lastCostCents: number; lastAt: string; qty: number };
const supplierPrices = ref<SupplierPrice[]>([]);
const suppliersLoaded = ref(false);
async function loadSuppliers() {
  if (suppliersLoaded.value || !props.goodId) return;
  try {
    const token = await props.getToken();
    const [{ goodsListReceipts }, { goodsListSuppliers }] = await Promise.all([import('@/api/goods/goodsreceipt'), import('@/api/goods/supplier')]);
    const [rc, su] = await Promise.all([goodsListReceipts(token, props.nsSlug), goodsListSuppliers(token, props.nsSlug)]);
    const names = new Map(su.suppliers.map((x) => [x.id, x.name]));
    const by = new Map<string, SupplierPrice>();
    for (const r of rc.receipts.filter((x) => !x.cancelledAt).sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
      for (const it of r.items.filter((i) => i.goodId === props.goodId)) {
        const id = r.supplierId || '';
        const cur = by.get(id) || { supplierId: id, name: id ? names.get(id) || '—' : t('goods.noSupplier'), lastCostCents: 0, lastAt: '', qty: 0 };
        cur.lastCostCents = it.costPriceCents || 0; cur.lastAt = r.createdAt; cur.qty += it.quantity;
        by.set(id, cur);
      }
    }
    supplierPrices.value = [...by.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt));
    suppliersLoaded.value = true;
  } catch (e) {
    logError('[goods/history] suppliers load failed', e);
  }
}
watch(tab, (v) => { if (v === 'suppliers') void loadSuppliers(); });
const loading = ref(false);

watch(() => [props.modelValue, props.goodId], async ([open, id]) => {
  if (!open || !id) return;
  loading.value = true;
  rows.value = [];
  tab.value = 'moves';
  suppliersLoaded.value = false;
  try {
    const { goodsListMovements } = await import('@/api/goods/stock');
    rows.value = (await goodsListMovements(await props.getToken(), props.nsSlug, { goodId: id as string, warehouseId: props.warehouseId })).movements;
  } catch (e) {
    logError('[goods/history] load failed', e);
    useToast().add({ title: getErrorMessage(e, t) || t('common.error'), color: 'red' });
  } finally {
    loading.value = false;
  }
});

const TYPE_KEYS: Record<string, string> = {
  RECEIPT: 'goods.mvReceipt', SALE: 'goods.mvSale', RETURN: 'goods.mvReturn', WRITE_OFF: 'goods.mvWriteOff',
  TRANSFER_OUT: 'goods.mvTransferOut', TRANSFER_IN: 'goods.mvTransferIn', ADJUSTMENT: 'goods.mvAdjustment',
  ORDER_CONSUMPTION: 'goods.mvOrderConsumption', ORDER_RETURN: 'goods.mvOrderReturn', SUPPLIER_RETURN: 'goods.mvSupplierReturn',
};
const typeLabel = (type: string) => (TYPE_KEYS[type] ? t(TYPE_KEYS[type]) : type);
const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
const when = (iso: string) => formatDateTime(iso, locale.value);
</script>

<template>
  <UModal class="at-modal" :ui="{ ...atModalUi, width: 'sm:max-w-2xl' }" :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)">
    <UCard :ui="atCardUiFit">
      <template #header>
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0">
            <h3 class="truncate text-lg font-semibold">{{ goodName }}</h3>
            <p class="at-hint !mt-0">{{ t('goods.historyHint') }}</p>
          </div>
          <button type="button" class="at-btn !px-2.5 !py-1.5" :aria-label="t('common.close')" @click="emit('update:modelValue', false)"><Icon name="lucide:x" class="h-4 w-4" /></button>
        </div>
      </template>
      <div class="mb-3 flex flex-wrap gap-1.5">
        <button v-for="k in [{ v: 'moves', l: 'goods.tabMoves' }, { v: 'orders', l: 'goods.tabOrders' }, { v: 'suppliers', l: 'goods.tabSuppliers' }]" :key="k.v" type="button" class="pill-filter" :class="tab === k.v ? 'pill-filter--active' : ''" @click="tab = k.v as typeof tab">{{ t(k.l) }}</button>
      </div>
      <AppSkeleton v-if="loading" variant="list" :rows="5" />
      <div v-else-if="tab === 'suppliers'" class="max-h-[60vh] divide-y divide-gray-100 overflow-y-auto rounded-xl border border-gray-200 text-sm dark:divide-gray-800 dark:border-gray-800">
        <div v-for="x in supplierPrices" :key="x.supplierId || 'none'" class="flex items-center justify-between gap-3 px-3 py-2.5">
          <div class="min-w-0">
            <div class="truncate font-medium">{{ x.name }}</div>
            <div class="text-xs text-gray-400">{{ when(x.lastAt) }} · {{ t('goods.quantity') }}: {{ x.qty }}</div>
          </div>
          <div class="flex-shrink-0 text-right tabular-nums font-semibold">{{ (x.lastCostCents / 100).toFixed(2) }}</div>
        </div>
        <div v-if="suppliersLoaded && !supplierPrices.length" class="py-8 text-center text-sm text-gray-500">{{ t('goods.historyEmpty') }}</div>
      </div>
      <div v-else-if="!(tab === 'orders' ? orderRows : rows).length" class="py-8 text-center text-sm text-gray-500">{{ t('goods.historyEmpty') }}</div>
      <div v-else class="max-h-[60vh] divide-y divide-gray-100 overflow-y-auto rounded-xl border border-gray-200 text-sm dark:divide-gray-800 dark:border-gray-800">
        <div v-for="m in (tab === 'orders' ? orderRows : rows)" :key="m.id" class="flex items-center justify-between gap-3 px-3 py-2.5">
          <div class="min-w-0">
            <div class="font-medium">{{ typeLabel(m.type) }}</div>
            <div class="truncate text-xs text-gray-400">{{ when(m.createdAt) }}<span v-if="m.reason"> · {{ m.reason }}</span></div>
          </div>
          <div class="flex-shrink-0 text-right tabular-nums">
            <div class="font-semibold" :class="m.quantityDelta > 0 ? 'text-emerald-600' : 'text-rose-600'">{{ signed(m.quantityDelta) }}</div>
            <div class="text-xs text-gray-400">{{ m.beforeQty }} → {{ m.afterQty }}</div>
          </div>
        </div>
      </div>
    </UCard>
  </UModal>
</template>
