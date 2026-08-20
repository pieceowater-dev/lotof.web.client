<script lang="ts" setup>
// Replaces purchases.vue + receiving.vue + transfers.vue + writeoffs.vue --
// those four pages were ~175-227 lines each of near-identical "record a
// stock movement" boilerplate (see the redesign plan). This unifies them
// into one list with a type filter and one create flow, and adds the detail
// drill-down none of the four ever had (a document's line items were only
// ever visible during creation -- there was no way to look at them again).
import { useI18n } from '@/composables/useI18n';
import { useGoodsAuth } from '@/composables/useGoodsAuth';
import { useNamespace } from '@/composables/useNamespace';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import AppTable from '@/components/ui/AppTable.vue';
import GoodsNavTabs from '@/components/goods/GoodsNavTabs.vue';
import MovementItemBuilder from '@/components/goods/MovementItemBuilder.vue';
import type { MovementExtraField, MovementDraftItem } from '@/components/goods/MovementItemBuilder.vue';
import type { GoodsPurchaseOrder, GoodsPurchaseOrderStatus } from '@/api/goods/purchaseorder';
import type { GoodsReceipt } from '@/api/goods/goodsreceipt';
import type { GoodsStockTransfer, GoodsStockTransferStatus } from '@/api/goods/stocktransfer';
import type { GoodsWriteOff, GoodsWriteOffReason } from '@/api/goods/writeoff';
import type { GoodsWarehouse } from '@/api/goods/warehouse';
import type { GoodsSupplier } from '@/api/goods/supplier';
import type { GoodsGood } from '@/api/goods/good';
import type { GoodsUnit } from '@/api/goods/unit';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const { titleBySlug } = useNamespace();

useHead(() => ({
  title: titleBySlug(nsSlug.value) ? `${t('goods.movements')} — ${titleBySlug(nsSlug.value)}` : t('goods.movements'),
}));

const { getToken: getGoodsTokenRaw } = useGoodsAuth();
async function getToken(): Promise<string> {
  return getGoodsTokenRaw(nsSlug.value);
}

type MovementKind = 'purchase' | 'receipt' | 'transfer' | 'writeoff';

const loading = ref(true);
const orders = ref<GoodsPurchaseOrder[]>([]);
const receipts = ref<GoodsReceipt[]>([]);
const transfers = ref<GoodsStockTransfer[]>([]);
const writeOffs = ref<GoodsWriteOff[]>([]);
const warehouses = ref<GoodsWarehouse[]>([]);
const suppliers = ref<GoodsSupplier[]>([]);
const goods = ref<GoodsGood[]>([]);
const units = ref<GoodsUnit[]>([]);

const warehouseName = (id: string) => warehouses.value.find((w) => w.id === id)?.name || t('goods.unknownWarehouse');
const supplierName = (id?: string | null) => (id && suppliers.value.find((s) => s.id === id)?.name) || '—';
const goodName = (id: string) => goods.value.find((g) => g.id === id)?.name || t('goods.unknownItem');
const unitSymbol = (id: string) => units.value.find((u) => u.id === id)?.symbol || '';

const REASON_LABELS: Record<GoodsWriteOffReason, string> = { DAMAGE: t('goods.reasonDamage'), EXPIRED: t('goods.reasonExpired'), LOST: t('goods.reasonLost'), OTHER: t('goods.reasonOther') };
const REASON_OPTIONS_LABELED = computed(() => (['DAMAGE', 'EXPIRED', 'LOST', 'OTHER'] as GoodsWriteOffReason[]).map((value) => ({ label: REASON_LABELS[value], value })));

const PO_STATUS_LABELS: Record<GoodsPurchaseOrderStatus, string> = {
  DRAFT: t('goods.poStatusDraft'), SENT: t('goods.poStatusSent'), PARTIALLY_RECEIVED: t('goods.poStatusPartiallyReceived'),
  RECEIVED: t('goods.poStatusReceived'), CANCELLED: t('goods.poStatusCancelled'),
};
const PO_STATUS_COLORS: Record<GoodsPurchaseOrderStatus, string> = {
  DRAFT: 'gray', SENT: 'primary', PARTIALLY_RECEIVED: 'amber', RECEIVED: 'green', CANCELLED: 'red',
};
const TRANSFER_STATUS_LABELS: Record<GoodsStockTransferStatus, string> = {
  DRAFT: t('goods.transferStatusDraft'), IN_TRANSIT: t('goods.transferStatusInTransit'), COMPLETED: t('goods.transferStatusCompleted'), CANCELLED: t('goods.transferStatusCancelled'),
};
const TRANSFER_STATUS_COLORS: Record<GoodsStockTransferStatus, string> = {
  DRAFT: 'gray', IN_TRANSIT: 'primary', COMPLETED: 'green', CANCELLED: 'red',
};

