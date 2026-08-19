<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useGoodsAuth } from '@/composables/useGoodsAuth';
import { useNamespace } from '@/composables/useNamespace';
import { useConfirm } from '@/composables/useConfirm';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import AppTable from '@/components/ui/AppTable.vue';
import GoodsNavTabs from '@/components/goods/GoodsNavTabs.vue';
import GoodFormModal from '@/components/goods/GoodFormModal.vue';
import type { GoodsGood, CreateGoodInput, UpdateGoodInput } from '@/api/goods/good';
import type { GoodsCategory } from '@/api/goods/category';
import type { GoodsUnit } from '@/api/goods/unit';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const { titleBySlug } = useNamespace();
const { confirm } = useConfirm();

useHead(() => ({
  title: titleBySlug(nsSlug.value) ? `${t('goods.catalog')} — ${titleBySlug(nsSlug.value)}` : t('goods.catalog'),
}));

const { getToken: getGoodsTokenRaw } = useGoodsAuth();
async function getToken(): Promise<string> {
  return getGoodsTokenRaw(nsSlug.value);
}

const TABS = [
  { key: 'goods', labelKey: 'goods.catalog' },
  { key: 'categories', labelKey: 'goods.categories' },
  { key: 'units', labelKey: 'goods.units' },
] as const;
const activeTab = ref<(typeof TABS)[number]['key']>('goods');

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
  { key: 'actions', label: '' },
];
const goodRows = computed(() => goods.value.map((g) => ({ ...g, salePriceCents: (g.salePriceCents / 100).toFixed(2) })));
const goodById = computed(() => new Map(goods.value.map((g) => [g.id, g])));

const categoryColumns = [
  { key: 'name', label: t('goods.goodName') },
  { key: 'sortOrder', label: '#' },
  { key: 'actions', label: '' },
];

const unitColumns = [
  { key: 'name', label: t('goods.goodName') },
  { key: 'symbol', label: t('goods.unitSymbol') },
  { key: 'actions', label: '' },
];

// --- Good create/edit (shared GoodFormModal) ---
const showGoodModal = ref(false);
const savingGood = ref(false);
const editingGood = ref<GoodsGood | null>(null);
const deletingGoodId = ref<string | null>(null);

function openAddGood() {
  editingGood.value = null;
  showGoodModal.value = true;
}
function openEditGood(g: GoodsGood) {
  editingGood.value = g;
  showGoodModal.value = true;
}

async function submitGoodForm(payload: CreateGoodInput | UpdateGoodInput) {
  savingGood.value = true;
  try {
    const token = await getToken();
    if ('id' in payload) {
      const { goodsUpdateGood } = await import('@/api/goods/good');
      await goodsUpdateGood(token, nsSlug.value, payload);
    } else {
      const { goodsCreateGood } = await import('@/api/goods/good');
      await goodsCreateGood(token, nsSlug.value, payload);
    }
    showGoodModal.value = false;
    await loadAll();
  } catch (e) {
    logError('[goods/catalog] submitGoodForm failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to save good', color: 'red' });
  } finally {
    savingGood.value = false;
  }
}

async function deleteGood(g: GoodsGood) {
  if (!(await confirm({ message: `${t('common.confirmDelete')} "${g.name}"` }))) return;
  deletingGoodId.value = g.id;
  try {
    const token = await getToken();
    const { goodsDeleteGood } = await import('@/api/goods/good');
    await goodsDeleteGood(token, nsSlug.value, g.id);
    await loadAll();
  } catch (e) {
    logError('[goods/catalog] deleteGood failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to delete good', color: 'red' });
  } finally {
    deletingGoodId.value = null;
  }
}

// --- Category create/edit/delete ---
const showCategoryModal = ref(false);
const savingCategory = ref(false);
const editingCategory = ref<GoodsCategory | null>(null);
const categoryForm = reactive({ name: '' });

function openAddCategory() {
  editingCategory.value = null;
  categoryForm.name = '';
  showCategoryModal.value = true;
}
function openEditCategory(c: GoodsCategory) {
  editingCategory.value = c;
  categoryForm.name = c.name;
  showCategoryModal.value = true;
}

