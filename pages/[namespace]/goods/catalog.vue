<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useGoodsToken } from '@/composables/useGoodsToken';
import { useNamespace } from '@/composables/useNamespace';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import AppTable from '@/components/ui/AppTable.vue';
import type { GoodsGood } from '@/api/goods/good';
import type { GoodsCategory } from '@/api/goods/category';
import type { GoodsUnit } from '@/api/goods/unit';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const { titleBySlug } = useNamespace();

useHead(() => ({
  title: titleBySlug(nsSlug.value) ? `${t('goods.catalog')} — ${titleBySlug(nsSlug.value)}` : t('goods.catalog'),
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

const activeTab = ref<'goods' | 'categories' | 'units'>('goods');
const loading = ref(true);
const goods = ref<GoodsGood[]>([]);
const categories = ref<GoodsCategory[]>([]);
const units = ref<GoodsUnit[]>([]);

async function loadAll() {
  loading.value = true;
  try {
    const token = await getToken();
    const [{ goods: g }, { categories: c }, { units: u }] = await Promise.all([
      (await import('@/api/goods/good')).goodsListGoods(token, nsSlug.value),
      (await import('@/api/goods/category')).goodsListCategories(token, nsSlug.value),
      (await import('@/api/goods/unit')).goodsListUnits(token, nsSlug.value),
    ]);
    goods.value = g;
    categories.value = c;
    units.value = u;
  } catch (e) {
    logError('[goods/catalog] loadAll failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to load catalog', color: 'red' });
  } finally {
    loading.value = false;
  }
}

const goodColumns = [
  { key: 'name', label: t('goods.goodName') },
  { key: 'sku', label: t('goods.goodSku') },
  { key: 'salePriceCents', label: t('goods.salePrice') },
  { key: 'isActive', label: t('common.status') },
];
const goodRows = computed(() => goods.value.map((g) => ({ ...g, salePriceCents: (g.salePriceCents / 100).toFixed(2) })));

const categoryColumns = [
  { key: 'name', label: t('goods.goodName') },
  { key: 'sortOrder', label: '#' },
];

const unitColumns = [
  { key: 'name', label: t('goods.goodName') },
  { key: 'symbol', label: 'Symbol' },
];

// --- Add good ---
const showAddGood = ref(false);
const savingGood = ref(false);
const goodForm = reactive({ name: '', sku: '', salePriceCents: 0, unitId: '', categoryId: '' });
const isGoodFormValid = computed(() => goodForm.name.trim().length > 0 && !!goodForm.unitId);

async function submitAddGood() {
  if (!isGoodFormValid.value) return;
  savingGood.value = true;
  try {
    const token = await getToken();
    const { goodsCreateGood } = await import('@/api/goods/good');
    await goodsCreateGood(token, nsSlug.value, {
      name: goodForm.name.trim(),
      sku: goodForm.sku.trim() || goodForm.name.trim().toUpperCase().replace(/\s+/g, '-').slice(0, 32),
      baseUnitId: goodForm.unitId,
      categoryId: goodForm.categoryId || undefined,
      costPriceCents: 0,
      salePriceCents: Math.round(goodForm.salePriceCents * 100),
      trackStock: true,
      isWeighted: false,
      imageUrl: '',
    });
    showAddGood.value = false;
    goodForm.name = ''; goodForm.sku = ''; goodForm.salePriceCents = 0; goodForm.categoryId = '';
    await loadAll();
  } catch (e) {
    logError('[goods/catalog] submitAddGood failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to add good', color: 'red' });
  } finally {
    savingGood.value = false;
  }
}

// --- Add category ---
const showAddCategory = ref(false);
const savingCategory = ref(false);
const categoryForm = reactive({ name: '' });

async function submitAddCategory() {
  if (!categoryForm.name.trim()) return;
  savingCategory.value = true;
  try {
    const token = await getToken();
    const { goodsCreateCategory } = await import('@/api/goods/category');
    await goodsCreateCategory(token, nsSlug.value, { name: categoryForm.name.trim(), sortOrder: categories.value.length });
    showAddCategory.value = false;
    categoryForm.name = '';
    await loadAll();
  } catch (e) {
    logError('[goods/catalog] submitAddCategory failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to add category', color: 'red' });
  } finally {
    savingCategory.value = false;
  }
}

// --- Add unit ---
const showAddUnit = ref(false);
const savingUnit = ref(false);
const unitForm = reactive({ name: '', symbol: '' });

async function submitAddUnit() {
  if (!unitForm.name.trim() || !unitForm.symbol.trim()) return;
  savingUnit.value = true;
  try {
    const token = await getToken();
    const { goodsClient } = await import('@/api/clients');
    const { getDeviceHeaders } = await import('@/utils/device');
    const { goodsRequestWithRefresh } = await import('@/api/goods/goodsRequestWithRefresh');
    const devHeaders = await getDeviceHeaders();
    const CreateUnitDocument = /* GraphQL */ `
      mutation CreateUnit($input: CreateUnitInput!) { createUnit(input: $input) { id name symbol isActive } }
    `;
    await goodsRequestWithRefresh(async () => goodsClient.request(
      CreateUnitDocument,
      { input: { name: unitForm.name.trim(), symbol: unitForm.symbol.trim() } },
      { headers: { GoodsAuthorization: `Bearer ${token}`, Namespace: nsSlug.value, ...devHeaders } }
    ), nsSlug.value);
    showAddUnit.value = false;
    unitForm.name = ''; unitForm.symbol = '';
    await loadAll();
  } catch (e) {
    logError('[goods/catalog] submitAddUnit failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to add unit', color: 'red' });
  } finally {
    savingUnit.value = false;
  }
}

