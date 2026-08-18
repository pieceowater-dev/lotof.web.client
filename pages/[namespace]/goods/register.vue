<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useGoodsToken } from '@/composables/useGoodsToken';
import { useGoodsStaffRole } from '@/composables/useGoodsStaffRole';
import { useNamespace } from '@/composables/useNamespace';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import type { GoodsWarehouse } from '@/api/goods/warehouse';
import type { GoodsRegister, GoodsCashShift } from '@/api/goods/register';
import type { GoodsSale, GoodsPaymentMethod, GoodsCashMovementType } from '@/api/goods/sale';
import type { GoodsGood } from '@/api/goods/good';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const { titleBySlug } = useNamespace();
const { isOwnerOrManager } = useGoodsStaffRole();

useHead(() => ({
  title: titleBySlug(nsSlug.value) ? `${t('goods.register')} — ${titleBySlug(nsSlug.value)}` : t('goods.register'),
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
const registers = ref<GoodsRegister[]>([]);
const activeWarehouseId = ref<string | null>(null);
const activeRegister = ref<GoodsRegister | null>(null);
const currentShift = ref<GoodsCashShift | null>(null);
const goodNameById = ref<Map<string, string>>(new Map());
const activeSale = ref<GoodsSale | null>(null);
const goods = ref<GoodsGood[]>([]);

const STORAGE_KEY = computed(() => `goods:activeWarehouse:${nsSlug.value}`);

async function bootstrap() {
  loading.value = true;
  try {
    const goodsToken = await getToken();
    const { goodsListWarehouses } = await import('@/api/goods/warehouse');
    const { warehouses: w } = await goodsListWarehouses(goodsToken, nsSlug.value);
    warehouses.value = w;
    if (!warehouses.value.length) {
      return navigateTo(`/${nsSlug.value}/goods/onboarding`);
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY.value);
      if (saved && warehouses.value.some((x) => x.id === saved)) activeWarehouseId.value = saved;
    } catch {}
    if (!activeWarehouseId.value) activeWarehouseId.value = warehouses.value[0].id;

    const { goodsListRegisters } = await import('@/api/goods/register');
    const { registers: r } = await goodsListRegisters(goodsToken, nsSlug.value);
    registers.value = r;
    activeRegister.value = registers.value.find((x) => x.defaultWarehouseId === activeWarehouseId.value) || null;

    if (activeRegister.value) {
      const { goodsCurrentShift } = await import('@/api/goods/register');
      currentShift.value = await goodsCurrentShift(goodsToken, nsSlug.value, activeRegister.value.id);
    }

    const { goodsListGoods } = await import('@/api/goods/good');
    const { goods: g } = await goodsListGoods(goodsToken, nsSlug.value);
    goods.value = g.filter((x) => x.isActive);
    goodNameById.value = new Map(g.map((x) => [x.id, x.name]));
  } catch (e) {
    logError('[goods/register] bootstrap failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to load register', color: 'red' });
  } finally {
    loading.value = false;
  }
}

// --- Register creation (first time on this warehouse) ---
const creatingRegister = ref(false);
async function createRegisterHere() {
  if (!activeWarehouseId.value) return;
  creatingRegister.value = true;
  try {
    const goodsToken = await getToken();
    const { goodsCreateRegister } = await import('@/api/goods/register');
    const warehouse = warehouses.value.find((w) => w.id === activeWarehouseId.value);
    activeRegister.value = await goodsCreateRegister(goodsToken, nsSlug.value, {
      name: warehouse ? `${t('goods.register')} — ${warehouse.name}` : t('goods.register'),
      defaultWarehouseId: activeWarehouseId.value,
      isMobile: false,
      receiptPrinterEnabled: false,
    });
    registers.value.push(activeRegister.value);
  } catch (e) {
    logError('[goods/register] createRegisterHere failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to create register', color: 'red' });
  } finally {
    creatingRegister.value = false;
  }
}

// --- Shift open/close ---
const openingCash = ref(0);
const closingCash = ref(0);
const shiftBusy = ref(false);
const showCloseShift = ref(false);
const showShiftReport = ref(false);
const shiftReport = ref<GoodsCashShift | null>(null);
const loadingShiftReport = ref(false);

