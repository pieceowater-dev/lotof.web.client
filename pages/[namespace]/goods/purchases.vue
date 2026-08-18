<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useGoodsToken } from '@/composables/useGoodsToken';
import { useNamespace } from '@/composables/useNamespace';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import AppTable from '@/components/ui/AppTable.vue';
import type { GoodsPurchaseOrder, GoodsPurchaseOrderStatus } from '@/api/goods/purchaseorder';
import type { GoodsWarehouse } from '@/api/goods/warehouse';
import type { GoodsSupplier } from '@/api/goods/supplier';
import type { GoodsGood } from '@/api/goods/good';
import type { GoodsUnit } from '@/api/goods/unit';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const { titleBySlug } = useNamespace();

useHead(() => ({
  title: titleBySlug(nsSlug.value) ? `${t('goods.purchases')} — ${titleBySlug(nsSlug.value)}` : t('goods.purchases'),
}));

async function getToken(): Promise<string> {
  const { ensure, current } = useGoodsToken();
  const existing = current();
  if (existing) return existing;
  const { token: hubToken } = useAuth();
  if (!hubToken.value) throw new Error('No hub token');
  const token = await ensure(nsSlug.value, hubToken.value);
  if (!token) throw new Error('No goods token');
  return token;
}

const loading = ref(true);
const orders = ref<GoodsPurchaseOrder[]>([]);
const warehouses = ref<GoodsWarehouse[]>([]);
const suppliers = ref<GoodsSupplier[]>([]);
const goods = ref<GoodsGood[]>([]);
const units = ref<GoodsUnit[]>([]);

const supplierName = (id: string) => suppliers.value.find((s) => s.id === id)?.name || id;
const goodName = (id: string) => goods.value.find((g) => g.id === id)?.name || id;

async function loadAll() {
  loading.value = true;
  try {
    const token = await getToken();
    const [{ purchaseOrders }, { warehouses: w }, { suppliers: s }, { goods: g }, { units: u }] = await Promise.all([
      (await import('@/api/goods/purchaseorder')).goodsListPurchaseOrders(token, nsSlug.value),
      (await import('@/api/goods/warehouse')).goodsListWarehouses(token, nsSlug.value),
      (await import('@/api/goods/supplier')).goodsListSuppliers(token, nsSlug.value),
      (await import('@/api/goods/good')).goodsListGoods(token, nsSlug.value),
      (await import('@/api/goods/unit')).goodsListUnits(token, nsSlug.value),
    ]);
    orders.value = purchaseOrders;
    warehouses.value = w;
    suppliers.value = s;
    goods.value = g;
    units.value = u;
  } catch (e) {
    logError('[goods/purchases] loadAll failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to load purchase orders', color: 'red' });
  } finally {
    loading.value = false;
  }
}

const rows = computed(() => orders.value.map((o) => ({
  ...o,
  supplierName: supplierName(o.supplierId),
  totalCents: (o.items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0) / 100).toFixed(2),
})));

const columns = [
  { key: 'number', label: '#' },
  { key: 'supplierName', label: t('goods.supplier') },
  { key: 'status', label: t('common.status') },
  { key: 'expectedDate', label: t('goods.expectedDate') },
  { key: 'totalCents', label: t('goods.total') },
];

const STATUS_OPTIONS: GoodsPurchaseOrderStatus[] = ['DRAFT', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'];

async function updateStatus(order: GoodsPurchaseOrder, status: GoodsPurchaseOrderStatus) {
  try {
    const token = await getToken();
    const { goodsUpdatePurchaseOrderStatus } = await import('@/api/goods/purchaseorder');
    await goodsUpdatePurchaseOrderStatus(token, nsSlug.value, order.id, status);
    await loadAll();
  } catch (e) {
    logError('[goods/purchases] updateStatus failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to update status', color: 'red' });
  }
}

// --- Create ---
const showCreate = ref(false);
const saving = ref(false);
const form = reactive({ warehouseId: '', supplierId: '', expectedDate: '' });
type DraftItem = { goodId: string; unitId: string; quantity: number; priceCents: number };
const draftItems = ref<DraftItem[]>([]);
const itemDraft = reactive<DraftItem>({ goodId: '', unitId: '', quantity: 1, priceCents: 0 });

function addDraftItem() {
  if (!itemDraft.goodId || !itemDraft.unitId) return;
  draftItems.value.push({ ...itemDraft });
  itemDraft.goodId = ''; itemDraft.unitId = ''; itemDraft.quantity = 1; itemDraft.priceCents = 0;
}
function removeDraftItem(idx: number) {
  draftItems.value.splice(idx, 1);
}