onMounted(loadAll);
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 py-6 space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ t('goods.catalog') }}</h1>
      <UButton color="gray" variant="soft" icon="lucide:arrow-left" :to="`/${nsSlug}/goods`">{{ t('goods.warehouse') }}</UButton>
    </div>

    <div class="flex gap-2 border-b border-gray-200 dark:border-gray-800">
      <button
        v-for="tab in (['goods', 'categories', 'units'] as const)"
        :key="tab"
        type="button"
        class="px-3 py-2 text-sm font-medium border-b-2 -mb-px"
        :class="activeTab === tab ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-500 dark:text-gray-400'"
        @click="activeTab = tab"
      >
        {{ tab === 'goods' ? t('goods.catalog') : tab === 'categories' ? t('goods.categories') : t('goods.units') }}
      </button>
    </div>

    <div v-if="activeTab === 'goods'" class="space-y-3">
      <div class="flex justify-end">
        <UButton color="gray" variant="soft" icon="lucide:plus" @click="showAddGood = true">{{ t('goods.addGood') }}</UButton>
      </div>
      <div class="h-[55vh]">
        <AppTable :rows="goodRows" :columns="goodColumns" :loading="loading" empty-icon="lucide:package" />
      </div>
    </div>

    <div v-else-if="activeTab === 'categories'" class="space-y-3">
      <div class="flex justify-end">
        <UButton color="gray" variant="soft" icon="lucide:plus" @click="showAddCategory = true">{{ t('goods.addCategory') }}</UButton>
      </div>
      <div class="h-[55vh]">
        <AppTable :rows="categories" :columns="categoryColumns" :loading="loading" empty-icon="lucide:tag" />
      </div>
    </div>

    <div v-else class="space-y-3">
      <div class="flex justify-end">
        <UButton color="gray" variant="soft" icon="lucide:plus" @click="showAddUnit = true">{{ t('goods.addUnit') }}</UButton>
      </div>
      <div class="h-[55vh]">
        <AppTable :rows="units" :columns="unitColumns" :loading="loading" empty-icon="lucide:ruler" />
      </div>
    </div>

    <UModal v-model="showAddGood">
      <UCard>
        <template #header><h3 class="font-semibold">{{ t('goods.addGood') }}</h3></template>
        <div class="space-y-3">
          <UFormGroup :label="t('goods.goodName')" required><UInput v-model="goodForm.name" size="lg" @keyup.enter="submitAddGood" /></UFormGroup>
          <UFormGroup :label="t('goods.goodSku')"><UInput v-model="goodForm.sku" size="lg" placeholder="SKU-001" @keyup.enter="submitAddGood" /></UFormGroup>
          <UFormGroup :label="t('goods.salePrice')"><UInput v-model.number="goodForm.salePriceCents" type="number" min="0" step="0.01" size="lg" @keyup.enter="submitAddGood" /></UFormGroup>
          <UFormGroup label="Unit" required>
            <USelectMenu v-model="goodForm.unitId" :options="units.map((u) => ({ label: `${u.name} (${u.symbol})`, value: u.id }))" value-attribute="value" option-attribute="label" size="lg" :popper="{ strategy: 'fixed' }" />
          </UFormGroup>
          <UFormGroup :label="t('goods.categories')">
            <USelectMenu v-model="goodForm.categoryId" :options="categories.map((c) => ({ label: c.name, value: c.id }))" value-attribute="value" option-attribute="label" size="lg" :popper="{ strategy: 'fixed' }" />
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

    <UModal v-model="showAddCategory">
      <UCard>
        <template #header><h3 class="font-semibold">{{ t('goods.addCategory') }}</h3></template>
        <UFormGroup :label="t('goods.goodName')" required><UInput v-model="categoryForm.name" size="lg" @keyup.enter="submitAddCategory" /></UFormGroup>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="ghost" @click="showAddCategory = false">{{ t('common.cancel') }}</UButton>
            <UButton color="primary" :loading="savingCategory" @click="submitAddCategory">{{ t('common.save') }}</UButton>
          </div>
        </template>
      </UCard>
    </UModal>

    <UModal v-model="showAddUnit">
      <UCard>
        <template #header><h3 class="font-semibold">{{ t('goods.addUnit') }}</h3></template>
        <div class="space-y-3">
          <UFormGroup :label="t('goods.goodName')" required><UInput v-model="unitForm.name" size="lg" @keyup.enter="submitAddUnit" /></UFormGroup>
          <UFormGroup label="Symbol" required><UInput v-model="unitForm.symbol" size="lg" placeholder="kg" @keyup.enter="submitAddUnit" /></UFormGroup>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="ghost" @click="showAddUnit = false">{{ t('common.cancel') }}</UButton>
            <UButton color="primary" :loading="savingUnit" @click="submitAddUnit">{{ t('common.save') }}</UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>
