<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useGoodsAuth } from '@/composables/useGoodsAuth';
import { useGoodsStaffRole, type GoodsStaffRole } from '@/composables/useGoodsStaffRole';
import { useNamespace } from '@/composables/useNamespace';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import { useConfirm } from '@/composables/useConfirm';
import type { GoodsStaff } from '@/api/goods/staff';
import type { GoodsWarehouse, GoodsWarehouseType } from '@/api/goods/warehouse';
import type { GoodsSettings } from '@/api/goods/settings';
import type { GoodsPriceList, GoodsPriceListType } from '@/api/goods/pricelist';
import type { GoodsGiftCertificate } from '@/api/goods/giftcertificate';
import type { GoodsRecipe } from '@/api/goods/recipe';
import type { GoodsGood } from '@/api/goods/good';
import type { GoodsUnit } from '@/api/goods/unit';
import type { GoodsDiscountRule, GoodsDiscountType, GoodsDiscountScope } from '@/api/goods/sale';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const { titleBySlug } = useNamespace();
const { role: staffRole, isOwnerOrManager } = useGoodsStaffRole();
const { confirm } = useConfirm();

useHead(() => ({
  title: titleBySlug(nsSlug.value) ? `${t('goods.settings')} — ${titleBySlug(nsSlug.value)}` : t('goods.settings'),
}));

// Defense in depth: every mutation here is @goodsAuth(roles: [OWNER, MANAGER])
// server-side already, so a non-owner/manager who lands here directly
// (e.g. bookmarked URL) can't do anything anyway -- bounce back to the
// register instead of showing a page full of actions that will just fail.
watch(staffRole, (r) => {
  if (r && !isOwnerOrManager.value) navigateTo(`/${nsSlug.value}/goods/register`);
}, { immediate: true });

const { getToken: getGoodsTokenRaw } = useGoodsAuth();
async function getToken(): Promise<string> {
  return getGoodsTokenRaw(nsSlug.value);
}

// Discounts + price lists used to be two separate top-level tabs even
// though both are "pricing rules" -- merged into one "pricing" tab (two
// sections, divider between) so the tab strip reads as 6 real groupings
// (access / locations / general / pricing / gift certs / recipes) instead
// of 7 flat, same-weight items.
type TabKey = 'staff' | 'warehouses' | 'general' | 'pricing' | 'giftCertificates' | 'recipes';
const activeTab = ref<TabKey>((route.query.tab as TabKey) || 'staff');
watch(activeTab, (tab) => {
  navigateTo({ query: { ...route.query, tab } }, { replace: true });
});

const TABS = computed<{ key: TabKey; label: string; icon: string }[]>(() => [
  { key: 'staff', label: t('goods.staff'), icon: 'lucide:users' },
  { key: 'warehouses', label: t('goods.warehouse'), icon: 'lucide:warehouse' },
  { key: 'general', label: t('goods.generalSettings'), icon: 'lucide:settings' },
  { key: 'pricing', label: t('goods.pricing'), icon: 'lucide:percent' },
  { key: 'giftCertificates', label: t('goods.giftCertificates'), icon: 'lucide:gift' },
  { key: 'recipes', label: t('goods.recipes'), icon: 'lucide:flask-conical' },
]);

// --- Staff ---
const staff = ref<GoodsStaff[]>([]);
const loadingStaff = ref(false);
const staffForm = reactive({ userId: '', role: 'CASHIER' as GoodsStaffRole });
const savingStaff = ref(false);
const ROLE_OPTIONS: GoodsStaffRole[] = ['OWNER', 'MANAGER', 'CASHIER', 'STOCKKEEPER', 'VIEWER'];
const ROLE_DESCRIPTION_KEYS: Record<GoodsStaffRole, string> = {
  OWNER: 'goods.roleOwnerDesc',
  MANAGER: 'goods.roleManagerDesc',
  CASHIER: 'goods.roleCashierDesc',
  STOCKKEEPER: 'goods.roleStockkeeperDesc',
  VIEWER: 'goods.roleViewerDesc',
};
const staffFormRoleDescription = computed(() => t(ROLE_DESCRIPTION_KEYS[staffForm.role]));

async function loadStaff() {
  loadingStaff.value = true;
  try {
    const goodsToken = await getToken();
    const { goodsListStaff } = await import('@/api/goods/staff');
    const { staff: s } = await goodsListStaff(goodsToken, nsSlug.value);
    staff.value = s;
  } catch (e) {
    logError('[goods/settings] loadStaff failed', e);
  } finally {
    loadingStaff.value = false;
  }
}

async function addStaff() {
  if (!staffForm.userId.trim()) return;
  savingStaff.value = true;
  try {
    const goodsToken = await getToken();
    const { goodsCreateStaff } = await import('@/api/goods/staff');
    await goodsCreateStaff(goodsToken, nsSlug.value, staffForm.userId.trim(), staffForm.role);
    staffForm.userId = '';
    await loadStaff();
  } catch (e) {
    logError('[goods/settings] addStaff failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to add staff', color: 'red' });
  } finally {
    savingStaff.value = false;
  }
}

