<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useGoodsToken } from '@/composables/useGoodsToken';
import { useGoodsStaffRole } from '@/composables/useGoodsStaffRole';
import { useNamespace } from '@/composables/useNamespace';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import AppTable from '@/components/ui/AppTable.vue';
import type { GoodsWarehouse } from '@/api/goods/warehouse';
import type { GoodsGood } from '@/api/goods/good';
import type { GoodsStock } from '@/api/goods/stock';
import type { GoodsUnit } from '@/api/goods/unit';
import { useOnboarding } from '@/composables/useOnboarding';
import { goodsTour } from '@/config/tours';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const { titleBySlug } = useNamespace();
const { isOwnerOrManager, canManageStock } = useGoodsStaffRole();

useHead(() => ({
  title: titleBySlug(nsSlug.value) ? `${t('app.goods')} — ${titleBySlug(nsSlug.value)}` : t('app.goods'),
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
const warehouses = ref<GoodsWarehouse[]>([]);
const goods = ref<GoodsGood[]>([]);
const stock = ref<GoodsStock[]>([]);
const units = ref<GoodsUnit[]>([]);

// Global warehouse filter (plan §7) -- persisted per namespace so the
// choice survives a reload/navigation, same pattern as Menu's branch
// quick-filter.
const STORAGE_KEY = computed(() => `goods:activeWarehouse:${nsSlug.value}`);
const activeWarehouseId = ref<string | null>(null);
// USelectMenu's v-model type doesn't accept null -- only rendered once
// warehouses.length is truthy, by which point activeWarehouseId is always set.
const activeWarehouseIdModel = computed<string>({
  get: () => activeWarehouseId.value || '',
  set: (v) => { activeWarehouseId.value = v; },
});

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

const rows = computed(() => stock.value.map((s) => {
  const good = goodById.value.get(s.goodId);
  return {
    goodId: s.goodId,
    name: good?.name || s.goodId,
    sku: good?.sku || '',
    quantity: s.quantity,
    reservedQuantity: s.reservedQuantity,
    available: s.available,
  };
}));

const columns = [
  { key: 'name', label: t('goods.goodName') },
  { key: 'sku', label: t('goods.goodSku') },
  { key: 'quantity', label: t('goods.quantity') },
  { key: 'reservedQuantity', label: t('goods.reserved') },
  { key: 'available', label: t('goods.available') },
];

// --- Add good (quick form) ---
const showAddGood = ref(false);
const savingGood = ref(false);
const goodForm = reactive({ name: '', sku: '', salePriceCents: 0, unitId: '' });
const isGoodFormValid = computed(() => goodForm.name.trim().length > 0 && !!goodForm.unitId);

async function submitAddGood() {
  if (!isGoodFormValid.value) return;
  savingGood.value = true;
  try {
    const goodsToken = await getToken();
    const { goodsCreateGood } = await import('@/api/goods/good');
    await goodsCreateGood(goodsToken, nsSlug.value, {
      name: goodForm.name.trim(),
      sku: goodForm.sku.trim() || goodForm.name.trim().toUpperCase().replace(/\s+/g, '-').slice(0, 32),
      baseUnitId: goodForm.unitId,
      costPriceCents: 0,
      salePriceCents: Math.round(goodForm.salePriceCents * 100),
      trackStock: true,
      isWeighted: false,
      imageUrl: '',
    });
    showAddGood.value = false;
    goodForm.name = '';
    goodForm.sku = '';
    goodForm.salePriceCents = 0;
    await loadAll();
  } catch (e) {
    logError('[goods/index] submitAddGood failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to add good', color: 'red' });
  } finally {
    savingGood.value = false;
  }
}

onMounted(async () => {
  restoreActiveWarehouse();
  await loadAll();

  if (process.client) {
    const { isCompleted, startTour } = useOnboarding();
    if (!goods.value.length && !isCompleted(goodsTour.id)) {
      setTimeout(() => startTour(goodsTour), 1000);
    }
  }
});
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 py-6 space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 data-tour="goods-warehouse-title" class="text-xl font-bold text-gray-900 dark:text-white">{{ t('goods.warehouse') }}</h1>
      <div class="flex items-center gap-2 flex-wrap">
        <USelectMenu
          v-if="warehouses.length"
          v-model="activeWarehouseIdModel"
          :options="warehouses.map((w) => ({ label: w.name, value: w.id }))"
          value-attribute="value"
          option-attribute="label"
          size="sm"
          class="w-48"
          :popper="{ strategy: 'fixed' }"
        />
        <UButton data-tour="goods-register-btn" color="primary" icon="lucide:store" :to="`/${nsSlug}/goods/register`">
          {{ t('goods.register') }}
        </UButton>
        <UButton v-if="isOwnerOrManager" data-tour="goods-settings-btn" color="gray" variant="soft" icon="lucide:settings" :to="`/${nsSlug}/goods/settings`">
          {{ t('goods.settings') }}
        </UButton>
      </div>
    </div>

    <div v-if="canManageStock" class="flex justify-end">
      <UButton color="gray" variant="soft" icon="lucide:plus" @click="showAddGood = true">
        {{ t('goods.addGood') }}
      </UButton>
    </div>

    <div data-tour="goods-stock-table" class="h-[60vh]">
      <AppTable :rows="rows" :columns="columns" :loading="loading" empty-icon="lucide:package" />
    </div>

    <UModal v-model="showAddGood">
      <UCard>
        <template #header>
          <h3 class="font-semibold">{{ t('goods.addGood') }}</h3>
        </template>
        <div class="space-y-3">
          <UFormGroup :label="t('goods.goodName')" required>
            <UInput v-model="goodForm.name" size="lg" @keyup.enter="submitAddGood" />
          </UFormGroup>
          <UFormGroup :label="t('goods.goodSku')">
            <UInput v-model="goodForm.sku" size="lg" placeholder="SKU-001" @keyup.enter="submitAddGood" />
          </UFormGroup>
          <UFormGroup :label="t('goods.salePrice')">
            <UInput v-model.number="goodForm.salePriceCents" type="number" min="0" step="0.01" size="lg" @keyup.enter="submitAddGood" />
          </UFormGroup>
          <UFormGroup label="Unit" required>
            <USelectMenu
              v-model="goodForm.unitId"
              :options="units.map((u) => ({ label: `${u.name} (${u.symbol})`, value: u.id }))"
              value-attribute="value"
              option-attribute="label"
              size="lg"
              :popper="{ strategy: 'fixed' }"
            />
          </UFormGroup>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="ghost" @click="showAddGood = false">{{ t('common.cancel') }}</UButton>
            <UButton color="primary" :loading="savingGood" :disabled="!isGoodFormValid || savingGood" @click="submitAddGood">{{ t('common.save') }}</UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>