async function openShift() {
  if (!activeRegister.value) return;
  shiftBusy.value = true;
  try {
    const goodsToken = await getToken();
    const { goodsOpenShift } = await import('@/api/goods/register');
    currentShift.value = await goodsOpenShift(goodsToken, nsSlug.value, activeRegister.value.id, Math.round(openingCash.value * 100));
  } catch (e) {
    logError('[goods/register] openShift failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to open shift', color: 'red' });
  } finally {
    shiftBusy.value = false;
  }
}

// X-report: recompute expected cash mid-shift, no state change.
async function openXReport() {
  if (!currentShift.value) return;
  loadingShiftReport.value = true;
  showShiftReport.value = true;
  try {
    const goodsToken = await getToken();
    const { goodsShiftReport } = await import('@/api/goods/register');
    shiftReport.value = await goodsShiftReport(goodsToken, nsSlug.value, currentShift.value.id);
  } catch (e) {
    logError('[goods/register] openXReport failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to load report', color: 'red' });
  } finally {
    loadingShiftReport.value = false;
  }
}

async function closeShift() {
  if (!currentShift.value) return;
  shiftBusy.value = true;
  try {
    const goodsToken = await getToken();
    const { goodsCloseShift } = await import('@/api/goods/register');
    const closed = await goodsCloseShift(goodsToken, nsSlug.value, currentShift.value.id, Math.round(closingCash.value * 100));
    currentShift.value = null;
    activeSale.value = null;
    showCloseShift.value = false;
    // Z-report: show the final reconciliation instead of just closing silently.
    shiftReport.value = closed;
    showShiftReport.value = true;
  } catch (e) {
    logError('[goods/register] closeShift failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to close shift', color: 'red' });
  } finally {
    shiftBusy.value = false;
  }
}

// --- Cash in/out (инкассация) ---
const showCashMovement = ref(false);
const cashMovementForm = reactive({ type: 'CASH_IN' as GoodsCashMovementType, amount: 0, reason: '' });
const recordingCashMovement = ref(false);

async function recordCashMovement() {
  if (!activeRegister.value || !currentShift.value || !cashMovementForm.amount) return;
  recordingCashMovement.value = true;
  try {
    const goodsToken = await getToken();
    const { goodsRecordCashMovement } = await import('@/api/goods/sale');
    await goodsRecordCashMovement(goodsToken, nsSlug.value, {
      registerId: activeRegister.value.id,
      shiftId: currentShift.value.id,
      type: cashMovementForm.type as 'CASH_IN' | 'CASH_OUT',
      amountCents: Math.round(cashMovementForm.amount * 100),
      reason: cashMovementForm.reason.trim(),
    });
    showCashMovement.value = false;
    cashMovementForm.amount = 0;
    cashMovementForm.reason = '';
    useToast().add({ title: t('common.saved'), color: 'green' });
  } catch (e) {
    logError('[goods/register] recordCashMovement failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to record cash movement', color: 'red' });
  } finally {
    recordingCashMovement.value = false;
  }
}

// --- Cart / sale ---
async function ensureSale(): Promise<GoodsSale> {
  if (activeSale.value) return activeSale.value;
  const goodsToken = await getToken();
  const { goodsCreateSale } = await import('@/api/goods/sale');
  activeSale.value = await goodsCreateSale(goodsToken, nsSlug.value, {
    registerId: activeRegister.value!.id,
    shiftId: currentShift.value!.id,
    warehouseId: activeWarehouseId.value!,
    clientGeneratedId: crypto.randomUUID(),
    clientId: clientIdInput.value.trim() || undefined,
  });
  return activeSale.value;
}

async function addGoodToCart(goodId: string, unitId: string, quantity: number) {
  const goodsToken = await getToken();
  const sale = await ensureSale();
  const { goodsAddSaleItem } = await import('@/api/goods/sale');
  activeSale.value = await goodsAddSaleItem(goodsToken, nsSlug.value, sale.id, goodId, unitId, quantity);
}

async function removeCartItem(saleItemId: string) {
  if (!activeSale.value) return;
  const goodsToken = await getToken();
  const { goodsRemoveSaleItem } = await import('@/api/goods/sale');
  activeSale.value = await goodsRemoveSaleItem(goodsToken, nsSlug.value, saleItemId);
}

async function voidCart() {
  if (!activeSale.value) return;
  try {
    const goodsToken = await getToken();
    const { goodsVoidSale } = await import('@/api/goods/sale');
    await goodsVoidSale(goodsToken, nsSlug.value, activeSale.value.id);
    activeSale.value = null;
  } catch (e) {
    logError('[goods/register] voidCart failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to void sale', color: 'red' });
  }
}