async function updateRole(member: GoodsStaff, role: GoodsStaffRole) {
  try {
    const goodsToken = await getToken();
    const { goodsUpdateStaffRole } = await import('@/api/goods/staff');
    await goodsUpdateStaffRole(goodsToken, nsSlug.value, member.id, role);
    await loadStaff();
  } catch (e) {
    logError('[goods/settings] updateRole failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to update role', color: 'red' });
  }
}

async function removeStaff(member: GoodsStaff) {
  if (!(await confirm({ message: t('common.confirmDelete') }))) return;
  try {
    const goodsToken = await getToken();
    const { goodsDeleteStaff } = await import('@/api/goods/staff');
    await goodsDeleteStaff(goodsToken, nsSlug.value, member.id);
    await loadStaff();
  } catch (e) {
    logError('[goods/settings] removeStaff failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to remove staff', color: 'red' });
  }
}

// --- Warehouses ---
const warehouses = ref<GoodsWarehouse[]>([]);
const loadingWarehouses = ref(false);
const warehouseForm = reactive({ name: '', address: '', type: 'BOTH' as GoodsWarehouseType });
const savingWarehouse = ref(false);

async function loadWarehouses() {
  loadingWarehouses.value = true;
  try {
    const goodsToken = await getToken();
    const { goodsListWarehouses } = await import('@/api/goods/warehouse');
    const { warehouses: w } = await goodsListWarehouses(goodsToken, nsSlug.value);
    warehouses.value = w;
  } catch (e) {
    logError('[goods/settings] loadWarehouses failed', e);
  } finally {
    loadingWarehouses.value = false;
  }
}

async function addWarehouse() {
  if (!warehouseForm.name.trim()) return;
  savingWarehouse.value = true;
  try {
    const goodsToken = await getToken();
    const { goodsCreateWarehouse } = await import('@/api/goods/warehouse');
    await goodsCreateWarehouse(goodsToken, nsSlug.value, {
      name: warehouseForm.name.trim(), address: warehouseForm.address.trim(), type: warehouseForm.type,
    });
    warehouseForm.name = '';
    warehouseForm.address = '';
    await loadWarehouses();
  } catch (e) {
    logError('[goods/settings] addWarehouse failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to add warehouse', color: 'red' });
  } finally {
    savingWarehouse.value = false;
  }
}

// goodsUpdateWarehouse has existed in the API since the module shipped but
// never had UI -- warehouses were create-only. Reusing the same "click the
// name to edit" pattern as everywhere else in the redesign.
const showEditWarehouse = ref(false);
const savingEditWarehouse = ref(false);
const editWarehouseForm = reactive({ id: '', name: '', address: '', type: 'BOTH' as GoodsWarehouseType, isActive: true });

function openEditWarehouse(w: GoodsWarehouse) {
  editWarehouseForm.id = w.id;
  editWarehouseForm.name = w.name;
  editWarehouseForm.address = w.address;
  editWarehouseForm.type = w.type;
  editWarehouseForm.isActive = w.isActive;
  showEditWarehouse.value = true;
}

async function submitEditWarehouse() {
  if (!editWarehouseForm.name.trim()) return;
  savingEditWarehouse.value = true;
  try {
    const goodsToken = await getToken();
    const { goodsUpdateWarehouse } = await import('@/api/goods/warehouse');
    await goodsUpdateWarehouse(goodsToken, nsSlug.value, {
      ...editWarehouseForm, name: editWarehouseForm.name.trim(), address: editWarehouseForm.address.trim(),
    });
    showEditWarehouse.value = false;
    await loadWarehouses();
  } catch (e) {
    logError('[goods/settings] submitEditWarehouse failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to update warehouse', color: 'red' });
  } finally {
    savingEditWarehouse.value = false;
  }
}

// --- General settings ---
const settings = ref<GoodsSettings | null>(null);
const loadingSettings = ref(false);
const savingSettings = ref(false);

async function loadSettings() {
  loadingSettings.value = true;
  try {
    const goodsToken = await getToken();
    const { goodsGetSettings } = await import('@/api/goods/settings');
    settings.value = await goodsGetSettings(goodsToken, nsSlug.value);
  } catch (e) {
    logError('[goods/settings] loadSettings failed', e);
  } finally {
    loadingSettings.value = false;
  }
}

const defaultWarehouseIdModel = computed<string>({
  get: () => settings.value?.defaultWarehouseId || '',
  set: (v) => { if (settings.value) settings.value.defaultWarehouseId = v; },
});

async function saveSettings() {
  if (!settings.value) return;
  savingSettings.value = true;
  try {
    const goodsToken = await getToken();
    const { goodsUpdateSettings } = await import('@/api/goods/settings');
    settings.value = await goodsUpdateSettings(goodsToken, nsSlug.value, settings.value);
    useToast().add({ title: t('common.saved'), color: 'green' });
  } catch (e) {
    logError('[goods/settings] saveSettings failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to save settings', color: 'red' });
  } finally {
    savingSettings.value = false;
  }
}

