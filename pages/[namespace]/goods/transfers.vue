<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useGoodsToken } from '@/composables/useGoodsToken';
import { useNamespace } from '@/composables/useNamespace';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import AppTable from '@/components/ui/AppTable.vue';
import type { GoodsStockTransfer } from '@/api/goods/stocktransfer';
import type { GoodsWarehouse } from '@/api/goods/warehouse';
import type { GoodsGood } from '@/api/goods/good';
import type { GoodsUnit } from '@/api/goods/unit';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const { titleBySlug } = useNamespace();

useHead(() => ({
  title: titleBySlug(nsSlug.value) ? `${t('goods.transfers')} — ${titleBySlug(nsSlug.value)}` : t('goods.transfers'),
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
const transfers = ref<GoodsStockTransfer[]>([]);
const warehouses = ref<GoodsWarehouse[]>([]);
const goods = ref<GoodsGood[]>([]);
const units = ref<GoodsUnit[]>([]);

const warehouseName = (id: string) => warehouses.value.find((w) => w.id === id)?.name || id;
const goodName = (id: string) => goods.value.find((g) => g.id === id)?.name || id;

async function loadAll() {
  loading.value = true;
  try {
    const token = await getToken();
    const [{ transfers: tr }, { warehouses: w }, { goods: g }, { units: u }] = await Promise.all([
      (await import('@/api/goods/stocktransfer')).goodsListStockTransfers(token, nsSlug.value),
      (await import('@/api/goods/warehouse')).goodsListWarehouses(token, nsSlug.value),
      (await import('@/api/goods/good')).goodsListGoods(token, nsSlug.value),
      (await import('@/api/goods/unit')).goodsListUnits(token, nsSlug.value),
    ]);
    transfers.value = tr;
    warehouses.value = w;
    goods.value = g;
    units.value = u;
  } catch (e) {
    logError('[goods/transfers] loadAll failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to load transfers', color: 'red' });
  } finally {
    loading.value = false;
  }
}

const rows = computed(() => transfers.value.map((tr) => ({
  ...tr,
  fromName: warehouseName(tr.fromWarehouseId),
  toName: warehouseName(tr.toWarehouseId),
})));

const columns = [
  { key: 'number', label: '#' },
  { key: 'fromName', label: t('goods.fromWarehouse') },
  { key: 'toName', label: t('goods.toWarehouse') },
  { key: 'status', label: t('common.status') },
  { key: 'actions', label: '' },
];

async function act(fn: (token: string, ns: string, id: string) => Promise<unknown>, id: string) {
  try {
    const token = await getToken();
    await fn(token, nsSlug.value, id);
    await loadAll();
  } catch (e) {
    logError('[goods/transfers] action failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Action failed', color: 'red' });
  }
}
async function send(id: string) { const { goodsSendStockTransfer } = await import('@/api/goods/stocktransfer'); await act(goodsSendStockTransfer, id); }
async function receiveTransfer(id: string) { const { goodsReceiveStockTransfer } = await import('@/api/goods/stocktransfer'); await act(goodsReceiveStockTransfer, id); }
async function cancelTransfer(id: string) { const { goodsCancelStockTransfer } = await import('@/api/goods/stocktransfer'); await act(goodsCancelStockTransfer, id); }

// --- Create ---
const showCreate = ref(false);
const saving = ref(false);
const form = reactive({ fromWarehouseId: '', toWarehouseId: '' });
type DraftItem = { goodId: string; unitId: string; quantity: number };
const draftItems = ref<DraftItem[]>([]);
const itemDraft = reactive<DraftItem>({ goodId: '', unitId: '', quantity: 1 });

function addDraftItem() {
  if (!itemDraft.goodId || !itemDraft.unitId) return;
  draftItems.value.push({ ...itemDraft });
  itemDraft.goodId = ''; itemDraft.unitId = ''; itemDraft.quantity = 1;
}
function removeDraftItem(idx: number) { draftItems.value.splice(idx, 1); }

const isFormValid = computed(() => !!form.fromWarehouseId && !!form.toWarehouseId && form.fromWarehouseId !== form.toWarehouseId && draftItems.value.length > 0);

async function submitCreate() {
  if (!isFormValid.value) return;
  saving.value = true;
  try {
    const token = await getToken();
    const { goodsCreateStockTransfer } = await import('@/api/goods/stocktransfer');
    await goodsCreateStockTransfer(token, nsSlug.value, { ...form, items: draftItems.value });
    showCreate.value = false;
    form.fromWarehouseId = ''; form.toWarehouseId = '';
    draftItems.value = [];
    await loadAll();
  } catch (e) {
    logError('[goods/transfers] submitCreate failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to create transfer', color: 'red' });
  } finally {
    saving.value = false;
  }
}

