<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useGoodsToken } from '@/composables/useGoodsToken';
import { useNamespace } from '@/composables/useNamespace';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import AppTable from '@/components/ui/AppTable.vue';
import type { GoodsReceipt } from '@/api/goods/goodsreceipt';
import type { GoodsWarehouse } from '@/api/goods/warehouse';
import type { GoodsSupplier } from '@/api/goods/supplier';
import type { GoodsGood } from '@/api/goods/good';
import type { GoodsUnit } from '@/api/goods/unit';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const { titleBySlug } = useNamespace();

useHead(() => ({
  title: titleBySlug(nsSlug.value) ? `${t('goods.receiving')} — ${titleBySlug(nsSlug.value)}` : t('goods.receiving'),
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
const receipts = ref<GoodsReceipt[]>([]);
const warehouses = ref<GoodsWarehouse[]>([]);
const suppliers = ref<GoodsSupplier[]>([]);
const goods = ref<GoodsGood[]>([]);
const units = ref<GoodsUnit[]>([]);

const goodName = (id: string) => goods.value.find((g) => g.id === id)?.name || id;

async function loadAll() {
  loading.value = true;
  try {
    const token = await getToken();
    const [{ receipts: r }, { warehouses: w }, { suppliers: s }, { goods: g }, { units: u }] = await Promise.all([
      (await import('@/api/goods/goodsreceipt')).goodsListReceipts(token, nsSlug.value),
      (await import('@/api/goods/warehouse')).goodsListWarehouses(token, nsSlug.value),
      (await import('@/api/goods/supplier')).goodsListSuppliers(token, nsSlug.value),
      (await import('@/api/goods/good')).goodsListGoods(token, nsSlug.value),
      (await import('@/api/goods/unit')).goodsListUnits(token, nsSlug.value),
    ]);
    receipts.value = r;
    warehouses.value = w;
    suppliers.value = s;
    goods.value = g;
    units.value = u;
  } catch (e) {
    logError('[goods/receiving] loadAll failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to load receipts', color: 'red' });
  } finally {
    loading.value = false;
  }
}

const rows = computed(() => receipts.value.map((r) => ({
  ...r,
  supplierName: suppliers.value.find((s) => s.id === r.supplierId)?.name || '—',
  itemsCount: r.items.length,
})));

const columns = [
  { key: 'number', label: '#' },
  { key: 'supplierName', label: t('goods.supplier') },
  { key: 'itemsCount', label: t('goods.stock') },
  { key: 'createdAt', label: t('common.title') },
];

// --- Create ---
const showCreate = ref(false);
const saving = ref(false);
const form = reactive({ warehouseId: '', supplierId: '' });
type DraftItem = { goodId: string; unitId: string; quantity: number; costPriceCents: number; batchNumber: string; expiryDate: string };
const draftItems = ref<DraftItem[]>([]);
const itemDraft = reactive<DraftItem>({ goodId: '', unitId: '', quantity: 1, costPriceCents: 0, batchNumber: '', expiryDate: '' });

function addDraftItem() {
  if (!itemDraft.goodId || !itemDraft.unitId) return;
  draftItems.value.push({ ...itemDraft });
  itemDraft.goodId = ''; itemDraft.unitId = ''; itemDraft.quantity = 1; itemDraft.costPriceCents = 0;
  itemDraft.batchNumber = ''; itemDraft.expiryDate = '';
}
function removeDraftItem(idx: number) {
  draftItems.value.splice(idx, 1);
}

const isFormValid = computed(() => !!form.warehouseId && draftItems.value.length > 0);

async function submitCreate() {
  if (!isFormValid.value) return;
  saving.value = true;
  try {
    const token = await getToken();
    const { goodsCreateReceipt } = await import('@/api/goods/goodsreceipt');
    await goodsCreateReceipt(token, nsSlug.value, {
      warehouseId: form.warehouseId,
      supplierId: form.supplierId || undefined,
      items: draftItems.value.map((i) => ({
        goodId: i.goodId, unitId: i.unitId, quantity: i.quantity, costPriceCents: Math.round(i.costPriceCents * 100),
        batchNumber: i.batchNumber || undefined, expiryDate: i.expiryDate || undefined,
      })),
    });
    showCreate.value = false;
    form.warehouseId = ''; form.supplierId = '';
    draftItems.value = [];
    await loadAll();
  } catch (e) {
    logError('[goods/receiving] submitCreate failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to record receipt', color: 'red' });
  } finally {
    saving.value = false;
  }
}

onMounted(loadAll);
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 py-6 space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ t('goods.receiving') }}</h1>
      <div class="flex gap-2">
        <UButton color="gray" variant="soft" icon="lucide:arrow-left" :to="`/${nsSlug}/goods`">{{ t('goods.warehouse') }}</UButton>
        <UButton color="primary" icon="lucide:plus" @click="showCreate = true">{{ t('goods.createReceipt') }}</UButton>
      </div>
    </div>

    <div class="h-[65vh]">
      <AppTable :rows="rows" :columns="columns" :loading="loading" empty-icon="lucide:truck" />
    </div>

    <UModal v-model="showCreate" :ui="{ width: 'sm:max-w-3xl' }">
      <UCard>
        <template #header><h3 class="font-semibold">{{ t('goods.createReceipt') }}</h3></template>
        <div class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <UFormGroup :label="t('goods.selectWarehouse')" required>
              <USelectMenu v-model="form.warehouseId" :options="warehouses.map((w) => ({ label: w.name, value: w.id }))" value-attribute="value" option-attribute="label" :popper="{ strategy: 'fixed' }" />
            </UFormGroup>
            <UFormGroup :label="t('goods.supplier')">
              <USelectMenu v-model="form.supplierId" :options="suppliers.map((s) => ({ label: s.name, value: s.id }))" value-attribute="value" option-attribute="label" :popper="{ strategy: 'fixed' }" />
            </UFormGroup>
          </div>

          <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-3 space-y-2">
            <div class="grid grid-cols-6 gap-2 items-end">
              <USelectMenu v-model="itemDraft.goodId" :options="goods.map((g) => ({ label: g.name, value: g.id }))" value-attribute="value" option-attribute="label" size="sm" placeholder="Good" :popper="{ strategy: 'fixed' }" class="col-span-2" />
              <USelectMenu v-model="itemDraft.unitId" :options="units.map((u) => ({ label: u.symbol, value: u.id }))" value-attribute="value" option-attribute="label" size="sm" placeholder="Unit" :popper="{ strategy: 'fixed' }" />
              <UInput v-model.number="itemDraft.quantity" type="number" min="0" size="sm" placeholder="Qty" />
              <UInput v-model.number="itemDraft.costPriceCents" type="number" min="0" step="0.01" size="sm" placeholder="Cost" />
              <UInput v-model="itemDraft.expiryDate" type="date" size="sm" />
            </div>
            <UInput v-model="itemDraft.batchNumber" size="sm" :placeholder="t('goods.batchNumber')" class="max-w-xs" />
            <UButton size="xs" color="gray" variant="soft" icon="lucide:plus" @click="addDraftItem">{{ t('common.add') }}</UButton>

            <div v-if="draftItems.length" class="divide-y divide-gray-100 dark:divide-gray-800 mt-2">
              <div v-for="(item, idx) in draftItems" :key="idx" class="flex items-center justify-between text-sm py-1.5">
                <span>{{ goodName(item.goodId) }} — {{ item.quantity }} × {{ item.costPriceCents.toFixed(2) }}<span v-if="item.batchNumber"> ({{ item.batchNumber }})</span></span>
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