// --- Goods/Units (shared by price lists + recipes) ---
const goods = ref<GoodsGood[]>([]);
const units = ref<GoodsUnit[]>([]);
const goodsUnitsLoaded = ref(false);
const goodName = (id: string) => goods.value.find((g) => g.id === id)?.name || id;

async function loadGoodsAndUnits() {
  if (goodsUnitsLoaded.value) return;
  try {
    const goodsToken = await getToken();
    const [{ goods: g }, { units: u }] = await Promise.all([
      (await import('@/api/goods/good')).goodsListGoods(goodsToken, nsSlug.value),
      (await import('@/api/goods/unit')).goodsListUnits(goodsToken, nsSlug.value),
    ]);
    goods.value = g;
    units.value = u;
    goodsUnitsLoaded.value = true;
  } catch (e) {
    logError('[goods/settings] loadGoodsAndUnits failed', e);
  }
}

// --- Price lists ---
const priceLists = ref<GoodsPriceList[]>([]);
const loadingPriceLists = ref(false);
const priceListForm = reactive({ name: '', type: 'RETAIL' as GoodsPriceListType });
const savingPriceList = ref(false);
const PRICE_LIST_TYPES: GoodsPriceListType[] = ['RETAIL', 'WHOLESALE', 'CLIENT'];

async function loadPriceLists() {
  loadingPriceLists.value = true;
  try {
    const goodsToken = await getToken();
    const { goodsListPriceLists } = await import('@/api/goods/pricelist');
    priceLists.value = await goodsListPriceLists(goodsToken, nsSlug.value);
  } catch (e) {
    logError('[goods/settings] loadPriceLists failed', e);
  } finally {
    loadingPriceLists.value = false;
  }
}

async function addPriceList() {
  if (!priceListForm.name.trim()) return;
  savingPriceList.value = true;
  try {
    const goodsToken = await getToken();
    const { goodsCreatePriceList } = await import('@/api/goods/pricelist');
    await goodsCreatePriceList(goodsToken, nsSlug.value, priceListForm.name.trim(), priceListForm.type);
    priceListForm.name = '';
    await loadPriceLists();
  } catch (e) {
    logError('[goods/settings] addPriceList failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to add price list', color: 'red' });
  } finally {
    savingPriceList.value = false;
  }
}

async function removePriceList(pl: GoodsPriceList) {
  if (!(await confirm({ message: `${t('common.confirmDelete')} "${pl.name}"` }))) return;
  try {
    const goodsToken = await getToken();
    const { goodsDeletePriceList } = await import('@/api/goods/pricelist');
    await goodsDeletePriceList(goodsToken, nsSlug.value, pl.id);
    await loadPriceLists();
  } catch (e) {
    logError('[goods/settings] removePriceList failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to remove price list', color: 'red' });
  }
}

const showPriceListItems = ref(false);
const activePriceList = ref<GoodsPriceList | null>(null);
const priceItemDraft = reactive({ goodId: '', priceCents: 0 });
const savingPriceItem = ref(false);

function openPriceListItems(pl: GoodsPriceList) {
  activePriceList.value = pl;
  priceItemDraft.goodId = '';
  priceItemDraft.priceCents = 0;
  showPriceListItems.value = true;
}

async function setPriceListItem() {
  if (!activePriceList.value || !priceItemDraft.goodId) return;
  savingPriceItem.value = true;
  try {
    const goodsToken = await getToken();
    const { goodsSetPriceListItem } = await import('@/api/goods/pricelist');
    await goodsSetPriceListItem(goodsToken, nsSlug.value, activePriceList.value.id, priceItemDraft.goodId, priceItemDraft.priceCents);
    await loadPriceLists();
    activePriceList.value = priceLists.value.find((p) => p.id === activePriceList.value?.id) || null;
    priceItemDraft.goodId = '';
    priceItemDraft.priceCents = 0;
  } catch (e) {
    logError('[goods/settings] setPriceListItem failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to set price', color: 'red' });
  } finally {
    savingPriceItem.value = false;
  }
}

async function removePriceListItem(goodId: string) {
  if (!activePriceList.value) return;
  try {
    const goodsToken = await getToken();
    const { goodsRemovePriceListItem } = await import('@/api/goods/pricelist');
    await goodsRemovePriceListItem(goodsToken, nsSlug.value, activePriceList.value.id, goodId);
    await loadPriceLists();
    activePriceList.value = priceLists.value.find((p) => p.id === activePriceList.value?.id) || null;
  } catch (e) {
    logError('[goods/settings] removePriceListItem failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to remove price', color: 'red' });
  }
}

// --- Gift certificates ---
const giftCertificates = ref<GoodsGiftCertificate[]>([]);
const loadingGiftCertificates = ref(false);
const giftCertForm = reactive({ initialBalance: 0, expiresAt: '' });
const issuingGiftCert = ref(false);