const isFormValid = computed(() => !!form.warehouseId && !!form.supplierId && draftItems.value.length > 0);

async function submitCreate() {
  if (!isFormValid.value) return;
  saving.value = true;
  try {
    const token = await getToken();
    const { goodsCreatePurchaseOrder } = await import('@/api/goods/purchaseorder');
    await goodsCreatePurchaseOrder(token, nsSlug.value, {
      warehouseId: form.warehouseId,
      supplierId: form.supplierId,
      expectedDate: form.expectedDate || undefined,
      items: draftItems.value.map((i) => ({ ...i, priceCents: Math.round(i.priceCents * 100) })),
    });
    showCreate.value = false;
    form.warehouseId = ''; form.supplierId = ''; form.expectedDate = '';
    draftItems.value = [];
    await loadAll();
  } catch (e) {
    logError('[goods/purchases] submitCreate failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to create purchase order', color: 'red' });
  } finally {
    saving.value = false;
  }
}

onMounted(loadAll);
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 py-6 space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ t('goods.purchases') }}</h1>
      <div class="flex gap-2">
        <UButton color="gray" variant="soft" icon="lucide:arrow-left" :to="`/${nsSlug}/goods`">{{ t('goods.warehouse') }}</UButton>
        <UButton color="primary" icon="lucide:plus" @click="showCreate = true">{{ t('goods.createPurchaseOrder') }}</UButton>
      </div>
    </div>

    <div class="h-[65vh]">
      <AppTable :rows="rows" :columns="columns" :loading="loading" empty-icon="lucide:clipboard-list">
        <template #status-data="{ row }">
          <USelectMenu
            :model-value="row.status"
            :options="STATUS_OPTIONS"
            size="xs"
            class="w-40"
            :popper="{ strategy: 'fixed' }"
            @update:model-value="(v: any) => updateStatus(row, v)"
          />
        </template>
      </AppTable>
    </div>

    <UModal v-model="showCreate" :ui="{ width: 'sm:max-w-2xl' }">
      <UCard>
        <template #header><h3 class="font-semibold">{{ t('goods.createPurchaseOrder') }}</h3></template>
        <div class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <UFormGroup :label="t('goods.selectWarehouse')" required>
              <USelectMenu v-model="form.warehouseId" :options="warehouses.map((w) => ({ label: w.name, value: w.id }))" value-attribute="value" option-attribute="label" :popper="{ strategy: 'fixed' }" />
            </UFormGroup>
            <UFormGroup :label="t('goods.supplier')" required>
              <USelectMenu v-model="form.supplierId" :options="suppliers.map((s) => ({ label: s.name, value: s.id }))" value-attribute="value" option-attribute="label" :popper="{ strategy: 'fixed' }" />
            </UFormGroup>
          </div>
          <UFormGroup :label="t('goods.expectedDate')">
            <UInput v-model="form.expectedDate" type="date" />
          </UFormGroup>

          <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-3 space-y-2">
            <div class="grid grid-cols-5 gap-2 items-end">
              <USelectMenu v-model="itemDraft.goodId" :options="goods.map((g) => ({ label: g.name, value: g.id }))" value-attribute="value" option-attribute="label" size="sm" placeholder="Good" :popper="{ strategy: 'fixed' }" class="col-span-2" />
              <USelectMenu v-model="itemDraft.unitId" :options="units.map((u) => ({ label: u.symbol, value: u.id }))" value-attribute="value" option-attribute="label" size="sm" placeholder="Unit" :popper="{ strategy: 'fixed' }" />
              <UInput v-model.number="itemDraft.quantity" type="number" min="0" size="sm" placeholder="Qty" />
              <UInput v-model.number="itemDraft.priceCents" type="number" min="0" step="0.01" size="sm" placeholder="Price" />
            </div>
            <UButton size="xs" color="gray" variant="soft" icon="lucide:plus" @click="addDraftItem">{{ t('common.add') }}</UButton>

            <div v-if="draftItems.length" class="divide-y divide-gray-100 dark:divide-gray-800 mt-2">
              <div v-for="(item, idx) in draftItems" :key="idx" class="flex items-center justify-between text-sm py-1.5">
                <span>{{ goodName(item.goodId) }} — {{ item.quantity }} × {{ item.priceCents.toFixed(2) }}</span>
                <UButton size="2xs" color="red" variant="ghost" icon="lucide:x" @click="removeDraftItem(idx)" />
              </div>
            </div>
          </div>
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