// Purchase orders and transfers use disjoint status enums that happen to
// share some string values (e.g. both have DRAFT/CANCELLED) with different
// meanings -- dispatch on row.kind, not just the raw string, so each is
// labeled/colored from the right map.
function rowStatusLabel(row: { kind: MovementKind; status: string | null }): string {
  if (!row.status) return '';
  if (row.kind === 'purchase') return PO_STATUS_LABELS[row.status as GoodsPurchaseOrderStatus] || row.status;
  if (row.kind === 'transfer') return TRANSFER_STATUS_LABELS[row.status as GoodsStockTransferStatus] || row.status;
  return row.status;
}
function rowStatusColor(row: { kind: MovementKind; status: string | null }): any {
  if (!row.status) return 'gray';
  if (row.kind === 'purchase') return PO_STATUS_COLORS[row.status as GoodsPurchaseOrderStatus] || 'gray';
  if (row.kind === 'transfer') return TRANSFER_STATUS_COLORS[row.status as GoodsStockTransferStatus] || 'gray';
  return 'gray';
}

async function loadAll() {
  loading.value = true;
  try {
    const token = await getToken();
    const [{ purchaseOrders }, { receipts: r }, { transfers: tr }, { writeOffs: wo }, { warehouses: w }, { suppliers: s }, { goods: g }, { units: u }] = await Promise.all([
      (await import('@/api/goods/purchaseorder')).goodsListPurchaseOrders(token, nsSlug.value),
      (await import('@/api/goods/goodsreceipt')).goodsListReceipts(token, nsSlug.value),
      (await import('@/api/goods/stocktransfer')).goodsListStockTransfers(token, nsSlug.value),
      (await import('@/api/goods/writeoff')).goodsListWriteOffs(token, nsSlug.value),
      (await import('@/api/goods/warehouse')).goodsListWarehouses(token, nsSlug.value),
      (await import('@/api/goods/supplier')).goodsListSuppliers(token, nsSlug.value),
      (await import('@/api/goods/good')).goodsListGoods(token, nsSlug.value),
      (await import('@/api/goods/unit')).goodsListUnits(token, nsSlug.value),
    ]);
    orders.value = purchaseOrders;
    receipts.value = r;
    transfers.value = tr;
    writeOffs.value = wo;
    warehouses.value = w;
    suppliers.value = s;
    goods.value = g;
    units.value = u;
  } catch (e) {
    logError('[goods/movements] loadAll failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to load movements', color: 'red' });
  } finally {
    loading.value = false;
  }
}

// --- Unified list ---
const TYPE_TABS: { key: MovementKind | 'all'; labelKey: string; icon: string }[] = [
  { key: 'all', labelKey: 'goods.allTypes', icon: 'lucide:layers' },
  { key: 'purchase', labelKey: 'goods.purchases', icon: 'lucide:shopping-cart' },
  { key: 'receipt', labelKey: 'goods.receiving', icon: 'lucide:package-check' },
  { key: 'transfer', labelKey: 'goods.transfers', icon: 'lucide:arrow-left-right' },
  { key: 'writeoff', labelKey: 'goods.writeoffs', icon: 'lucide:trash-2' },
];
const activeType = ref<MovementKind | 'all'>('all');

type MovementRow = {
  kind: MovementKind;
  id: string;
  number: string;
  summary: string;
  status: string | null;
  date: string;
  itemsCount: number;
};

