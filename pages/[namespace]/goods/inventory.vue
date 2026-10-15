<script lang="ts" setup>
import { formatDateTime } from '@/utils/formatDate';
import { atModalUi, atCardUiFit } from '@/utils/atraceUi';
definePageMeta({ layout: 'workspace' });

// Inventory counting used to be one-item-at-a-time via a picker modal, with
// no visible list of what still needed counting and no discrepancy shown
// anywhere despite the API already returning it per item. This redesign
// pulls up the count's pre-seeded item list (every good with stock in that
// warehouse -- see StartInventoryCount on the backend) as a bulk-entry grid
// with autosave per row and a live progress/discrepancy view.
import { useI18n } from '@/composables/useI18n';
import { printHtmlDocument } from '@/utils/printWindow';
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
import { usePageTitle } from '@/composables/usePageTitle';

const { t, locale } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const { titleBySlug } = useNamespace();

usePageTitle('goods', { section: 'inventory' });

const COUNT_STATUS_LABELS = computed<Record<GoodsInventoryCountStatus, string>>(() => ({
  DRAFT: t('goods.countStatusDraft'), IN_PROGRESS: t('goods.countStatusInProgress'), COMPLETED: t('goods.countStatusCompleted'),
}));
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

const columns = computed(() => [
  { key: 'warehouseName', label: t('goods.selectWarehouse') },
  { key: 'status', label: t('common.status') },
  { key: 'progress', label: t('goods.countedQty') },
  { key: 'startedAt', label: t('goods.startCount') },
]);
const searchQuery = ref('');
const rows = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  const list = q ? counts.value.filter((c) => (warehouses.value.find((w) => w.id === c.warehouseId)?.name || '').toLowerCase().includes(q)) : counts.value;
  return list.map((c) => ({
    ...c,
    warehouseName: warehouses.value.find((w) => w.id === c.warehouseId)?.name || t('goods.unknownWarehouse'),
    progress: `${c.items.filter((i) => i.countedQty != null).length} / ${c.items.length}`,
    startedAt: formatDateTime(c.startedAt, locale.value),
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

// Barcode entry: a scan (or typed code + Enter) adds one to that good's counted quantity.
const scanCode = ref('');
async function scanSubmit() {
  const code = scanCode.value.trim();
  if (!code || !activeCount.value) return;
  scanCode.value = '';
  try {
    const token = await getToken();
    const { goodsFindByBarcode } = await import('@/api/goods/good');
    const found = await goodsFindByBarcode(token, nsSlug.value, code);
    const goodId = found?.good?.id;
    if (!goodId) {
      useToast().add({ title: t('goods.scanUnknown'), color: 'amber' });
      return;
    }
    const item = activeCount.value.items.find((i) => i.goodId === goodId);
    if (!item) {
      // Not on the sheet: an "unaccounted" find -- it joins the count with what the books say (usually 0).
      const added = await (await import('@/api/goods/inventorycount')).goodsSubmitInventoryCount(token, nsSlug.value, activeCount.value.id, goodId, 1);
      activeCount.value.items.push(added);
      countedInputs[goodId] = 1;
      useToast().add({ title: t('goods.scanUnaccounted', { name: goodName(goodId) }), color: 'primary' });
      return;
    }
    countedInputs[goodId] = (countedInputs[goodId] ?? 0) + 1;
    await submitOne(item);
  } catch (e) {
    logError('[goods/inventory] scan failed', e);
    useToast().add({ title: getErrorMessage(e, t) || t('goods.scanNotInCount'), color: 'amber' });
  }
}

// Printable count sheet: name, article, expected, an empty box for the counted quantity.
function printSheet() {
  const c = activeCount.value;
  if (!c) return;
  const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const rows = c.items.map((i, n) => `<tr><td>${n + 1}</td><td>${esc(goodName(i.goodId))}</td><td>${esc(goods.value.find((g) => g.id === i.goodId)?.sku || '')}</td><td style="text-align:right">${esc(i.expectedQty)}</td><td style="width:90px"></td></tr>`).join('');
  const wh = warehouses.value.find((w) => w.id === c.warehouseId)?.name || '';
  printHtmlDocument(`${t('goods.countSheet')} ${wh}`, `<h2>${esc(t('goods.countSheet'))} · ${esc(wh)}</h2><p>${esc(new Date().toLocaleDateString())}</p>
    <table style="width:100%;border-collapse:collapse" border="1" cellpadding="6"><thead><tr><th>#</th><th>${esc(t('goods.good'))}</th><th>${esc(t('goods.goodSku'))}</th><th>${esc(t('goods.expectedQty'))}</th><th>${esc(t('goods.countedQty'))}</th></tr></thead><tbody>${rows}</tbody></table>
    <p style="margin-top:40px">${esc(t('goods.signatureGave'))}: ____________</p>`);
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
  <div class="at-scope ct-scope min-h-full md:h-full flex flex-col p-4 pb-safe-or-4 md:min-h-0">
    <div class="flex items-center justify-between gap-3 flex-shrink-0">
      <div class="min-w-0">
        <h1 class="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">{{ t('goods.inventory') }}</h1>
        <p class="hidden sm:block text-sm text-gray-600 dark:text-gray-400 mt-0.5">{{ t('goods.inventorySubtitle') }}</p>
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
      <AppTable soft :rows="rows" :columns="columns" :loading="loading" empty-icon="lucide:clipboard-check" @select="openGrid">
        <template #warehouseName-data="{ row }">
          <button type="button" class="font-medium text-left hover:underline hover:text-primary-600 dark:hover:text-primary-400" @click="openGrid(row)">
            {{ row.warehouseName }}
          </button>
        </template>
        <template #status-data="{ row }">
          <UBadge :color="COUNT_STATUS_COLORS[row.status as GoodsInventoryCountStatus]" variant="soft" size="xs">{{ COUNT_STATUS_LABELS[row.status as GoodsInventoryCountStatus] || row.status }}</UBadge>
        </template>
        <template #mobile-card="{ row }">
          <div class="flex items-center justify-between gap-2">
            <span class="min-w-0 truncate font-medium text-gray-900 dark:text-white">{{ row.warehouseName }}</span>
            <UBadge :color="COUNT_STATUS_COLORS[row.status as GoodsInventoryCountStatus]" variant="soft" size="xs">{{ COUNT_STATUS_LABELS[row.status as GoodsInventoryCountStatus] || row.status }}</UBadge>
          </div>
          <div class="mt-1 flex items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span class="tabular-nums">{{ t('goods.countedQty') }}: {{ row.progress }}</span>
            <span class="whitespace-nowrap">{{ row.startedAt }}</span>
          </div>
        </template>
      </AppTable>
    </div>

    <UModal class="at-modal" :ui="atModalUi" v-model="showStart">
      <UCard :ui="atCardUiFit">
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
    <USlideover class="at-modal" v-model="showGrid">
      <UCard class="flex flex-col h-full overflow-hidden" :ui="{ body: { base: 'flex-1 overflow-y-auto' } }">
        <template #header>
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-lg font-semibold">{{ warehouses.find((w) => w.id === activeCount?.warehouseId)?.name }}</h3>
              <p v-if="activeCount" class="text-xs text-gray-400 mt-0.5">
                {{ activeCount.items.filter((i) => i.countedQty != null).length }} / {{ activeCount.items.length }} {{ t('goods.countedQty').toLowerCase() }}
              </p>
            </div>
            <div class="flex items-center gap-1">
              <UButton color="gray" variant="ghost" icon="lucide:printer" size="xs" :title="t('goods.countSheet')" @click="printSheet" />
              <UButton color="gray" variant="ghost" icon="lucide:x" size="xs" @click="showGrid = false" />
            </div>
          </div>
          <UInput v-if="activeCount && activeCount.status !== 'COMPLETED'" v-model="scanCode" class="mt-3" icon="lucide:scan-barcode" :placeholder="t('goods.scanBarcode')" @keyup.enter="scanSubmit" />
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
