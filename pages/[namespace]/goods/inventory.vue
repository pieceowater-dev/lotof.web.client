<script lang="ts" setup>
// Inventory counting used to be one-item-at-a-time via a picker modal, with
// no visible list of what still needed counting and no discrepancy shown
// anywhere despite the API already returning it per item. This redesign
// pulls up the count's pre-seeded item list (every good with stock in that
// warehouse -- see StartInventoryCount on the backend) as a bulk-entry grid
// with autosave per row and a live progress/discrepancy view.
import { useI18n } from '@/composables/useI18n';
import { useGoodsAuth } from '@/composables/useGoodsAuth';
import { useNamespace } from '@/composables/useNamespace';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import AppTable from '@/components/ui/AppTable.vue';
import GoodsNavTabs from '@/components/goods/GoodsNavTabs.vue';
import GoodsRegisterButton from '@/components/goods/GoodsRegisterButton.vue';
import type { GoodsInventoryCount, GoodsInventoryCountItem, GoodsInventoryCountStatus } from '@/api/goods/inventorycount';
import type { GoodsWarehouse } from '@/api/goods/warehouse';
import type { GoodsGood } from '@/api/goods/good';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const { titleBySlug } = useNamespace();

useHead(() => ({
  title: titleBySlug(nsSlug.value) ? `${t('goods.inventory')} — ${titleBySlug(nsSlug.value)}` : t('goods.inventory'),
}));

const COUNT_STATUS_LABELS: Record<GoodsInventoryCountStatus, string> = {
  DRAFT: t('goods.countStatusDraft'), IN_PROGRESS: t('goods.countStatusInProgress'), COMPLETED: t('goods.countStatusCompleted'),
};
const COUNT_STATUS_COLORS: Record<GoodsInventoryCountStatus, any> = { DRAFT: 'gray', IN_PROGRESS: 'amber', COMPLETED: 'green' };

const { getToken: getGoodsTokenRaw } = useGoodsAuth();
async function getToken(): Promise<string> {
  return getGoodsTokenRaw(nsSlug.value);
}

const loading = ref(true);
const counts = ref<GoodsInventoryCount[]>([]);
const warehouses = ref<GoodsWarehouse[]>([]);
const goods = ref<GoodsGood[]>([]);
const goodName = (id: string) => goods.value.find((g) => g.id === id)?.name || id;

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
    if (activeCount.value) {
      activeCount.value = counts.value.find((x) => x.id === activeCount.value!.id) || null;
    }
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
  { key: 'progress', label: t('goods.countedQty') },
  { key: 'startedAt', label: t('goods.startCount') },
];
const searchQuery = ref('');
const rows = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  const list = q ? counts.value.filter((c) => (warehouses.value.find((w) => w.id === c.warehouseId)?.name || '').toLowerCase().includes(q)) : counts.value;
  return list.map((c) => ({
    ...c,
    warehouseName: warehouses.value.find((w) => w.id === c.warehouseId)?.name || t('goods.unknownWarehouse'),
    progress: `${c.items.filter((i) => i.countedQty != null).length} / ${c.items.length}`,
  }));
});

const showStart = ref(false);
const startWarehouseId = ref('');
const starting = ref(false);
// Defaults to the first warehouse instead of forcing an empty selection --
// most namespaces only ever have one or two.
watch(showStart, (open) => { if (open) startWarehouseId.value = warehouses.value[0]?.id || ''; });
async function startCount() {
  if (!startWarehouseId.value) return;
  starting.value = true;
  try {
    const token = await getToken();
    const { goodsStartInventoryCount } = await import('@/api/goods/inventorycount');
    const created = await goodsStartInventoryCount(token, nsSlug.value, startWarehouseId.value);
    showStart.value = false;
    startWarehouseId.value = '';
    await loadAll();
    activeCount.value = counts.value.find((x) => x.id === created.id) || created;
    showGrid.value = true;
  } catch (e) {
    logError('[goods/inventory] startCount failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to start inventory count', color: 'red' });
  } finally {
    starting.value = false;
  }
}

// --- Bulk count grid ---
const showGrid = ref(false);
const activeCount = ref<GoodsInventoryCount | null>(null);
const savingItemId = ref<string | null>(null);
const countedInputs = reactive<Record<string, number | undefined>>({});

function openGrid(count: GoodsInventoryCount) {
  activeCount.value = count;
  for (const item of count.items) countedInputs[item.goodId] = item.countedQty ?? undefined;
  showGrid.value = true;
}

function discrepancyFor(item: GoodsInventoryCountItem): number | null {
  const counted = countedInputs[item.goodId];
  if (counted == null) return null;
  return counted - item.expectedQty;
}

async function submitOne(item: GoodsInventoryCountItem) {
  if (!activeCount.value) return;
  const counted = countedInputs[item.goodId];
  if (counted == null) return;
  savingItemId.value = item.goodId;
  try {
    const token = await getToken();
    const { goodsSubmitInventoryCount } = await import('@/api/goods/inventorycount');
    const updated = await goodsSubmitInventoryCount(token, nsSlug.value, activeCount.value.id, item.goodId, counted);
    const idx = activeCount.value.items.findIndex((i) => i.goodId === item.goodId);
    if (idx !== -1) activeCount.value.items[idx] = updated;
    const listIdx = counts.value.findIndex((c) => c.id === activeCount.value!.id);
    if (listIdx !== -1) counts.value[listIdx] = activeCount.value;
  } catch (e) {
    logError('[goods/inventory] submitOne failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to submit count', color: 'red' });
  } finally {
    savingItemId.value = null;
  }
}