onMounted(loadAll);
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 py-6 space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ t('goods.transfers') }}</h1>
      <div class="flex gap-2">
        <UButton color="gray" variant="soft" icon="lucide:arrow-left" :to="`/${nsSlug}/goods`">{{ t('goods.warehouse') }}</UButton>
        <UButton color="primary" icon="lucide:plus" @click="showCreate = true">{{ t('goods.createTransfer') }}</UButton>
      </div>
    </div>

    <div class="h-[65vh]">
      <AppTable :rows="rows" :columns="columns" :loading="loading" empty-icon="lucide:arrow-left-right">
        <template #actions-data="{ row }">
          <div class="flex gap-1 justify-end">
            <UButton v-if="row.status === 'DRAFT'" size="2xs" color="primary" variant="soft" @click="send(row.id)">{{ t('goods.send') }}</UButton>
            <UButton v-if="row.status === 'IN_TRANSIT'" size="2xs" color="green" variant="soft" @click="receiveTransfer(row.id)">{{ t('goods.receive') }}</UButton>
            <UButton v-if="row.status === 'DRAFT' || row.status === 'IN_TRANSIT'" size="2xs" color="red" variant="ghost" @click="cancelTransfer(row.id)">{{ t('goods.cancel') }}</UButton>
          </div>
        </template>
      </AppTable>
    </div>

    <UModal v-model="showCreate" :ui="{ width: 'sm:max-w-2xl' }">
      <UCard>
        <template #header><h3 class="font-semibold">{{ t('goods.createTransfer') }}</h3></template>
        <div class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <UFormGroup :label="t('goods.fromWarehouse')" required>
              <USelectMenu v-model="form.fromWarehouseId" :options="warehouses.map((w) => ({ label: w.name, value: w.id }))" value-attribute="value" option-attribute="label" :popper="{ strategy: 'fixed' }" />
            </UFormGroup>
            <UFormGroup :label="t('goods.toWarehouse')" required>
              <USelectMenu v-model="form.toWarehouseId" :options="warehouses.map((w) => ({ label: w.name, value: w.id }))" value-attribute="value" option-attribute="label" :popper="{ strategy: 'fixed' }" />
            </UFormGroup>
          </div>

          <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-3 space-y-2">
            <div class="grid grid-cols-4 gap-2 items-end">
              <USelectMenu v-model="itemDraft.goodId" :options="goods.map((g) => ({ label: g.name, value: g.id }))" value-attribute="value" option-attribute="label" size="sm" placeholder="Good" :popper="{ strategy: 'fixed' }" class="col-span-2" />
              <USelectMenu v-model="itemDraft.unitId" :options="units.map((u) => ({ label: u.symbol, value: u.id }))" value-attribute="value" option-attribute="label" size="sm" placeholder="Unit" :popper="{ strategy: 'fixed' }" />
              <UInput v-model.number="itemDraft.quantity" type="number" min="0" size="sm" placeholder="Qty" />
            </div>
            <UButton size="xs" color="gray" variant="soft" icon="lucide:plus" @click="addDraftItem">{{ t('common.add') }}</UButton>

            <div v-if="draftItems.length" class="divide-y divide-gray-100 dark:divide-gray-800 mt-2">
              <div v-for="(item, idx) in draftItems" :key="idx" class="flex items-center justify-between text-sm py-1.5">
                <span>{{ goodName(item.goodId) }} — {{ item.quantity }}</span>
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