async function loadGiftCertificates() {
  loadingGiftCertificates.value = true;
  try {
    const goodsToken = await getToken();
    const { goodsListGiftCertificates } = await import('@/api/goods/giftcertificate');
    giftCertificates.value = await goodsListGiftCertificates(goodsToken, nsSlug.value);
  } catch (e) {
    logError('[goods/settings] loadGiftCertificates failed', e);
  } finally {
    loadingGiftCertificates.value = false;
  }
}

async function issueGiftCertificate() {
  if (!giftCertForm.initialBalance) return;
  issuingGiftCert.value = true;
  try {
    const goodsToken = await getToken();
    const { goodsIssueGiftCertificate } = await import('@/api/goods/giftcertificate');
    await goodsIssueGiftCertificate(goodsToken, nsSlug.value, Math.round(giftCertForm.initialBalance * 100), giftCertForm.expiresAt || undefined);
    giftCertForm.initialBalance = 0;
    giftCertForm.expiresAt = '';
    await loadGiftCertificates();
  } catch (e) {
    logError('[goods/settings] issueGiftCertificate failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to issue certificate', color: 'red' });
  } finally {
    issuingGiftCert.value = false;
  }
}

// --- Recipes ---
const recipes = ref<GoodsRecipe[]>([]);
const loadingRecipes = ref(false);

async function loadRecipes() {
  loadingRecipes.value = true;
  try {
    const goodsToken = await getToken();
    const { goodsListRecipes } = await import('@/api/goods/recipe');
    recipes.value = await goodsListRecipes(goodsToken, nsSlug.value);
  } catch (e) {
    logError('[goods/settings] loadRecipes failed', e);
  } finally {
    loadingRecipes.value = false;
  }
}

const showRecipeForm = ref(false);
const savingRecipe = ref(false);
const recipeForm = reactive({ menuItemId: '', name: '' });
type RecipeDraftItem = { goodId: string; unitId: string; quantityPerUnit: number };
const recipeDraftItems = ref<RecipeDraftItem[]>([]);
const recipeItemDraft = reactive<RecipeDraftItem>({ goodId: '', unitId: '', quantityPerUnit: 1 });

function openRecipeForm() {
  recipeForm.menuItemId = '';
  recipeForm.name = '';
  recipeDraftItems.value = [];
  showRecipeForm.value = true;
}

function addRecipeDraftItem() {
  if (!recipeItemDraft.goodId || !recipeItemDraft.unitId) return;
  recipeDraftItems.value.push({ ...recipeItemDraft });
  recipeItemDraft.goodId = ''; recipeItemDraft.unitId = ''; recipeItemDraft.quantityPerUnit = 1;
}
function removeRecipeDraftItem(idx: number) { recipeDraftItems.value.splice(idx, 1); }

const isRecipeFormValid = computed(() => !!recipeForm.menuItemId.trim() && !!recipeForm.name.trim() && recipeDraftItems.value.length > 0);

async function saveRecipe() {
  if (!isRecipeFormValid.value) return;
  savingRecipe.value = true;
  try {
    const goodsToken = await getToken();
    const { goodsSetRecipe } = await import('@/api/goods/recipe');
    await goodsSetRecipe(goodsToken, nsSlug.value, {
      menuItemId: recipeForm.menuItemId.trim(), name: recipeForm.name.trim(), items: recipeDraftItems.value,
    });
    showRecipeForm.value = false;
    await loadRecipes();
  } catch (e) {
    logError('[goods/settings] saveRecipe failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to save recipe', color: 'red' });
  } finally {
    savingRecipe.value = false;
  }
}

async function removeRecipe(r: GoodsRecipe) {
  if (!(await confirm({ message: `${t('common.confirmDelete')} "${r.name}"` }))) return;
  try {
    const goodsToken = await getToken();
    const { goodsDeleteRecipe } = await import('@/api/goods/recipe');
    await goodsDeleteRecipe(goodsToken, nsSlug.value, r.id);
    await loadRecipes();
  } catch (e) {
    logError('[goods/settings] removeRecipe failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to remove recipe', color: 'red' });
  }
}

// --- Discount rules ---
const discountRules = ref<GoodsDiscountRule[]>([]);
const loadingDiscountRules = ref(false);
const discountRuleForm = reactive({ name: '', type: 'PERCENT' as GoodsDiscountType, scope: 'CHECK' as GoodsDiscountScope, value: 0 });
const savingDiscountRule = ref(false);
const DISCOUNT_TYPES: GoodsDiscountType[] = ['PERCENT', 'FIXED'];
const DISCOUNT_SCOPES: GoodsDiscountScope[] = ['GOOD', 'CATEGORY', 'CHECK'];

async function loadDiscountRules() {
  loadingDiscountRules.value = true;
  try {
    const goodsToken = await getToken();
    const { goodsListDiscountRules } = await import('@/api/goods/sale');
    discountRules.value = await goodsListDiscountRules(goodsToken, nsSlug.value);
  } catch (e) {
    logError('[goods/settings] loadDiscountRules failed', e);
  } finally {
    loadingDiscountRules.value = false;
  }
}