const allRows = computed<MovementRow[]>(() => {
  const rows: MovementRow[] = [
    ...orders.value.map((o) => ({ kind: 'purchase' as const, id: o.id, number: o.number, summary: supplierName(o.supplierId), status: o.status, date: o.expectedDate || o.createdAt, itemsCount: o.items.length })),
    ...receipts.value.map((r) => ({ kind: 'receipt' as const, id: r.id, number: r.number, summary: supplierName(r.supplierId), status: null, date: r.createdAt, itemsCount: r.items.length })),
    ...transfers.value.map((tr) => ({ kind: 'transfer' as const, id: tr.id, number: tr.number, summary: `${warehouseName(tr.fromWarehouseId)} → ${warehouseName(tr.toWarehouseId)}`, status: tr.status, date: tr.createdAt, itemsCount: tr.items.length })),
    ...writeOffs.value.map((wo) => ({ kind: 'writeoff' as const, id: wo.id, number: wo.number, summary: REASON_LABELS[wo.reason], status: null, date: wo.createdAt, itemsCount: wo.items.length })),
  ];
  return rows.sort((a, b) => (a.date < b.date ? 1 : -1));
});
const searchQuery = ref('');
const rows = computed(() => {
  let list = activeType.value === 'all' ? allRows.value : allRows.value.filter((r) => r.kind === activeType.value);
  const q = searchQuery.value.trim().toLowerCase();
  if (q) list = list.filter((r) => r.number.toLowerCase().includes(q) || r.summary.toLowerCase().includes(q));
  return list;
});

const typeLabel = (kind: MovementKind) => t(TYPE_TABS.find((x) => x.key === kind)!.labelKey);
const typeIcon = (kind: MovementKind) => TYPE_TABS.find((x) => x.key === kind)!.icon;

const columns = [
  { key: 'kind', label: t('goods.type') },
  { key: 'number', label: '#' },
  { key: 'summary', label: t('goods.supplier') },
  { key: 'status', label: t('common.status') },
  { key: 'date', label: t('goods.date') },
];

// --- Detail drill-down ---
const showDetail = ref(false);
const detailRow = ref<MovementRow | null>(null);

const detailDoc = computed(() => {
  if (!detailRow.value) return null;
  switch (detailRow.value.kind) {
    case 'purchase': return orders.value.find((o) => o.id === detailRow.value!.id) || null;
    case 'receipt': return receipts.value.find((r) => r.id === detailRow.value!.id) || null;
    case 'transfer': return transfers.value.find((tr) => tr.id === detailRow.value!.id) || null;
    case 'writeoff': return writeOffs.value.find((wo) => wo.id === detailRow.value!.id) || null;
    default: return null;
  }
});

function openDetail(row: MovementRow) {
  detailRow.value = row;
  showDetail.value = true;
}