const completing = ref(false);
async function completeActive() {
  if (!activeCount.value) return;
  completing.value = true;
  try {
    const token = await getToken();
    const { goodsCompleteInventoryCount } = await import('@/api/goods/inventorycount');
    await goodsCompleteInventoryCount(token, nsSlug.value, activeCount.value.id);
    showGrid.value = false;
    await loadAll();
  } catch (e) {
    logError('[goods/inventory] complete failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to complete inventory count', color: 'red' });
  } finally {
    completing.value = false;
  }
}

onMounted(loadAll);
</script>

<template>
  <div class="h-full flex flex-col p-4 pb-safe-or-4 min-h-0">
    <div class="flex items-center justify-between flex-shrink-0">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">{{ t('goods.inventory') }}</h1>
        <p class="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{{ t('goods.inventorySubtitle') }}</p>
      </div>
      <GoodsRegisterButton />
    </div>

    <div class="flex-shrink-0 mt-3">
      <GoodsNavTabs>
        <template #search>
          <UInput v-model="searchQuery" icon="lucide:search" size="sm" class="max-w-xs" :placeholder="t('common.search')" />
        </template>
        <template #action>
          <UButton color="primary" icon="lucide:plus" @click="showStart = true">{{ t('goods.startCount') }}</UButton>
        </template>
      </GoodsNavTabs>
    </div>

    <div class="flex-1 min-h-0 mt-3">
      <AppTable :rows="rows" :columns="columns" :loading="loading" empty-icon="lucide:clipboard-check" @select="openGrid">
        <template #warehouseName-data="{ row }">
          <button type="button" class="font-medium text-left hover:underline hover:text-primary-600 dark:hover:text-primary-400" @click="openGrid(row)">
            {{ row.warehouseName }}
          </button>
        </template>
        <template #status-data="{ row }">
          <UBadge :color="COUNT_STATUS_COLORS[row.status as GoodsInventoryCountStatus]" variant="soft" size="xs">{{ COUNT_STATUS_LABELS[row.status as GoodsInventoryCountStatus] || row.status }}</UBadge>
        </template>
      </AppTable>
    </div>

    <UModal v-model="showStart">
      <UCard>
        <template #header><h3 class="text-lg font-semibold">{{ t('goods.startCount') }}</h3></template>
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

    <!-- Bulk count grid -->
    <USlideover v-model="showGrid">
      <UCard class="flex flex-col h-full overflow-hidden" :ui="{ body: { base: 'flex-1 overflow-y-auto' } }">
        <template #header>
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-lg font-semibold">{{ warehouses.find((w) => w.id === activeCount?.warehouseId)?.name }}</h3>
              <p v-if="activeCount" class="text-xs text-gray-400 mt-0.5">
                {{ activeCount.items.filter((i) => i.countedQty != null).length }} / {{ activeCount.items.length }} {{ t('goods.countedQty').toLowerCase() }}
              </p>
            </div>
            <UButton color="gray" variant="ghost" icon="lucide:x" size="xs" @click="showGrid = false" />
          </div>
        </template>

        <div v-if="activeCount" class="divide-y divide-gray-100 dark:divide-gray-800">
          <div v-for="item in activeCount.items" :key="item.id" class="py-2.5 flex items-center gap-3">
            <div class="flex-1 min-w-0">
              <div class="font-medium text-gray-900 dark:text-white truncate">{{ goodName(item.goodId) }}</div>
              <div class="text-xs text-gray-400">{{ t('goods.expectedQty') }}: {{ item.expectedQty }}</div>
            </div>
            <UInput
              v-model.number="countedInputs[item.goodId]"
              type="number"
              min="0"
              size="sm"
              class="w-24 flex-shrink-0"
              :disabled="activeCount.status === 'COMPLETED'"
              @blur="submitOne(item)"
              @keyup.enter="submitOne(item)"
            />
            <div class="w-14 flex-shrink-0 text-right text-sm tabular-nums" :class="{
              'text-gray-300 dark:text-gray-700': discrepancyFor(item) == null,
              'text-emerald-600 dark:text-emerald-400': discrepancyFor(item) === 0,
              'text-red-600 dark:text-red-400': !!discrepancyFor(item),
            }">
              <Icon v-if="savingItemId === item.goodId" name="lucide:loader" class="w-3.5 h-3.5 animate-spin inline-block" />
              <template v-else>{{ discrepancyFor(item) == null ? '—' : (discrepancyFor(item)! > 0 ? `+${discrepancyFor(item)}` : discrepancyFor(item)) }}</template>
            </div>
          </div>
        </div>

        <template v-if="activeCount && activeCount.status !== 'COMPLETED'" #footer>
          <div class="flex justify-end">
            <UButton color="primary" :loading="completing" @click="completeActive">{{ t('goods.completeCount') }}</UButton>
          </div>
        </template>
      </UCard>
    </USlideover>
  </div>
</template>