async function addDiscountRule() {
  if (!discountRuleForm.name.trim() || !discountRuleForm.value) return;
  savingDiscountRule.value = true;
  try {
    const goodsToken = await getToken();
    const { goodsCreateDiscountRule } = await import('@/api/goods/sale');
    await goodsCreateDiscountRule(goodsToken, nsSlug.value, { ...discountRuleForm, name: discountRuleForm.name.trim() });
    discountRuleForm.name = '';
    discountRuleForm.value = 0;
    await loadDiscountRules();
  } catch (e) {
    logError('[goods/settings] addDiscountRule failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to add discount rule', color: 'red' });
  } finally {
    savingDiscountRule.value = false;
  }
}

async function removeDiscountRule(r: GoodsDiscountRule) {
  if (!(await confirm({ message: `${t('common.confirmDelete')} "${r.name}"` }))) return;
  try {
    const goodsToken = await getToken();
    const { goodsDeleteDiscountRule } = await import('@/api/goods/sale');
    await goodsDeleteDiscountRule(goodsToken, nsSlug.value, r.id);
    await loadDiscountRules();
  } catch (e) {
    logError('[goods/settings] removeDiscountRule failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to remove discount rule', color: 'red' });
  }
}

watch(activeTab, (tab) => {
  if (tab === 'pricing') {
    loadGoodsAndUnits();
    if (!priceLists.value.length) loadPriceLists();
    if (!discountRules.value.length) loadDiscountRules();
  } else if (tab === 'giftCertificates') { if (!giftCertificates.value.length) loadGiftCertificates(); }
  else if (tab === 'recipes') { loadGoodsAndUnits(); if (!recipes.value.length) loadRecipes(); }
}, { immediate: true });

onMounted(() => {
  loadStaff();
  loadWarehouses();
  loadSettings();
});
</script>