const PO_STATUS_OPTIONS = computed(() => (['DRAFT', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'] as GoodsPurchaseOrderStatus[]).map((value) => ({ label: PO_STATUS_LABELS[value], value })));
const busyAction = ref(false);

async function updatePoStatus(status: GoodsPurchaseOrderStatus) {
  if (!detailRow.value) return;
  busyAction.value = true;
  try {
    const token = await getToken();
    const { goodsUpdatePurchaseOrderStatus } = await import('@/api/goods/purchaseorder');
    await goodsUpdatePurchaseOrderStatus(token, nsSlug.value, detailRow.value.id, status);
    await loadAll();
  } catch (e) {
    logError('[goods/movements] updatePoStatus failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to update status', color: 'red' });
  } finally {
    busyAction.value = false;
  }
}

async function transferAction(fn: (token: string, ns: string, id: string) => Promise<unknown>) {
  if (!detailRow.value) return;
  busyAction.value = true;
  try {
    const token = await getToken();
    await fn(token, nsSlug.value, detailRow.value.id);
    await loadAll();
    showDetail.value = false;
  } catch (e) {
    logError('[goods/movements] transferAction failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Action failed', color: 'red' });
  } finally {
    busyAction.value = false;
  }
}
async function sendTransfer() { const { goodsSendStockTransfer } = await import('@/api/goods/stocktransfer'); await transferAction(goodsSendStockTransfer); }
async function receiveTransfer() { const { goodsReceiveStockTransfer } = await import('@/api/goods/stocktransfer'); await transferAction(goodsReceiveStockTransfer); }
async function cancelTransfer() { const { goodsCancelStockTransfer } = await import('@/api/goods/stocktransfer'); await transferAction(goodsCancelStockTransfer); }

// --- Create ---
const showCreate = ref(false);
const saving = ref(false);
const createType = ref<MovementKind>('purchase');
const CREATE_TABS: { key: MovementKind; labelKey: string }[] = [
  { key: 'purchase', labelKey: 'goods.purchases' },
  { key: 'receipt', labelKey: 'goods.receiving' },
  { key: 'transfer', labelKey: 'goods.transfers' },
  { key: 'writeoff', labelKey: 'goods.writeoffs' },
];

const form = reactive({ warehouseId: '', toWarehouseId: '', supplierId: '', expectedDate: '', reason: 'OTHER' as GoodsWriteOffReason });
const draftItems = ref<MovementDraftItem[]>([]);

function resetCreateForm() {
  form.warehouseId = ''; form.toWarehouseId = ''; form.supplierId = ''; form.expectedDate = ''; form.reason = 'OTHER';
  draftItems.value = [];
}
watch(showCreate, (open) => { if (open) resetCreateForm(); });
watch(createType, () => { draftItems.value = []; });

const extraFieldsByType: Record<MovementKind, MovementExtraField[]> = {
  purchase: [{ key: 'priceCents', labelKey: 'goods.price', type: 'number', step: '0.01', min: 0, colSpan: 2 }],
  receipt: [
    { key: 'costPriceCents', labelKey: 'goods.costPrice', type: 'number', step: '0.01', min: 0, colSpan: 4 },
    { key: 'batchNumber', labelKey: 'goods.batchNumber', type: 'text', colSpan: 4 },
    { key: 'expiryDate', labelKey: 'goods.expiryDate', type: 'date', colSpan: 4 },
  ],
  transfer: [],
  writeoff: [],
};

const isFormValid = computed(() => {
  if (!draftItems.value.length) return false;
  switch (createType.value) {
    case 'purchase': return !!form.warehouseId && !!form.supplierId;
    case 'receipt': return !!form.warehouseId;
    case 'transfer': return !!form.warehouseId && !!form.toWarehouseId && form.warehouseId !== form.toWarehouseId;
    case 'writeoff': return !!form.warehouseId;
    default: return false;
  }
});

async function submitCreate() {
  if (!isFormValid.value) return;
  saving.value = true;
  try {
    const token = await getToken();
    switch (createType.value) {
      case 'purchase': {
        const { goodsCreatePurchaseOrder } = await import('@/api/goods/purchaseorder');
        await goodsCreatePurchaseOrder(token, nsSlug.value, {
          warehouseId: form.warehouseId, supplierId: form.supplierId, expectedDate: form.expectedDate || undefined,
          items: draftItems.value.map((i) => ({ goodId: i.goodId, unitId: i.unitId, quantity: i.quantity, priceCents: Math.round(Number(i.priceCents || 0) * 100) })),
        });
        break;
      }
      case 'receipt': {
        const { goodsCreateReceipt } = await import('@/api/goods/goodsreceipt');
        await goodsCreateReceipt(token, nsSlug.value, {
          warehouseId: form.warehouseId, supplierId: form.supplierId || undefined,
          items: draftItems.value.map((i) => ({
            goodId: i.goodId, unitId: i.unitId, quantity: i.quantity, costPriceCents: Math.round(Number(i.costPriceCents || 0) * 100),
            batchNumber: (i.batchNumber as string) || undefined, expiryDate: (i.expiryDate as string) || undefined,
          })),
        });
        break;
      }
      case 'transfer': {
        const { goodsCreateStockTransfer } = await import('@/api/goods/stocktransfer');
        await goodsCreateStockTransfer(token, nsSlug.value, {
          fromWarehouseId: form.warehouseId, toWarehouseId: form.toWarehouseId,
          items: draftItems.value.map((i) => ({ goodId: i.goodId, unitId: i.unitId, quantity: i.quantity })),
        });
        break;
      }
      case 'writeoff': {
        const { goodsCreateWriteOff } = await import('@/api/goods/writeoff');
        await goodsCreateWriteOff(token, nsSlug.value, {
          warehouseId: form.warehouseId, reason: form.reason,
          items: draftItems.value.map((i) => ({ goodId: i.goodId, unitId: i.unitId, quantity: i.quantity })),
        });
        break;
      }
    }
    showCreate.value = false;
    await loadAll();
  } catch (e) {
    logError('[goods/movements] submitCreate failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to save', color: 'red' });
  } finally {
    saving.value = false;
  }
}

onMounted(loadAll);
</script>