async function submitCategoryForm() {
  if (!categoryForm.name.trim()) return;
  savingCategory.value = true;
  try {
    const token = await getToken();
    if (editingCategory.value) {
      const { goodsUpdateCategory } = await import('@/api/goods/category');
      await goodsUpdateCategory(token, nsSlug.value, {
        id: editingCategory.value.id,
        name: categoryForm.name.trim(),
        sortOrder: editingCategory.value.sortOrder,
        isActive: editingCategory.value.isActive,
      });
    } else {
      const { goodsCreateCategory } = await import('@/api/goods/category');
      await goodsCreateCategory(token, nsSlug.value, { name: categoryForm.name.trim(), sortOrder: categories.value.length });
    }
    showCategoryModal.value = false;
    await loadAll();
  } catch (e) {
    logError('[goods/catalog] submitCategoryForm failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to save category', color: 'red' });
  } finally {
    savingCategory.value = false;
  }
}

async function deleteCategory(c: GoodsCategory) {
  if (!(await confirm({ message: `${t('common.confirmDelete')} "${c.name}"` }))) return;
  try {
    const token = await getToken();
    const { goodsDeleteCategory } = await import('@/api/goods/category');
    await goodsDeleteCategory(token, nsSlug.value, c.id);
    await loadAll();
  } catch (e) {
    logError('[goods/catalog] deleteCategory failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to delete category', color: 'red' });
  }
}

// --- Unit create/edit/delete ---
const showUnitModal = ref(false);
const savingUnit = ref(false);
const editingUnit = ref<GoodsUnit | null>(null);
const unitForm = reactive({ name: '', symbol: '' });

function openAddUnit() {
  editingUnit.value = null;
  unitForm.name = '';
  unitForm.symbol = '';
  showUnitModal.value = true;
}
function openEditUnit(u: GoodsUnit) {
  editingUnit.value = u;
  unitForm.name = u.name;
  unitForm.symbol = u.symbol;
  showUnitModal.value = true;
}

async function submitUnitForm() {
  if (!unitForm.name.trim() || !unitForm.symbol.trim()) return;
  savingUnit.value = true;
  try {
    const token = await getToken();
    if (editingUnit.value) {
      const { goodsUpdateUnit } = await import('@/api/goods/unit');
      await goodsUpdateUnit(token, nsSlug.value, {
        id: editingUnit.value.id, name: unitForm.name.trim(), symbol: unitForm.symbol.trim(), isActive: editingUnit.value.isActive,
      });
    } else {
      const { goodsCreateUnit } = await import('@/api/goods/unit');
      await goodsCreateUnit(token, nsSlug.value, { name: unitForm.name.trim(), symbol: unitForm.symbol.trim() });
    }
    showUnitModal.value = false;
    await loadAll();
  } catch (e) {
    logError('[goods/catalog] submitUnitForm failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to save unit', color: 'red' });
  } finally {
    savingUnit.value = false;
  }
}

async function deleteUnit(u: GoodsUnit) {
  if (!(await confirm({ message: `${t('common.confirmDelete')} "${u.name}"` }))) return;
  try {
    const token = await getToken();
    const { goodsDeleteUnit } = await import('@/api/goods/unit');
    await goodsDeleteUnit(token, nsSlug.value, u.id);
    await loadAll();
  } catch (e) {
    logError('[goods/catalog] deleteUnit failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to delete unit', color: 'red' });
  }
}

onMounted(loadAll);
</script>