// --- Client attach (optional Contacts link) ---
const clientIdInput = ref('');

// --- Check-level discount ---
const showDiscount = ref(false);
const discountForm = reactive({ ruleId: '', manualAmount: 0, pin: '' });
const applyingDiscount = ref(false);
const discountRules = ref<{ id: string; name: string }[]>([]);

async function openDiscount() {
  discountForm.ruleId = '';
  discountForm.manualAmount = 0;
  discountForm.pin = '';
  showDiscount.value = true;
  try {
    const goodsToken = await getToken();
    const { goodsListDiscountRules } = await import('@/api/goods/sale');
    const rules = await goodsListDiscountRules(goodsToken, nsSlug.value);
    discountRules.value = rules.filter((r) => r.isActive !== false);
  } catch (e) {
    logError('[goods/register] openDiscount: loading rules failed', e);
  }
}

async function applyDiscount() {
  if (!activeSale.value) return;
  applyingDiscount.value = true;
  try {
    const goodsToken = await getToken();
    const { goodsApplyCheckDiscount } = await import('@/api/goods/sale');
    activeSale.value = await goodsApplyCheckDiscount(goodsToken, nsSlug.value, {
      saleId: activeSale.value.id,
      discountRuleId: discountForm.ruleId || undefined,
      manualDiscountCents: discountForm.manualAmount ? Math.round(discountForm.manualAmount * 100) : undefined,
      managerPin: discountForm.pin.trim() || undefined,
    });
    showDiscount.value = false;
  } catch (e) {
    logError('[goods/register] applyDiscount failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to apply discount', color: 'red' });
  } finally {
    applyingDiscount.value = false;
  }
}

// --- Search / scan / product grid ---
const query = ref('');
const searching = ref(false);

// The full catalog is already loaded locally (bootstrap), so typing just
// narrows the visible card grid -- no round trip per keystroke. Enter still
// tries an exact barcode lookup first (USB scanner workflow: fast keystrokes
// + Enter), since a scanned code is rarely a substring match on name/sku.
const visibleGoods = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return goods.value;
  return goods.value.filter((g) => g.name.toLowerCase().includes(q) || g.sku.toLowerCase().includes(q));
});

async function onSearchEnter() {
  const raw = query.value.trim();
  if (!raw) return;
  searching.value = true;
  try {
    const goodsToken = await getToken();
    const { goodsFindByBarcode } = await import('@/api/goods/good');
    const byBarcode = await goodsFindByBarcode(goodsToken, nsSlug.value, raw);
    if (byBarcode.found && byBarcode.good && byBarcode.unit) {
      // Weighted-goods barcodes carry the sale quantity in the code itself
      // (grams) instead of a lookup -- assumes a kilogram base unit, the
      // common case for weighted goods. See plan §11.2.
      const quantity = byBarcode.weightedQuantityGrams != null ? byBarcode.weightedQuantityGrams / 1000 : 1;
      await addGoodToCart(byBarcode.good.id, byBarcode.unit.unitId, quantity);
      query.value = '';
      return;
    }
    // Not a barcode -- if exactly one card matches the current filter,
    // Enter adds it directly (fast keyboard-only flow).
    if (visibleGoods.value.length === 1) {
      await addFromCard(visibleGoods.value[0]);
      query.value = '';
    }
  } catch (e) {
    logError('[goods/register] onSearchEnter failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Search failed', color: 'red' });
  } finally {
    searching.value = false;
  }
}

async function addFromCard(good: GoodsGood) {
  await addGoodToCart(good.id, good.baseUnitId, 1);
}

// --- Payment ---
const paying = ref(false);
const showGiftCertPay = ref(false);
const giftCertCode = ref('');

async function payWith(method: GoodsPaymentMethod, giftCertificateCode?: string) {
  if (!activeSale.value) return;
  paying.value = true;
  try {
    const goodsToken = await getToken();
    const { goodsPaySale } = await import('@/api/goods/sale');
    await goodsPaySale(goodsToken, nsSlug.value, activeSale.value.id, [{ method, amountCents: activeSale.value.totalAmountCents, giftCertificateCode }]);
    useToast().add({ title: t('goods.checkoutSuccess'), color: 'green' });
    activeSale.value = null;
    showGiftCertPay.value = false;
    giftCertCode.value = '';
  } catch (e) {
    logError('[goods/register] payWith failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Payment failed', color: 'red' });
  } finally {
    paying.value = false;
  }
}