<template>
  <div class="h-full flex flex-col p-4 pb-safe-or-4 min-h-0">
    <div class="flex items-center justify-between flex-shrink-0">
      <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">{{ t('goods.settings') }}</h1>
      <UButton color="primary" variant="soft" size="xs" icon="lucide:arrow-left" class="min-w-fit whitespace-nowrap gap-2" :to="`/${nsSlug}/goods`">{{ t('goods.warehouse') }}</UButton>
    </div>

    <div class="sticky top-0 z-10 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 mt-3 flex-shrink-0">
      <button
        v-for="tab in TABS"
        :key="tab.key"
        type="button"
        class="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors"
        :class="activeTab === tab.key ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'"
        @click="activeTab = tab.key"
      >
        <Icon :name="tab.icon" class="w-4 h-4" />
        {{ tab.label }}
      </button>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto mt-4 space-y-4">
    <!-- Staff -->
    <div v-if="activeTab === 'staff'" class="space-y-4">
      <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
        <div v-for="m in staff" :key="m.id" class="flex items-center justify-between px-4 py-2.5 text-sm">
          <span class="font-medium text-gray-900 dark:text-white truncate">{{ m.userId }}</span>
          <div class="flex items-center gap-2">
            <USelectMenu
              :model-value="m.role"
              :options="ROLE_OPTIONS"
              size="xs"
              class="w-32"
              :popper="{ strategy: 'fixed' }"
              @update:model-value="(v: GoodsStaffRole) => updateRole(m, v)"
            />
            <UButton color="red" variant="ghost" icon="lucide:trash-2" size="2xs" @click="removeStaff(m)" />
          </div>
        </div>
        <div v-if="!loadingStaff && !staff.length" class="px-4 py-8 text-center text-sm text-gray-400">—</div>
      </div>

      <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
        <div class="grid grid-cols-[1fr_auto] gap-2 items-end">
          <UFormGroup :label="t('goods.userId')">
            <UInput v-model="staffForm.userId" @keyup.enter="addStaff" />
          </UFormGroup>
          <UFormGroup :label="t('goods.role')">
            <USelectMenu v-model="staffForm.role" :options="ROLE_OPTIONS" class="w-36" :popper="{ strategy: 'fixed' }" />
          </UFormGroup>
        </div>
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ staffFormRoleDescription }}</p>
        <UButton color="primary" icon="lucide:plus" :loading="savingStaff" @click="addStaff">{{ t('goods.addStaff') }}</UButton>
      </div>
    </div>

    <!-- Warehouses -->
    <div v-else-if="activeTab === 'warehouses'" class="space-y-4">
      <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
        <div v-for="w in warehouses" :key="w.id" class="flex items-center justify-between px-4 py-2.5 text-sm">
          <button type="button" class="text-left" @click="openEditWarehouse(w)">
            <div class="font-medium text-gray-900 dark:text-white hover:underline hover:text-primary-600 dark:hover:text-primary-400">{{ w.name }}</div>
            <div class="text-gray-400">{{ w.address }}</div>
          </button>
          <UBadge color="gray" variant="soft">{{ w.type }}</UBadge>
        </div>
      </div>

      <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
        <UFormGroup :label="t('goods.warehouseName')">
          <UInput v-model="warehouseForm.name" @keyup.enter="addWarehouse" />
        </UFormGroup>
        <UFormGroup :label="t('goods.warehouseAddress')">
          <UInput v-model="warehouseForm.address" @keyup.enter="addWarehouse" />
        </UFormGroup>
        <UFormGroup :label="t('goods.warehouseType')">
          <USelectMenu
            v-model="warehouseForm.type"
            :options="[
              { label: t('goods.warehouseTypeBoth'), value: 'BOTH' },
              { label: t('goods.warehouseTypeShop'), value: 'SHOP' },
              { label: t('goods.warehouseTypeStorage'), value: 'STORAGE' },
            ]"
            value-attribute="value"
            option-attribute="label"
            :popper="{ strategy: 'fixed' }"
          />
        </UFormGroup>
        <UButton color="primary" icon="lucide:plus" :loading="savingWarehouse" @click="addWarehouse">{{ t('goods.createWarehouse') }}</UButton>
      </div>
    </div>

    <!-- General -->
    <div v-else-if="activeTab === 'general' && settings" class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
      <UFormGroup :label="t('goods.currency')">
        <UInput v-model="settings.currency" class="max-w-[140px]" />
      </UFormGroup>
      <UFormGroup :label="t('goods.warehouse')">
        <USelectMenu
          v-model="defaultWarehouseIdModel"
          :options="warehouses.map((w) => ({ label: w.name, value: w.id }))"
          value-attribute="value" option-attribute="label" class="max-w-xs" :popper="{ strategy: 'fixed' }"
        />
      </UFormGroup>
      <UFormGroup :label="t('goods.maxCashierDiscount')">
        <UInput v-model.number="settings.maxCashierDiscountPercent" type="number" min="0" max="100" class="max-w-[140px]" />
      </UFormGroup>
      <UFormGroup :label="t('goods.openSaleReservationTimeout')">
        <UInput v-model.number="settings.openSaleReservationTimeoutMinutes" type="number" min="1" class="max-w-[140px]" />
      </UFormGroup>
      <UFormGroup :label="t('goods.barcodeLabelSize')">
        <USelectMenu
          v-model="settings.barcodeLabelSize"
          :options="['58x40', '40x30']"
          class="max-w-[140px]"
          :popper="{ strategy: 'fixed' }"
        />
      </UFormGroup>
      <UFormGroup :label="t('goods.receiptFooter')">
        <UTextarea v-model="settings.receiptFooterText" :rows="2" />
      </UFormGroup>
      <UButton color="primary" :loading="savingSettings" @click="saveSettings">{{ t('common.save') }}</UButton>
    </div>

    <!-- Pricing: discount rules + price lists, merged into one grouping
         since both are "pricing rules" -- used to be two same-weight top
         level tabs for what's really one topic. -->
    <div v-else-if="activeTab === 'pricing'" class="space-y-6">
      <div class="space-y-3">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">{{ t('goods.discounts') }}</h3>
        <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
          <div v-for="r in discountRules" :key="r.id" class="flex items-center justify-between px-4 py-2.5 text-sm">
            <div>
              <div class="font-medium text-gray-900 dark:text-white">{{ r.name }}</div>
              <div class="text-xs text-gray-400">{{ r.scope }} · {{ r.type === 'PERCENT' ? `${r.value}%` : r.value }}</div>
            </div>
            <UButton color="red" variant="ghost" icon="lucide:trash-2" size="2xs" @click="removeDiscountRule(r)" />
          </div>
          <div v-if="!loadingDiscountRules && !discountRules.length" class="px-4 py-8 text-center text-sm text-gray-400">—</div>
        </div>

        <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <UFormGroup :label="t('common.title')"><UInput v-model="discountRuleForm.name" @keyup.enter="addDiscountRule" /></UFormGroup>
            <UFormGroup :label="t('goods.discountValue')"><UInput v-model.number="discountRuleForm.value" type="number" min="0" step="0.01" @keyup.enter="addDiscountRule" /></UFormGroup>
            <UFormGroup :label="t('goods.type')"><USelectMenu v-model="discountRuleForm.type" :options="DISCOUNT_TYPES" :popper="{ strategy: 'fixed' }" /></UFormGroup>
            <UFormGroup :label="t('goods.discountScope')"><USelectMenu v-model="discountRuleForm.scope" :options="DISCOUNT_SCOPES" :popper="{ strategy: 'fixed' }" /></UFormGroup>
          </div>
          <UButton color="primary" icon="lucide:plus" :loading="savingDiscountRule" @click="addDiscountRule">{{ t('goods.addDiscountRule') }}</UButton>
        </div>
      </div>

      <div class="space-y-3 pt-3 border-t border-gray-100 dark:border-gray-800">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">{{ t('goods.priceLists') }}</h3>
        <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
          <div v-for="pl in priceLists" :key="pl.id" class="flex items-center justify-between px-4 py-2.5 text-sm">
            <button type="button" class="text-left hover:underline hover:text-primary-600 dark:hover:text-primary-400" @click="openPriceListItems(pl)">
              <div class="font-medium text-gray-900 dark:text-white">{{ pl.name }}</div>
              <div class="text-xs text-gray-400">{{ pl.type }} · {{ pl.items.length }}</div>
            </button>
            <UButton color="red" variant="ghost" icon="lucide:trash-2" size="2xs" @click="removePriceList(pl)" />
          </div>
          <div v-if="!loadingPriceLists && !priceLists.length" class="px-4 py-8 text-center text-sm text-gray-400">—</div>
        </div>

        <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
          <div class="grid grid-cols-[1fr_auto] gap-3">
            <UFormGroup :label="t('common.title')"><UInput v-model="priceListForm.name" @keyup.enter="addPriceList" /></UFormGroup>
            <UFormGroup :label="t('goods.type')"><USelectMenu v-model="priceListForm.type" :options="PRICE_LIST_TYPES" class="w-36" :popper="{ strategy: 'fixed' }" /></UFormGroup>
          </div>
          <UButton color="primary" icon="lucide:plus" :loading="savingPriceList" @click="addPriceList">{{ t('goods.addPriceList') }}</UButton>
        </div>
      </div>
    </div>

    <!-- Gift certificates -->
    <div v-else-if="activeTab === 'giftCertificates'" class="space-y-4">
      <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
        <div v-for="gc in giftCertificates" :key="gc.id" class="flex items-center justify-between px-4 py-2.5 text-sm">
          <div>
            <div class="font-medium text-gray-900 dark:text-white font-mono">{{ gc.code }}</div>
            <div class="text-xs text-gray-400">{{ t('goods.balance') }}: {{ (gc.balanceCents / 100).toFixed(2) }} / {{ (gc.initialBalanceCents / 100).toFixed(2) }}</div>
          </div>
          <UBadge :color="gc.isActive ? 'green' : 'gray'" variant="soft">{{ gc.isActive ? t('common.status') : '—' }}</UBadge>
        </div>
        <div v-if="!loadingGiftCertificates && !giftCertificates.length" class="px-4 py-8 text-center text-sm text-gray-400">—</div>
      </div>

      <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <UFormGroup :label="t('goods.balance')"><UInput v-model.number="giftCertForm.initialBalance" type="number" min="0" @keyup.enter="issueGiftCertificate" /></UFormGroup>
          <UFormGroup :label="t('goods.expiryDate')"><UInput v-model="giftCertForm.expiresAt" type="date" /></UFormGroup>
        </div>
        <UButton color="primary" icon="lucide:plus" :loading="issuingGiftCert" :disabled="!giftCertForm.initialBalance" @click="issueGiftCertificate">{{ t('goods.addGiftCertificate') }}</UButton>
      </div>
    </div>

    <!-- Recipes -->
    <div v-else-if="activeTab === 'recipes'" class="space-y-4">
      <div class="flex justify-end">
        <UButton color="primary" icon="lucide:plus" @click="openRecipeForm">{{ t('goods.addRecipe') }}</UButton>
      </div>
      <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
        <div v-for="r in recipes" :key="r.id" class="flex items-center justify-between px-4 py-2.5 text-sm">
          <div>
            <div class="font-medium text-gray-900 dark:text-white">{{ r.name }}</div>
            <div class="text-xs text-gray-400">{{ t('goods.menuItemId') }}: {{ r.menuItemId }} · {{ r.items.length }}</div>
          </div>
          <UButton color="red" variant="ghost" icon="lucide:trash-2" size="2xs" @click="removeRecipe(r)" />
        </div>
        <div v-if="!loadingRecipes && !recipes.length" class="px-4 py-8 text-center text-sm text-gray-400">—</div>
      </div>
    </div>
    </div>

    <!-- Edit warehouse modal -->
    <UModal v-model="showEditWarehouse">
      <UCard>
        <template #header><h3 class="text-lg font-semibold">{{ t('goods.editWarehouse') }}</h3></template>
        <div class="space-y-3">
          <UFormGroup :label="t('goods.warehouseName')" required>
            <UInput v-model="editWarehouseForm.name" autofocus @keyup.enter="submitEditWarehouse" />
          </UFormGroup>
          <UFormGroup :label="t('goods.warehouseAddress')">
            <UInput v-model="editWarehouseForm.address" @keyup.enter="submitEditWarehouse" />
          </UFormGroup>
          <UFormGroup :label="t('goods.warehouseType')">
            <USelectMenu
              v-model="editWarehouseForm.type"
              :options="[
                { label: t('goods.warehouseTypeBoth'), value: 'BOTH' },
                { label: t('goods.warehouseTypeShop'), value: 'SHOP' },
                { label: t('goods.warehouseTypeStorage'), value: 'STORAGE' },
              ]"
              value-attribute="value"
              option-attribute="label"
              :popper="{ strategy: 'fixed' }"
            />
          </UFormGroup>
          <UFormGroup :label="t('common.status')">
            <UToggle v-model="editWarehouseForm.isActive" />
          </UFormGroup>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="ghost" @click="showEditWarehouse = false">{{ t('common.cancel') }}</UButton>
            <UButton color="primary" :loading="savingEditWarehouse" :disabled="!editWarehouseForm.name.trim()" @click="submitEditWarehouse">{{ t('common.save') }}</UButton>
          </div>
        </template>
      </UCard>
    </UModal>

    <!-- Price list items modal -->
    <UModal v-model="showPriceListItems" :ui="{ width: 'sm:max-w-lg' }">
      <UCard>
        <template #header><h3 class="font-semibold">{{ activePriceList?.name }}</h3></template>
        <div class="space-y-3">
          <div class="divide-y divide-gray-100 dark:divide-gray-800">
            <div v-for="item in activePriceList?.items || []" :key="item.id" class="flex items-center justify-between text-sm py-1.5">
              <span>{{ goodName(item.goodId) }}</span>
              <div class="flex items-center gap-2">
                <span>{{ (item.priceCents / 100).toFixed(2) }}</span>
                <UButton size="2xs" color="red" variant="ghost" icon="lucide:x" @click="removePriceListItem(item.goodId)" />
              </div>
            </div>
            <div v-if="!activePriceList?.items?.length" class="text-center py-4 text-sm text-gray-400">—</div>
          </div>
          <div class="grid grid-cols-3 gap-2 items-end pt-2 border-t border-gray-100 dark:border-gray-800">
            <USelectMenu v-model="priceItemDraft.goodId" :options="goods.map((g) => ({ label: g.name, value: g.id }))" value-attribute="value" option-attribute="label" size="sm" :placeholder="t('goods.good')" :popper="{ strategy: 'fixed' }" class="col-span-2" />
            <UInput v-model.number="priceItemDraft.priceCents" type="number" min="0" size="sm" placeholder="Cents" />
          </div>
          <UButton size="xs" color="gray" variant="soft" icon="lucide:plus" :loading="savingPriceItem" :disabled="!priceItemDraft.goodId" @click="setPriceListItem">{{ t('common.add') }}</UButton>
        </div>
        <template #footer>
          <div class="flex justify-end">
            <UButton color="gray" variant="ghost" @click="showPriceListItems = false">{{ t('common.close') }}</UButton>
          </div>
        </template>
      </UCard>
    </UModal>

    <!-- Recipe form modal -->
    <UModal v-model="showRecipeForm" :ui="{ width: 'sm:max-w-2xl' }">
      <UCard>
        <template #header><h3 class="font-semibold">{{ t('goods.addRecipe') }}</h3></template>
        <div class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <UFormGroup :label="t('goods.menuItemId')" required>
              <UInput v-model="recipeForm.menuItemId" />
            </UFormGroup>
            <UFormGroup :label="t('common.title')" required>
              <UInput v-model="recipeForm.name" />
            </UFormGroup>
          </div>

          <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-3 space-y-2">
            <div class="grid grid-cols-4 gap-2 items-end">
              <USelectMenu v-model="recipeItemDraft.goodId" :options="goods.map((g) => ({ label: g.name, value: g.id }))" value-attribute="value" option-attribute="label" size="sm" :placeholder="t('goods.good')" :popper="{ strategy: 'fixed' }" class="col-span-2" />
              <USelectMenu v-model="recipeItemDraft.unitId" :options="units.map((u) => ({ label: u.symbol, value: u.id }))" value-attribute="value" option-attribute="label" size="sm" :placeholder="t('goods.unit')" :popper="{ strategy: 'fixed' }" />
              <UInput v-model.number="recipeItemDraft.quantityPerUnit" type="number" min="0" step="0.01" size="sm" :placeholder="t('goods.quantityPerUnit')" />
            </div>
            <UButton size="xs" color="gray" variant="soft" icon="lucide:plus" @click="addRecipeDraftItem">{{ t('common.add') }}</UButton>

            <div v-if="recipeDraftItems.length" class="divide-y divide-gray-100 dark:divide-gray-800 mt-2">
              <div v-for="(item, idx) in recipeDraftItems" :key="idx" class="flex items-center justify-between text-sm py-1.5">
                <span>{{ goodName(item.goodId) }} — {{ item.quantityPerUnit }}</span>
                <UButton size="2xs" color="red" variant="ghost" icon="lucide:x" @click="removeRecipeDraftItem(idx)" />
              </div>
            </div>
          </div>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="ghost" @click="showRecipeForm = false">{{ t('common.cancel') }}</UButton>
            <UButton color="primary" :loading="savingRecipe" :disabled="!isRecipeFormValid" @click="saveRecipe">{{ t('common.save') }}</UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>