<template>
  <div class="h-full flex flex-col p-4 pb-safe-or-4 min-h-0">
    <div class="flex-shrink-0">
      <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">{{ t('goods.catalog') }}</h1>
      <p class="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{{ t('goods.catalogSubtitle') }}</p>
    </div>

    <div class="flex-shrink-0 mt-3">
      <GoodsNavTabs />
    </div>

    <!-- Segmented pill control -- deliberately NOT styled like GoodsNavTabs above,
         since this switches local component state, not real routes. The
         per-tab "add" action lives in this same row (not stacked below it)
         so switching tabs and adding an item both happen from one place. -->
    <div class="flex items-center justify-between gap-2 mt-3 flex-shrink-0">
      <div class="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          v-for="tab in TABS"
          :key="tab.key"
          type="button"
          class="px-3 py-1.5 rounded-full text-sm font-medium border transition whitespace-nowrap"
          :class="activeTab === tab.key
            ? 'bg-primary-100 text-primary-700 border-primary-200 dark:bg-primary-900/40 dark:text-primary-100 dark:border-primary-900/60'
            : 'bg-gray-50 dark:bg-gray-900/60 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300'"
          @click="activeTab = tab.key"
        >
          {{ t(tab.labelKey) }}
        </button>
      </div>
      <UButton
        color="primary"
        icon="lucide:plus"
        size="sm"
        class="flex-shrink-0"
        @click="activeTab === 'goods' ? openAddGood() : activeTab === 'categories' ? openAddCategory() : openAddUnit()"
      >
        {{ activeTab === 'goods' ? t('goods.addGood') : activeTab === 'categories' ? t('goods.addCategory') : t('goods.addUnit') }}
      </UButton>
    </div>

    <div v-if="activeTab === 'goods'" class="flex-1 min-h-0 flex flex-col mt-3">
      <div class="flex-1 min-h-0">
        <AppTable :rows="goodRows" :columns="goodColumns" :loading="loading" empty-icon="lucide:package">
          <template #name-data="{ row }">
            <button type="button" class="font-medium text-left hover:underline hover:text-primary-600 dark:hover:text-primary-400" @click="openEditGood(goodById.get(row.id)!)">
              {{ row.name }}
            </button>
          </template>
          <template #actions-data="{ row }">
            <div class="flex justify-end">
              <UButton size="2xs" color="red" variant="ghost" icon="lucide:trash-2" :loading="deletingGoodId === row.id" @click="deleteGood(goodById.get(row.id)!)" />
            </div>
          </template>
        </AppTable>
      </div>
    </div>

    <div v-else-if="activeTab === 'categories'" class="flex-1 min-h-0 flex flex-col mt-3">
      <div class="flex-1 min-h-0">
        <AppTable :rows="categories" :columns="categoryColumns" :loading="loading" empty-icon="lucide:tag">
          <template #name-data="{ row }">
            <button type="button" class="font-medium text-left hover:underline hover:text-primary-600 dark:hover:text-primary-400" @click="openEditCategory(row)">
              {{ row.name }}
            </button>
          </template>
          <template #actions-data="{ row }">
            <div class="flex justify-end">
              <UButton size="2xs" color="red" variant="ghost" icon="lucide:trash-2" @click="deleteCategory(row)" />
            </div>
          </template>
        </AppTable>
      </div>
    </div>

    <div v-else class="flex-1 min-h-0 flex flex-col mt-3">
      <div class="flex-1 min-h-0">
        <AppTable :rows="units" :columns="unitColumns" :loading="loading" empty-icon="lucide:ruler">
          <template #name-data="{ row }">
            <button type="button" class="font-medium text-left hover:underline hover:text-primary-600 dark:hover:text-primary-400" @click="openEditUnit(row)">
              {{ row.name }}
            </button>
          </template>
          <template #actions-data="{ row }">
            <div class="flex justify-end">
              <UButton size="2xs" color="red" variant="ghost" icon="lucide:trash-2" @click="deleteUnit(row)" />
            </div>
          </template>
        </AppTable>
      </div>
    </div>

    <GoodFormModal
      v-model="showGoodModal"
      :good="editingGood"
      :units="units"
      :categories="categories"
      :saving="savingGood"
      :ns-slug="nsSlug"
      @submit="submitGoodForm"
    />

    <UModal v-model="showCategoryModal">
      <UCard>
        <template #header><h3 class="text-lg font-semibold">{{ editingCategory ? t('goods.editCategory') : t('goods.addCategory') }}</h3></template>
        <UFormGroup :label="t('goods.goodName')" required>
          <UInput v-model="categoryForm.name" size="lg" autofocus @keyup.enter="submitCategoryForm" />
        </UFormGroup>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="ghost" @click="showCategoryModal = false">{{ t('common.cancel') }}</UButton>
            <UButton color="primary" :loading="savingCategory" :disabled="!categoryForm.name.trim() || savingCategory" @click="submitCategoryForm">{{ t('common.save') }}</UButton>
          </div>
        </template>
      </UCard>
    </UModal>

    <UModal v-model="showUnitModal">
      <UCard>
        <template #header><h3 class="text-lg font-semibold">{{ editingUnit ? t('goods.editUnit') : t('goods.addUnit') }}</h3></template>
        <div class="space-y-3">
          <UFormGroup :label="t('goods.goodName')" required><UInput v-model="unitForm.name" size="lg" autofocus @keyup.enter="submitUnitForm" /></UFormGroup>
          <UFormGroup :label="t('goods.unitSymbol')" required><UInput v-model="unitForm.symbol" size="lg" placeholder="kg" @keyup.enter="submitUnitForm" /></UFormGroup>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="ghost" @click="showUnitModal = false">{{ t('common.cancel') }}</UButton>
            <UButton color="primary" :loading="savingUnit" :disabled="!unitForm.name.trim() || !unitForm.symbol.trim() || savingUnit" @click="submitUnitForm">{{ t('common.save') }}</UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>