function payWithGiftCert() {
  if (!giftCertCode.value.trim()) return;
  payWith('GIFT_CERTIFICATE', giftCertCode.value.trim());
}

function formatCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

// --- History: recent sales (cancel-paid-sale) + returns ---
const showHistory = ref(false);
const loadingHistory = ref(false);
const recentSales = ref<GoodsSale[]>([]);
const cancelingSaleId = ref<string | null>(null);
const cancelPin = ref('');

async function openHistory() {
  if (!currentShift.value) return;
  showHistory.value = true;
  loadingHistory.value = true;
  try {
    const goodsToken = await getToken();
    const { goodsListSales } = await import('@/api/goods/sale');
    const { sales } = await goodsListSales(goodsToken, nsSlug.value, { shiftId: currentShift.value.id });
    recentSales.value = sales;
  } catch (e) {
    logError('[goods/register] openHistory failed', e);
  } finally {
    loadingHistory.value = false;
  }
}

async function cancelPaidSale(saleId: string) {
  if (!cancelPin.value.trim()) return;
  try {
    const goodsToken = await getToken();
    const { goodsCancelPaidSale } = await import('@/api/goods/sale');
    await goodsCancelPaidSale(goodsToken, nsSlug.value, saleId, cancelPin.value.trim());
    cancelingSaleId.value = null;
    cancelPin.value = '';
    await openHistory();
  } catch (e) {
    logError('[goods/register] cancelPaidSale failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to cancel sale', color: 'red' });
  }
}

// --- Returns (chit-linked or free) ---
const showReturn = ref(false);
const returnForm = reactive({ originalSaleId: '', reason: '', pin: '' });
type ReturnDraftItem = { goodId: string; quantity: number; amount: number };
const returnDraftItems = ref<ReturnDraftItem[]>([]);
const returnItemDraft = reactive<ReturnDraftItem>({ goodId: '', quantity: 1, amount: 0 });
const creatingReturn = ref(false);

function openReturn(saleId?: string) {
  returnForm.originalSaleId = saleId || '';
  returnForm.reason = '';
  returnForm.pin = '';
  returnDraftItems.value = [];
  showReturn.value = true;
}

function addReturnDraftItem() {
  if (!returnItemDraft.goodId) return;
  returnDraftItems.value.push({ ...returnItemDraft });
  returnItemDraft.goodId = ''; returnItemDraft.quantity = 1; returnItemDraft.amount = 0;
}
function removeReturnDraftItem(idx: number) { returnDraftItems.value.splice(idx, 1); }

async function submitReturn() {
  if (!activeRegister.value || !currentShift.value || !returnDraftItems.value.length) return;
  creatingReturn.value = true;
  try {
    const goodsToken = await getToken();
    const { goodsCreateReturn } = await import('@/api/goods/sale');
    await goodsCreateReturn(goodsToken, nsSlug.value, {
      registerId: activeRegister.value.id,
      shiftId: currentShift.value.id,
      originalSaleId: returnForm.originalSaleId || undefined,
      reason: returnForm.reason.trim(),
      managerPin: returnForm.pin.trim() || undefined,
      items: returnDraftItems.value.map((i) => ({ goodId: i.goodId, quantity: i.quantity, amountCents: Math.round(i.amount * 100) })),
    });
    showReturn.value = false;
    useToast().add({ title: t('common.saved'), color: 'green' });
  } catch (e) {
    logError('[goods/register] submitReturn failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to create return', color: 'red' });
  } finally {
    creatingReturn.value = false;
  }
}

onMounted(bootstrap);
</script>