<template>
  <div class="h-full flex flex-col p-4 pb-safe-or-4 min-h-0">
    <div class="flex items-center justify-between flex-shrink-0">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">{{ t('goods.movements') }}</h1>
        <p class="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{{ t('goods.movementsSubtitle') }}</p>
      </div>
      <UButton color="primary" icon="lucide:plus" @click="showCreate = true">{{ t('goods.createMovement') }}</UButton>
    </div>

    <div class="flex-shrink-0 mt-3">
      <GoodsNavTabs>
        <template #search>
          <UInput v-model="searchQuery" icon="lucide:search" size="sm" class="max-w-xs" :placeholder="t('common.search')" />
        </template>
      </GoodsNavTabs>
    </div>

    <div class="flex items-center gap-2 overflow-x-auto pb-1 mt-3 flex-shrink-0">
      <button
        v-for="tab in TYPE_TABS"
        :key="tab.key"
        type="button"
        class="px-3 py-1.5 rounded-full text-sm font-medium border transition whitespace-nowrap flex items-center gap-1.5"
        :class="activeType === tab.key
          ? 'bg-primary-100 text-primary-700 border-primary-200 dark:bg-primary-900/40 dark:text-primary-100 dark:border-primary-900/60'
          : 'bg-gray-50 dark:bg-gray-900/60 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300'"
        @click="activeType = tab.key"
      >
        <UIcon :name="tab.icon" class="w-4 h-4" />
        {{ t(tab.labelKey) }}
      </button>
    </div>

    <div class="flex-1 min-h-0 mt-3">
      <AppTable :rows="rows" :columns="columns" :loading="loading" empty-icon="lucide:arrow-left-right" @select="openDetail">
        <template #kind-data="{ row }">
          <div class="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
            <UIcon :name="typeIcon(row.kind)" class="w-4 h-4" />
            <span class="text-xs">{{ typeLabel(row.kind) }}</span>
          </div>
        </template>
        <template #number-data="{ row }">
          <button type="button" class="font-medium text-left hover:underline hover:text-primary-600 dark:hover:text-primary-400" @click="openDetail(row)">
            {{ row.number }}
          </button>
        </template>
        <template #status-data="{ row }">
          <UBadge v-if="row.status" :color="rowStatusColor(row)" variant="soft" size="xs">{{ rowStatusLabel(row) }}</UBadge>
          <span v-else class="text-gray-300 dark:text-gray-700">—</span>
        </template>
      </AppTable>
    </div>

    <!-- Detail drill-down -->
    <USlideover v-model="showDetail">
      <UCard class="flex flex-col h-full overflow-hidden" :ui="{ body: { base: 'flex-1 overflow-y-auto' } }">
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <UIcon v-if="detailRow" :name="typeIcon(detailRow.kind)" class="w-5 h-5 text-gray-400" />
              <h3 class="text-lg font-semibold">{{ detailRow?.number }}</h3>
            </div>
            <UButton color="gray" variant="ghost" icon="lucide:x" size="xs" @click="showDetail = false" />
          </div>
        </template>

        <div v-if="detailRow && detailDoc" class="space-y-4">
          <div class="text-sm text-gray-500 dark:text-gray-400">{{ detailRow.summary }} · {{ detailRow.date }}</div>

          <!-- Purchase order status -->
          <div v-if="detailRow.kind === 'purchase'">
            <label class="text-xs text-gray-400 mb-1 block">{{ t('common.status') }}</label>
            <USelectMenu
              :model-value="(detailDoc as any).status"
              :options="PO_STATUS_OPTIONS"
              value-attribute="value"
              option-attribute="label"
              size="sm"
              class="w-48"
              :popper="{ strategy: 'fixed' }"
              @update:model-value="updatePoStatus"
            />
          </div>

          <!-- Transfer workflow actions -->
          <div v-if="detailRow.kind === 'transfer'" class="flex gap-2">
            <UButton v-if="(detailDoc as any).status === 'DRAFT'" size="sm" color="primary" variant="soft" :loading="busyAction" @click="sendTransfer">{{ t('goods.send') }}</UButton>
            <UButton v-if="(detailDoc as any).status === 'IN_TRANSIT'" size="sm" color="green" variant="soft" :loading="busyAction" @click="receiveTransfer">{{ t('goods.receive') }}</UButton>
            <UButton v-if="['DRAFT', 'IN_TRANSIT'].includes((detailDoc as any).status)" size="sm" color="red" variant="ghost" :loading="busyAction" @click="cancelTransfer">{{ t('goods.cancel') }}</UButton>
          </div>

          <div class="rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
            <div v-for="item in (detailDoc as any).items" :key="item.id" class="px-4 py-2.5 text-sm flex items-center justify-between">
              <div>
                <div class="font-medium text-gray-900 dark:text-white">{{ goodName(item.goodId) }}</div>
                <div class="text-xs text-gray-400">
                  {{ item.quantity }} {{ unitSymbol(item.unitId) }}
                  <template v-if="item.priceCents != null"> · {{ (item.priceCents / 100).toFixed(2) }}</template>
                  <template v-if="item.costPriceCents != null"> · {{ (item.costPriceCents / 100).toFixed(2) }}</template>
                  <template v-if="item.batchNumber"> · {{ item.batchNumber }}</template>
                  <template v-if="item.expiryDate"> · {{ item.expiryDate }}</template>
                </div>
              </div>
            </div>
          </div>
        </div>
      </UCard>
    </USlideover>

    <!-- Create -->
    <UModal v-model="showCreate" :ui="{ width: 'sm:max-w-2xl' }">
      <UCard>
        <template #header><h3 class="text-lg font-semibold">{{ t('goods.createMovement') }}</h3></template>
        <div class="space-y-3">
          <div class="flex gap-2">
            <button
              v-for="tab in CREATE_TABS"
              :key="tab.key"
              type="button"
              class="px-3 py-1.5 rounded-full text-sm font-medium border transition"
              :class="createType === tab.key
                ? 'bg-primary-100 text-primary-700 border-primary-200 dark:bg-primary-900/40 dark:text-primary-100 dark:border-primary-900/60'
                : 'bg-gray-50 dark:bg-gray-900/60 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300'"
              @click="createType = tab.key"
            >
              {{ t(tab.labelKey) }}
            </button>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <UFormGroup :label="createType === 'transfer' ? t('goods.fromWarehouse') : t('goods.selectWarehouse')" required>
              <USelectMenu v-model="form.warehouseId" :options="warehouses.map((w) => ({ label: w.name, value: w.id }))" value-attribute="value" option-attribute="label" :popper="{ strategy: 'fixed' }" />
            </UFormGroup>

            <UFormGroup v-if="createType === 'transfer'" :label="t('goods.toWarehouse')" required>
              <USelectMenu v-model="form.toWarehouseId" :options="warehouses.map((w) => ({ label: w.name, value: w.id }))" value-attribute="value" option-attribute="label" :popper="{ strategy: 'fixed' }" />
            </UFormGroup>

            <UFormGroup v-if="createType === 'purchase'" :label="t('goods.supplier')" required>
              <USelectMenu v-model="form.supplierId" :options="suppliers.map((s) => ({ label: s.name, value: s.id }))" value-attribute="value" option-attribute="label" :popper="{ strategy: 'fixed' }" />
            </UFormGroup>
            <UFormGroup v-if="createType === 'receipt'" :label="t('goods.supplier')">
              <USelectMenu v-model="form.supplierId" :options="suppliers.map((s) => ({ label: s.name, value: s.id }))" value-attribute="value" option-attribute="label" :popper="{ strategy: 'fixed' }" />
            </UFormGroup>

            <UFormGroup v-if="createType === 'purchase'" :label="t('goods.expectedDate')">
              <UInput v-model="form.expectedDate" type="date" />
            </UFormGroup>

            <UFormGroup v-if="createType === 'writeoff'" :label="t('goods.reason')" required>
              <USelectMenu v-model="form.reason" :options="REASON_OPTIONS_LABELED" value-attribute="value" option-attribute="label" :popper="{ strategy: 'fixed' }" />
            </UFormGroup>
          </div>

          <MovementItemBuilder v-model="draftItems" :goods="goods" :units="units" :extra-fields="extraFieldsByType[createType]">
            <template #item-summary="{ item }">
              {{ item.quantity }} {{ unitSymbol(item.unitId as string) }}
              <template v-if="item.priceCents"> · {{ Number(item.priceCents).toFixed(2) }}</template>
              <template v-if="item.costPriceCents"> · {{ Number(item.costPriceCents).toFixed(2) }}</template>
              <template v-if="item.batchNumber"> · {{ item.batchNumber }}</template>
            </template>
          </MovementItemBuilder>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="ghost" @click="showCreate = false">{{ t('common.cancel') }}</UButton>
            <UButton color="primary" :loading="saving" :disabled="!isFormValid || saving" @click="submitCreate">{{ t('common.save') }}</UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>
