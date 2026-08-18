<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useGoodsToken } from '@/composables/useGoodsToken';
import { useNamespace } from '@/composables/useNamespace';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import AppTable from '@/components/ui/AppTable.vue';
import GoodsNavTabs from '@/components/goods/GoodsNavTabs.vue';
import type { GoodsInventoryCount } from '@/api/goods/inventorycount';
import type { GoodsWarehouse } from '@/api/goods/warehouse';
import type { GoodsGood } from '@/api/goods/good';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const { titleBySlug } = useNamespace();

useHead(() => ({
  title: titleBySlug(nsSlug.value) ? `${t('goods.inventory')} — ${titleBySlug(nsSlug.value)}` : t('goods.inventory'),
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
const counts = ref<GoodsInventoryCount[]>([]);
const warehouses = ref<GoodsWarehouse[]>([]);
const goods = ref<GoodsGood[]>([]);

async function loadAll() {
  loading.value = true;
  try {
    const token = await getToken();
    const [{ counts: c }, { warehouses: w }, { goods: g }] = await Promise.all([
      (await import('@/api/goods/inventorycount')).goodsListInventoryCounts(token, nsSlug.value),
      (await import('@/api/goods/warehouse')).goodsListWarehouses(token, nsSlug.value),
      (await import('@/api/goods/good')).goodsListGoods(token, nsSlug.value),
    ]);
    counts.value = c;
    warehouses.value = w;
    goods.value = g;
  } catch (e) {
    logError('[goods/inventory] loadAll failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to load inventory counts', color: 'red' });
  } finally {
    loading.value = false;
  }
}

const columns = [
  { key: 'warehouseName', label: t('goods.selectWarehouse') },
  { key: 'status', label: t('common.status') },
  { key: 'startedAt', label: t('goods.startCount') },
  { key: 'actions', label: '' },
];
const rows = computed(() => counts.value.map((c) => ({ ...c, warehouseName: warehouses.value.find((w) => w.id === c.warehouseId)?.name || c.warehouseId })));

const showStart = ref(false);
const startWarehouseId = ref('');
const starting = ref(false);
async function startCount() {
  if (!startWarehouseId.value) return;
  starting.value = true;
  try {
    const token = await getToken();
    const { goodsStartInventoryCount } = await import('@/api/goods/inventorycount');
    await goodsStartInventoryCount(token, nsSlug.value, startWarehouseId.value);
    showStart.value = false;
    startWarehouseId.value = '';
    await loadAll();
  } catch (e) {
    logError('[goods/inventory] startCount failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to start inventory count', color: 'red' });
  } finally {
    starting.value = false;
  }
}

// --- Submit counted qty modal ---
const showSubmitItem = ref(false);
const activeCount = ref<GoodsInventoryCount | null>(null);
const submitForm = reactive({ goodId: '', countedQty: 0 });
const submitting = ref(false);

function openSubmit(count: GoodsInventoryCount) {
  activeCount.value = count;
  submitForm.goodId = '';
  submitForm.countedQty = 0;
  showSubmitItem.value = true;
}

async function submitItem() {
  if (!activeCount.value || !submitForm.goodId) return;
  submitting.value = true;
  try {
    const token = await getToken();
    const { goodsSubmitInventoryCount } = await import('@/api/goods/inventorycount');
    await goodsSubmitInventoryCount(token, nsSlug.value, activeCount.value.id, submitForm.goodId, submitForm.countedQty);
    showSubmitItem.value = false;
    await loadAll();
  } catch (e) {
    logError('[goods/inventory] submitItem failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to submit count', color: 'red' });
  } finally {
    submitting.value = false;
  }
}

async function complete(id: string) {
  try {
    const token = await getToken();
    const { goodsCompleteInventoryCount } = await import('@/api/goods/inventorycount');
    await goodsCompleteInventoryCount(token, nsSlug.value, id);
    await loadAll();
  } catch (e) {
    logError('[goods/inventory] complete failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to complete inventory count', color: 'red' });
  }
}

onMounted(loadAll);
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 py-6 space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ t('goods.inventory') }}</h1>
      <UButton color="primary" icon="lucide:plus" @click="showStart = true">{{ t('goods.startCount') }}</UButton>
    </div>

    <GoodsNavTabs />

    <div class="min-h-[280px] max-h-[65vh] overflow-hidden">
      <AppTable :rows="rows" :columns="columns" :loading="loading" empty-icon="lucide:clipboard-check">
        <template #actions-data="{ row }">
          <div class="flex gap-1 justify-end" v-if="row.status !== 'COMPLETED'">
            <UButton size="2xs" color="gray" variant="soft" @click="openSubmit(row)">{{ t('goods.submit') }}</UButton>
            <UButton size="2xs" color="primary" variant="soft" @click="complete(row.id)">{{ t('goods.completeCount') }}</UButton>
          </div>
        </template>
      </AppTable>
    </div>

    <UModal v-model="showStart">
      <UCard>
        <template #header><h3 class="font-semibold">{{ t('goods.startCount') }}</h3></template>
        <UFormGroup :label="t('goods.selectWarehouse')" required>
          <USelectMenu v-model="startWarehouseId" :options="warehouses.map((w) => ({ label: w.name, value: w.id }))" value-attribute="value" option-attribute="label" :popper="{ strategy: 'fixed' }" />
        </UFormGroup>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="ghost" @click="showStart = false">{{ t('common.cancel') }}</UButton>
            <UButton color="primary" :loading="starting" :disabled="!startWarehouseId" @click="startCount">{{ t('goods.startCount') }}</UButton>
          </div>
        </template>
      </UCard>
    </UModal>

    <UModal v-model="showSubmitItem">
      <UCard>
        <template #header><h3 class="font-semibold">{{ t('goods.submit') }}</h3></template>
        <div class="space-y-3">
          <UFormGroup :label="t('goods.good')" required>
            <USelectMenu v-model="submitForm.goodId" :options="goods.map((g) => ({ label: g.name, value: g.id }))" value-attribute="value" option-attribute="label" :popper="{ strategy: 'fixed' }" />
          </UFormGroup>
          <UFormGroup :label="t('goods.countedQty')" required>
            <UInput v-model.number="submitForm.countedQty" type="number" min="0" @keyup.enter="submitItem" />
          </UFormGroup>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="ghost" @click="showSubmitItem = false">{{ t('common.cancel') }}</UButton>
            <UButton color="primary" :loading="submitting" :disabled="!submitForm.goodId" @click="submitItem">{{ t('goods.submit') }}</UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>