<template>
  <div class="max-w-[1600px] mx-auto px-4 py-6 space-y-4">
    <!-- Minimal chrome: this is the face of the product -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ t('goods.register') }}</h1>
      <div class="flex items-center gap-1.5 flex-wrap">
        <UButton color="gray" variant="soft" icon="lucide:warehouse" :to="`/${nsSlug}/goods`">
          {{ t('goods.warehouse') }}
        </UButton>
        <template v-if="currentShift">
          <UButton color="gray" variant="ghost" icon="lucide:receipt" size="sm" @click="openXReport">{{ t('goods.xReport') }}</UButton>
          <UButton color="gray" variant="ghost" icon="lucide:banknote" size="sm" @click="showCashMovement = true">{{ t('goods.cashMovement') }}</UButton>
          <UButton color="gray" variant="ghost" icon="lucide:history" size="sm" @click="openHistory">{{ t('goods.history') }}</UButton>
          <UButton color="gray" variant="ghost" icon="lucide:undo-2" size="sm" @click="openReturn()">{{ t('goods.freeReturn') }}</UButton>
          <UButton color="gray" variant="ghost" icon="lucide:log-out" size="sm" @click="showCloseShift = true">
            {{ t('goods.closeShift') }}
          </UButton>
        </template>
      </div>
    </div>

    <div v-if="loading" class="text-center py-16 text-gray-400">
      <Icon name="lucide:loader" class="w-6 h-6 animate-spin mx-auto" />
    </div>

    <!-- No register yet on this warehouse -->
    <div v-else-if="!activeRegister" class="max-w-md mx-auto rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 text-center space-y-3">
      <Icon name="lucide:store" class="w-8 h-8 mx-auto text-gray-400" />
      <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('goods.noRegisterYet') }}</p>
      <UButton v-if="isOwnerOrManager" color="primary" :loading="creatingRegister" @click="createRegisterHere">
        {{ t('goods.createRegister') }}
      </UButton>
    </div>

    <!-- No open shift -->
    <div v-else-if="!currentShift" class="max-w-md mx-auto rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 space-y-4">
      <p class="text-sm text-gray-500 dark:text-gray-400 text-center">{{ t('goods.openShift') }}</p>
      <UFormGroup :label="t('goods.openingCash')">
        <UInput v-model.number="openingCash" type="number" min="0" step="0.01" size="lg" @keyup.enter="openShift" />
      </UFormGroup>
      <UButton block color="primary" :loading="shiftBusy" @click="openShift">{{ t('goods.openShift') }}</UButton>
    </div>

    <!-- POS -->
    <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:h-[calc(100vh-8.5rem)]" data-tour="goods-register-pos">
      <!-- Product picker: 2/3 -->
      <div class="lg:col-span-2 flex flex-col min-h-0 gap-3">
        <UInput
          v-model="query"
          size="xl"
          icon="lucide:scan-barcode"
          :placeholder="t('goods.search')"
          :loading="searching"
          autofocus
          @keyup.enter="onSearchEnter"
        />

        <div class="flex-1 overflow-y-auto -mx-1 px-1">
          <div v-if="visibleGoods.length" class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 pb-2">
            <button
              v-for="g in visibleGoods"
              :key="g.id"
              type="button"
              class="group text-left rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden transition-all duration-150 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-md active:scale-[0.97]"
              @click="addFromCard(g)"
            >
              <div class="aspect-square bg-gray-50 dark:bg-gray-800/60 flex items-center justify-center overflow-hidden">
                <img v-if="g.imageUrl" :src="g.imageUrl" :alt="g.name" class="w-full h-full object-cover" />
                <Icon v-else name="lucide:package" class="w-8 h-8 text-gray-300 dark:text-gray-700" />
              </div>
              <div class="p-2.5 space-y-0.5">
                <div class="text-sm font-medium text-gray-900 dark:text-white line-clamp-2 leading-tight min-h-[2.2em]">{{ g.name }}</div>
                <div class="text-sm font-semibold text-primary-600 dark:text-primary-400 tabular-nums">{{ formatCents(g.salePriceCents) }}</div>
              </div>
            </button>
          </div>
          <div v-else class="h-full flex flex-col items-center justify-center text-center text-sm text-gray-400 py-16">
            <Icon name="lucide:search-x" class="w-8 h-8 mb-2 text-gray-300 dark:text-gray-700" />
            {{ t('goods.noResults') }}
          </div>
        </div>
      </div>

      <!-- Cart + calculator: 1/3, pinned totals/payment at the bottom -->
      <div class="flex flex-col min-h-0 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        <div class="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-shrink-0">
          <span class="font-medium text-sm text-gray-500 dark:text-gray-400">{{ t('goods.cart') }}</span>
          <UButton v-if="activeSale?.items?.length" color="red" variant="ghost" size="2xs" icon="lucide:trash-2" @click="voidCart">{{ t('goods.voidSale') }}</UButton>
        </div>

        <UInput
          v-if="!activeSale"
          v-model="clientIdInput"
          size="sm"
          icon="lucide:user"
          :placeholder="t('goods.attachClient')"
          class="mx-3 mt-3 flex-shrink-0"
        />

        <div class="flex-1 overflow-y-auto min-h-0">
          <div v-if="!activeSale?.items?.length" class="h-full flex flex-col items-center justify-center px-4 text-center text-sm text-gray-400">
            <Icon name="lucide:shopping-cart" class="w-8 h-8 mb-2 text-gray-300 dark:text-gray-700" />
            {{ t('goods.emptyCart') }}
          </div>
          <div v-else class="divide-y divide-gray-100 dark:divide-gray-800">
            <div v-for="item in activeSale.items" :key="item.id" class="flex items-center justify-between px-4 py-2.5 text-sm">
              <div class="min-w-0">
                <div class="font-medium text-gray-900 dark:text-white truncate">{{ goodNameById.get(item.goodId) || item.goodId }}</div>
                <div class="text-gray-400 tabular-nums">{{ item.quantity }} × {{ formatCents(item.priceAtSaleCents) }}</div>
              </div>
              <div class="flex items-center gap-2 flex-shrink-0">
                <span class="font-semibold tabular-nums">{{ formatCents(item.totalCents) }}</span>
                <UButton color="gray" variant="ghost" icon="lucide:x" size="2xs" @click="removeCartItem(item.id)" />
              </div>
            </div>
          </div>
        </div>

        <!-- Calculator: totals + payment, always visible at the bottom -->
        <div class="flex-shrink-0 border-t border-gray-100 dark:border-gray-800">
          <div v-if="activeSale?.items?.length" class="px-4 py-2.5 flex items-center justify-between text-sm border-b border-gray-100 dark:border-gray-800">
            <button type="button" class="text-primary-600 dark:text-primary-400 font-medium" @click="openDiscount">
              {{ t('goods.applyDiscount') }}
            </button>
            <span v-if="activeSale.discountAmountCents" class="text-gray-400 tabular-nums">− {{ formatCents(activeSale.discountAmountCents) }}</span>
          </div>
          <div class="px-4 py-3 flex items-center justify-between">
            <span class="text-sm text-gray-500 dark:text-gray-400">{{ t('goods.total') }}</span>
            <span class="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{{ activeSale?.items?.length ? formatCents(activeSale.totalAmountCents) : '0.00' }}</span>
          </div>
          <div v-if="activeSale?.items?.length" class="px-4 pb-4 grid grid-cols-2 gap-2">
            <UButton block size="lg" color="primary" :loading="paying" class="col-span-2 justify-center" @click="payWith('CASH')">
              <Icon name="lucide:banknote" class="w-4 h-4 mr-1.5" /> {{ t('goods.payCash') }}
            </UButton>
            <UButton block size="lg" color="primary" variant="soft" :loading="paying" class="justify-center" @click="payWith('CARD')">
              <Icon name="lucide:credit-card" class="w-4 h-4 mr-1.5" /> {{ t('goods.payCard') }}
            </UButton>
            <UButton block size="lg" color="gray" variant="soft" :loading="paying" class="justify-center" @click="showGiftCertPay = true">
              <Icon name="lucide:gift" class="w-4 h-4 mr-1.5" /> {{ t('goods.payGiftCert') }}
            </UButton>
          </div>
        </div>
      </div>
    </div>

    <UModal v-model="showCloseShift">
      <UCard>
        <template #header>
          <h3 class="font-semibold">{{ t('goods.closeShift') }}</h3>
        </template>
        <UFormGroup :label="t('goods.closingCash')">
          <UInput v-model.number="closingCash" type="number" min="0" step="0.01" size="lg" @keyup.enter="closeShift" />
        </UFormGroup>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="ghost" @click="showCloseShift = false">{{ t('common.cancel') }}</UButton>
            <UButton color="primary" :loading="shiftBusy" @click="closeShift">{{ t('goods.closeShift') }}</UButton>
          </div>
        </template>
      </UCard>
    </UModal>

    <!-- X/Z shift report -->
    <UModal v-model="showShiftReport">
      <UCard>
        <template #header><h3 class="font-semibold">{{ shiftReport?.status === 'CLOSED' ? t('goods.zReport') : t('goods.xReport') }}</h3></template>
        <div v-if="loadingShiftReport" class="text-center py-6 text-gray-400"><Icon name="lucide:loader" class="w-5 h-5 animate-spin mx-auto" /></div>
        <div v-else-if="shiftReport" class="space-y-2 text-sm">
          <div class="flex justify-between"><span class="text-gray-400">{{ t('goods.openingCash') }}</span><span>{{ formatCents(shiftReport.openingCashAmountCents) }}</span></div>
          <div class="flex justify-between"><span class="text-gray-400">{{ t('goods.expectedCash') }}</span><span class="font-semibold">{{ formatCents(shiftReport.expectedCashAmountCents) }}</span></div>
          <div v-if="shiftReport.closingCashAmountCents != null" class="flex justify-between"><span class="text-gray-400">{{ t('goods.closingCash') }}</span><span>{{ formatCents(shiftReport.closingCashAmountCents) }}</span></div>
          <div v-if="shiftReport.closingCashAmountCents != null" class="flex justify-between">
            <span class="text-gray-400">{{ t('goods.discrepancy') }}</span>
            <span :class="shiftReport.discrepancyCents === 0 ? '' : shiftReport.discrepancyCents > 0 ? 'text-green-600' : 'text-red-600'">{{ formatCents(shiftReport.discrepancyCents) }}</span>
          </div>
        </div>
        <template #footer>
          <div class="flex justify-end"><UButton color="gray" variant="ghost" @click="showShiftReport = false">{{ t('common.close') }}</UButton></div>
        </template>
      </UCard>
    </UModal>

    <!-- Cash in/out -->
    <UModal v-model="showCashMovement">
      <UCard>
        <template #header><h3 class="font-semibold">{{ t('goods.cashMovement') }}</h3></template>
        <div class="space-y-3">
          <USelectMenu
            v-model="cashMovementForm.type"
            :options="[{ label: t('goods.cashIn'), value: 'CASH_IN' }, { label: t('goods.cashOut'), value: 'CASH_OUT' }]"
            value-attribute="value" option-attribute="label" :popper="{ strategy: 'fixed' }"
          />
          <UInput v-model.number="cashMovementForm.amount" type="number" min="0" step="0.01" size="lg" :placeholder="t('goods.balance')" />
          <UInput v-model="cashMovementForm.reason" :placeholder="t('goods.reason')" @keyup.enter="recordCashMovement" />
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="ghost" @click="showCashMovement = false">{{ t('common.cancel') }}</UButton>
            <UButton color="primary" :loading="recordingCashMovement" :disabled="!cashMovementForm.amount" @click="recordCashMovement">{{ t('common.save') }}</UButton>
          </div>
        </template>
      </UCard>
    </UModal>

    <!-- Check-level discount -->
    <UModal v-model="showDiscount">
      <UCard>
        <template #header><h3 class="font-semibold">{{ t('goods.applyDiscount') }}</h3></template>
        <div class="space-y-3">
          <UFormGroup v-if="discountRules.length" :label="t('goods.discountRule')">
            <USelectMenu
              v-model="discountForm.ruleId"
              :options="[{ label: t('common.none'), value: '' }, ...discountRules.map((r) => ({ label: r.name, value: r.id }))]"
              value-attribute="value" option-attribute="label" :popper="{ strategy: 'fixed' }"
            />
          </UFormGroup>
          <UFormGroup :label="t('goods.manualDiscount')">
            <UInput v-model.number="discountForm.manualAmount" type="number" min="0" step="0.01" />
          </UFormGroup>
          <UFormGroup :label="t('goods.managerPin')">
            <UInput v-model="discountForm.pin" type="password" placeholder="••••" @keyup.enter="applyDiscount" />
          </UFormGroup>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="ghost" @click="showDiscount = false">{{ t('common.cancel') }}</UButton>
            <UButton color="primary" :loading="applyingDiscount" @click="applyDiscount">{{ t('common.save') }}</UButton>
          </div>
        </template>
      </UCard>
    </UModal>

    <!-- Gift certificate payment -->
    <UModal v-model="showGiftCertPay">
      <UCard>
        <template #header><h3 class="font-semibold">{{ t('goods.payGiftCert') }}</h3></template>
        <UFormGroup :label="t('goods.giftCertCode')">
          <UInput v-model="giftCertCode" placeholder="XXXX-XXXX" @keyup.enter="payWithGiftCert" />
        </UFormGroup>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="ghost" @click="showGiftCertPay = false">{{ t('common.cancel') }}</UButton>
            <UButton color="primary" :loading="paying" :disabled="!giftCertCode.trim()" @click="payWithGiftCert">{{ t('common.ok') }}</UButton>
          </div>
        </template>
      </UCard>
    </UModal>

    <!-- History: recent sales, cancel + return -->
    <UModal v-model="showHistory" :ui="{ width: 'sm:max-w-xl' }">
      <UCard>
        <template #header><h3 class="font-semibold">{{ t('goods.history') }}</h3></template>
        <div v-if="loadingHistory" class="text-center py-6 text-gray-400"><Icon name="lucide:loader" class="w-5 h-5 animate-spin mx-auto" /></div>
        <div v-else-if="!recentSales.length" class="text-center py-6 text-sm text-gray-400">—</div>
        <div v-else class="divide-y divide-gray-100 dark:divide-gray-800">
          <div v-for="s in recentSales" :key="s.id" class="py-2.5 space-y-1.5">
            <div class="flex items-center justify-between text-sm">
              <span class="font-medium">{{ s.number }}</span>
              <div class="flex items-center gap-2">
                <UBadge color="gray" variant="soft">{{ s.status }}</UBadge>
                <span class="font-semibold">{{ formatCents(s.totalAmountCents) }}</span>
              </div>
            </div>
            <div v-if="s.status === 'PAID'" class="flex items-center gap-2">
              <UButton size="2xs" color="gray" variant="soft" @click="openReturn(s.id)">{{ t('goods.return') }}</UButton>
              <template v-if="cancelingSaleId === s.id">
                <UInput v-model="cancelPin" type="password" size="2xs" class="w-24" :placeholder="t('goods.managerPin')" />
                <UButton size="2xs" color="red" @click="cancelPaidSale(s.id)">{{ t('common.ok') }}</UButton>
              </template>
              <UButton v-else size="2xs" color="red" variant="ghost" @click="cancelingSaleId = s.id">{{ t('goods.cancelSale') }}</UButton>
            </div>
          </div>
        </div>
        <template #footer>
          <div class="flex justify-end"><UButton color="gray" variant="ghost" @click="showHistory = false">{{ t('common.close') }}</UButton></div>
        </template>
      </UCard>
    </UModal>

    <!-- Return (chit-linked or free) -->
    <UModal v-model="showReturn" :ui="{ width: 'sm:max-w-lg' }">
      <UCard>
        <template #header><h3 class="font-semibold">{{ returnForm.originalSaleId ? t('goods.return') : t('goods.freeReturn') }}</h3></template>
        <div class="space-y-3">
          <UFormGroup :label="t('goods.reason')">
            <UInput v-model="returnForm.reason" />
          </UFormGroup>
          <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-3 space-y-2">
            <div class="grid grid-cols-4 gap-2 items-end">
              <UInput v-model="returnItemDraft.goodId" size="sm" placeholder="Good ID" class="col-span-2" />
              <UInput v-model.number="returnItemDraft.quantity" type="number" min="0" size="sm" placeholder="Qty" />
              <UInput v-model.number="returnItemDraft.amount" type="number" min="0" step="0.01" size="sm" placeholder="Amount" />
            </div>
            <UButton size="xs" color="gray" variant="soft" icon="lucide:plus" @click="addReturnDraftItem">{{ t('common.add') }}</UButton>
            <div v-if="returnDraftItems.length" class="divide-y divide-gray-100 dark:divide-gray-800 mt-2">
              <div v-for="(item, idx) in returnDraftItems" :key="idx" class="flex items-center justify-between text-sm py-1.5">
                <span>{{ goodNameById.get(item.goodId) || item.goodId }} — {{ item.quantity }} · {{ formatCents(Math.round(item.amount * 100)) }}</span>
                <UButton size="2xs" color="red" variant="ghost" icon="lucide:x" @click="removeReturnDraftItem(idx)" />
              </div>
            </div>
          </div>
          <UFormGroup v-if="!returnForm.originalSaleId" :label="t('goods.managerPin')">
            <UInput v-model="returnForm.pin" type="password" placeholder="••••" />
          </UFormGroup>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="ghost" @click="showReturn = false">{{ t('common.cancel') }}</UButton>
            <UButton color="primary" :loading="creatingReturn" :disabled="!returnDraftItems.length" @click="submitReturn">{{ t('common.save') }}</UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>
