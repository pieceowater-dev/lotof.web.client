<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useGoodsAuth } from '@/composables/useGoodsAuth';
import { useGoodsStaffRole } from '@/composables/useGoodsStaffRole';
import { useNamespace } from '@/composables/useNamespace';
import { useOnboarding } from '@/composables/useOnboarding';
import { goodsRegisterTour } from '@/config/tours';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import type { GoodsWarehouse } from '@/api/goods/warehouse';
import type { GoodsRegister, GoodsCashShift } from '@/api/goods/register';
import type { GoodsSale, GoodsSaleStatus, GoodsPaymentMethod, GoodsCashMovementType } from '@/api/goods/sale';
import type { GoodsGood } from '@/api/goods/good';
import type { GoodsCategory } from '@/api/goods/category';
import type { GoodsStock } from '@/api/goods/stock';
import { formatMoney } from '@/utils/currency';
import { playScannerBeep } from '@/utils/scannerBeep';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const { titleBySlug } = useNamespace();
const { isOwnerOrManager } = useGoodsStaffRole();

useHead(() => ({
  title: titleBySlug(nsSlug.value) ? `${t('goods.register')} — ${titleBySlug(nsSlug.value)}` : t('goods.register'),
}));

const { getToken: getGoodsTokenRaw } = useGoodsAuth();
async function getToken(): Promise<string> {
  return getGoodsTokenRaw(nsSlug.value);
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
const categories = ref<GoodsCategory[]>([]);
const stockByGoodId = ref<Map<string, GoodsStock>>(new Map());
const currencyCode = ref<string>('KZT');
const activeCategoryId = ref<string | null>(null);

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

      // Resume an already-open sale for this register+shift instead of
      // silently abandoning it -- a reload used to lose the in-progress
      // cart from view entirely while the backend kept holding its stock
      // reservation forever (nothing ever re-discovers and voids it), which
      // is how "insufficient stock" errors could show up for items that
      // were actually available.
      if (currentShift.value) {
        const { goodsListSales } = await import('@/api/goods/sale');
        const { sales } = await goodsListSales(goodsToken, nsSlug.value, {
          registerId: activeRegister.value.id,
          shiftId: currentShift.value.id,
        });
        activeSale.value = sales.find((s) => s.status === 'OPEN') || null;
      }
    }

    const { goodsListGoods } = await import('@/api/goods/good');
    const { goods: g } = await goodsListGoods(goodsToken, nsSlug.value);
    goods.value = g.filter((x) => x.isActive);
    goodNameById.value = new Map(g.map((x) => [x.id, x.name]));

    const { goodsListCategories } = await import('@/api/goods/category');
    const { categories: c } = await goodsListCategories(goodsToken, nsSlug.value);
    categories.value = c.filter((x) => x.isActive && !x.parentId).sort((a, b) => a.sortOrder - b.sortOrder);

    if (activeWarehouseId.value) {
      const { goodsListStock } = await import('@/api/goods/stock');
      const { stock } = await goodsListStock(goodsToken, nsSlug.value, { warehouseId: activeWarehouseId.value });
      stockByGoodId.value = new Map(stock.map((s) => [s.goodId, s]));
    }

    const { goodsGetSettings } = await import('@/api/goods/settings');
    const settings = await goodsGetSettings(goodsToken, nsSlug.value);
    currencyCode.value = settings.currency;
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

// Tracks which good is mid-flight so the same tile can show a spinner and
// double-taps (very easy to do on a touchscreen register) don't fire a
// second overlapping request for the same good.
const addingGoodId = ref<string | null>(null);
// Tracks which cart line is mid-flight (stepper +/- or remove) the same way.
const busyCartItemId = ref<string | null>(null);

async function addGoodToCart(goodId: string, unitId: string, quantity: number) {
  addingGoodId.value = goodId;
  try {
    const goodsToken = await getToken();
    const sale = await ensureSale();
    // Scanning/tapping the same good again should top up its existing line
    // rather than create a second one -- two separate lines for the same good
    // each reserve stock independently and can trip a false "insufficient
    // stock" error at payment time even when the combined quantity is fine.
    const existing = (sale.items || []).find((i) => i.goodId === goodId && i.unitId === unitId && !i.discountRuleId && !i.discountCents);
    if (existing) {
      const { goodsUpdateSaleItem } = await import('@/api/goods/sale');
      activeSale.value = await goodsUpdateSaleItem(goodsToken, nsSlug.value, {
        saleItemId: existing.id,
        quantity: existing.quantity + quantity,
      });
      return;
    }
    const { goodsAddSaleItem } = await import('@/api/goods/sale');
    activeSale.value = await goodsAddSaleItem(goodsToken, nsSlug.value, sale.id, goodId, unitId, quantity);
  } catch (e) {
    logError('[goods/register] addGoodToCart failed', e);
    useToast().add({ title: getErrorMessage(e, t) || t('goods.addToCartFailed'), color: 'red' });
  } finally {
    addingGoodId.value = null;
  }
}

async function removeCartItem(saleItemId: string) {
  if (!activeSale.value) return;
  busyCartItemId.value = saleItemId;
  try {
    const goodsToken = await getToken();
    const { goodsRemoveSaleItem } = await import('@/api/goods/sale');
    activeSale.value = await goodsRemoveSaleItem(goodsToken, nsSlug.value, saleItemId);
  } catch (e) {
    logError('[goods/register] removeCartItem failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to remove item', color: 'red' });
  } finally {
    busyCartItemId.value = null;
  }
}

// Inline +/- steppers on each cart line -- quantity 0 removes the line the
// same way the explicit remove button does, so dragging the stepper down
// to zero doesn't leave a dangling zero-quantity item.
async function changeCartItemQty(item: { id: string; quantity: number }, delta: number) {
  if (!activeSale.value) return;
  const nextQty = item.quantity + delta;
  if (nextQty <= 0) {
    await removeCartItem(item.id);
    return;
  }
  busyCartItemId.value = item.id;
  try {
    const goodsToken = await getToken();
    const { goodsUpdateSaleItem } = await import('@/api/goods/sale');
    activeSale.value = await goodsUpdateSaleItem(goodsToken, nsSlug.value, { saleItemId: item.id, quantity: nextQty });
  } catch (e) {
    logError('[goods/register] changeCartItemQty failed', e);
    useToast().add({ title: getErrorMessage(e, t) || t('goods.addToCartFailed'), color: 'red' });
  } finally {
    busyCartItemId.value = null;
  }
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
  let list = activeCategoryId.value ? goods.value.filter((g) => g.categoryId === activeCategoryId.value) : goods.value;
  if (q) list = list.filter((g) => g.name.toLowerCase().includes(q) || g.sku.toLowerCase().includes(q));
  return list;
});

function stockFor(goodId: string): GoodsStock | undefined {
  return stockByGoodId.value.get(goodId);
}
// Only goods that actually track stock can be "out" -- a service or a good
// with stock tracking off is always sellable regardless of what's in this map.
function isOutOfStock(good: GoodsGood): boolean {
  if (!good.trackStock) return false;
  const s = stockFor(good.id);
  return !!s && s.available <= 0;
}

async function onSearchEnter() {
  const raw = query.value.trim();
  if (!raw) return;
  // Beeps immediately, before the lookup even resolves -- a real scanner
  // beeps the instant it decodes the code, not once the sale item lands.
  playScannerBeep();
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
  // Return focus to the search box after every add -- the default,
  // "ready" state for this page is always the search input, so a
  // keyboard-only cashier lands back there for the next scan/search
  // instead of having to navigate the grid again from scratch.
  focusSearchInput();
}

// --- Keyboard-only navigation: search input <-> product grid ---
// The grid is always exactly 4 columns wide (see the square-card layout
// above), so stepping an index by +-1 moves left/right and by +-COLS
// moves up/down a row while staying in the same column.
const COLS = 4;
const searchInputRef = ref<{ input?: HTMLInputElement } | null>(null);
const cardButtons = ref<HTMLButtonElement[]>([]);

function focusSearchInput() {
  searchInputRef.value?.input?.focus();
}

function isCardDisabled(g: GoodsGood): boolean {
  return isOutOfStock(g) || addingGoodId.value === g.id;
}

// Walks the flat visibleGoods list from `start` in `step` increments until
// it finds a focusable (non-disabled) card, so arrow navigation skips over
// out-of-stock tiles instead of silently getting stuck on one.
function nextFocusableIndex(start: number, step: number): number | null {
  let i = start;
  while (i >= 0 && i < visibleGoods.value.length) {
    if (!isCardDisabled(visibleGoods.value[i])) return i;
    i += step;
  }
  return null;
}

function focusCard(index: number) {
  cardButtons.value[index]?.focus();
}

function onSearchKeydown(e: KeyboardEvent) {
  if (e.key !== 'ArrowDown' || !visibleGoods.value.length) return;
  e.preventDefault();
  const target = nextFocusableIndex(0, 1);
  if (target !== null) focusCard(target);
}

function onCardKeydown(e: KeyboardEvent, index: number) {
  switch (e.key) {
    case 'ArrowRight': {
      e.preventDefault();
      const next = nextFocusableIndex(index + 1, 1);
      if (next !== null) focusCard(next);
      break;
    }
    case 'ArrowLeft': {
      e.preventDefault();
      const prev = nextFocusableIndex(index - 1, -1);
      if (prev !== null) focusCard(prev);
      else focusSearchInput();
      break;
    }
    case 'ArrowDown': {
      e.preventDefault();
      const next = nextFocusableIndex(index + COLS, COLS);
      if (next !== null) focusCard(next);
      break;
    }
    case 'ArrowUp': {
      e.preventDefault();
      const prev = nextFocusableIndex(index - COLS, -COLS);
      if (prev !== null) focusCard(prev);
      else focusSearchInput();
      break;
    }
    case 'Escape':
      e.preventDefault();
      focusSearchInput();
      break;
    // Enter/Space are left alone -- a native <button> already fires @click
    // (i.e. addFromCard) on both, no extra handling needed.
  }
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
  return formatMoney(cents / 100, currencyCode.value);
}

const SALE_STATUS_LABELS: Record<GoodsSaleStatus, string> = {
  OPEN: t('goods.saleStatusOpen'), PAID: t('goods.saleStatusPaid'), VOID: t('goods.saleStatusVoid'),
  REFUNDED: t('goods.saleStatusRefunded'), PARTIALLY_REFUNDED: t('goods.saleStatusPartiallyRefunded'),
};
const SALE_STATUS_COLORS: Record<GoodsSaleStatus, any> = {
  OPEN: 'primary', PAID: 'green', VOID: 'gray', REFUNDED: 'red', PARTIALLY_REFUNDED: 'amber',
};

// --- History: recent sales (cancel-paid-sale) + returns ---
const showHistory = ref(false);
const loadingHistory = ref(false);
const recentSales = ref<GoodsSale[]>([]);
const cancelingSaleId = ref<string | null>(null);
const cancelPin = ref('');

// Sales created before the SaleCounter fix (and any future edge case where
// allocation somehow didn't run) have an empty `number` -- fall back to the
// sale's time so the row never renders with a blank title.
function saleTitle(s: GoodsSale): string {
  if (s.number) return `№${s.number}`;
  return new Date(s.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

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

// Suggests the refund amount from the good's current sale price the moment
// it's picked -- still a plain editable field afterward, since a real
// refund amount can legitimately differ (a discount was applied, price
// changed since the original sale, partial refund, etc).
function onReturnGoodSelected(goodId: string) {
  const good = goods.value.find((g) => g.id === goodId);
  if (good) returnItemDraft.amount = (good.salePriceCents * returnItemDraft.quantity) / 100;
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

onMounted(async () => {
  await bootstrap();

  if (process.client) {
    const { isCompleted, startTour } = useOnboarding();
    if (activeRegister.value && currentShift.value && !isCompleted(goodsRegisterTour.id)) {
      setTimeout(() => startTour(goodsRegisterTour), 1000);
    }
  }
});
</script>

<template>
  <div class="h-full flex flex-col p-4 pb-safe-or-4 min-h-0 max-w-[1600px] mx-auto w-full space-y-3 tabular-nums">
    <!-- Top bar -->
    <div class="flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
      <div class="flex items-center gap-2.5">
        <div class="w-9 h-9 rounded-xl bg-primary-500/10 flex items-center justify-center flex-shrink-0">
          <Icon name="lucide:store" class="w-5 h-5 text-primary-600 dark:text-primary-400" />
        </div>
        <div class="min-w-0">
          <h1 class="text-lg font-bold leading-tight text-gray-900 dark:text-white truncate">{{ t('goods.register') }}</h1>
          <p v-if="activeRegister" class="text-xs text-gray-400 truncate">{{ activeRegister.name }}</p>
        </div>
      </div>
      <div class="flex items-center gap-1.5 flex-wrap">
        <UButton color="gray" variant="soft" icon="lucide:warehouse" size="sm" :to="`/${nsSlug}/goods`">
          {{ t('goods.warehouse') }}
        </UButton>
        <template v-if="currentShift">
          <!-- Real flex box (not display:contents) so the tour can measure it
               -- a `contents` element has a zero-size rect and the highlight
               lands in the top-left corner. -->
          <div data-tour="goods-register-shift-actions" class="flex items-center gap-1.5 flex-wrap">
            <UButton color="gray" variant="ghost" icon="lucide:receipt" size="sm" @click="openXReport">{{ t('goods.xReport') }}</UButton>
            <UButton color="gray" variant="ghost" icon="lucide:banknote" size="sm" @click="showCashMovement = true">{{ t('goods.cashMovement') }}</UButton>
            <UButton color="gray" variant="ghost" icon="lucide:history" size="sm" @click="openHistory">{{ t('goods.history') }}</UButton>
            <UButton color="gray" variant="ghost" icon="lucide:undo-2" size="sm" @click="openReturn()">{{ t('goods.freeReturn') }}</UButton>
            <span class="w-px h-5 bg-gray-200 dark:bg-gray-800 mx-0.5" />
            <UButton color="red" variant="soft" icon="lucide:log-out" size="sm" @click="showCloseShift = true">
              {{ t('goods.closeShift') }}
            </UButton>
          </div>
        </template>
      </div>
    </div>

    <div v-if="loading" class="flex-1 min-h-0 flex items-center justify-center text-gray-400">
      <Icon name="lucide:loader" class="w-6 h-6 animate-spin mx-auto" />
    </div>

    <!-- No register yet on this warehouse -->
    <div v-else-if="!activeRegister" class="flex-1 min-h-0 flex items-center justify-center">
      <div class="max-w-md w-full rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 text-center space-y-3">
        <div class="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto">
          <Icon name="lucide:store" class="w-7 h-7 text-gray-400" />
        </div>
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('goods.noRegisterYet') }}</p>
        <UButton v-if="isOwnerOrManager" color="primary" size="lg" :loading="creatingRegister" @click="createRegisterHere">
          {{ t('goods.createRegister') }}
        </UButton>
      </div>
    </div>

    <!-- No open shift -->
    <div v-else-if="!currentShift" class="flex-1 min-h-0 flex items-center justify-center">
      <div class="max-w-md w-full rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 space-y-4">
        <div class="w-14 h-14 rounded-2xl bg-primary-500/10 flex items-center justify-center mx-auto">
          <Icon name="lucide:lock-keyhole-open" class="w-7 h-7 text-primary-600 dark:text-primary-400" />
        </div>
        <p class="text-sm text-gray-500 dark:text-gray-400 text-center">{{ t('goods.openShift') }}</p>
        <UFormGroup :label="t('goods.openingCash')">
          <UInput v-model.number="openingCash" type="number" min="0" step="0.01" size="xl" @keyup.enter="openShift" />
        </UFormGroup>
        <UButton block size="xl" color="primary" :loading="shiftBusy" @click="openShift">{{ t('goods.openShift') }}</UButton>
      </div>
    </div>

    <!-- POS -->
    <div
      v-else
      data-tour="goods-register-pos"
      class="flex-1 min-h-0 grid grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-rows-1 lg:grid-cols-3 gap-4"
    >
      <!-- Product picker: 2/3 -->
      <div class="lg:col-span-2 flex flex-col min-h-0 gap-3">
        <UInput
          ref="searchInputRef"
          v-model="query"
          data-tour="goods-register-search"
          size="xl"
          icon="lucide:scan-barcode"
          :placeholder="t('goods.search')"
          :loading="searching"
          autofocus
          :ui="{ base: 'text-base' }"
          @keyup.enter="onSearchEnter"
          @keydown="onSearchKeydown"
        />

        <!-- Category tabs -->
        <div v-if="categories.length" class="flex items-center gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1 flex-shrink-0">
          <button
            type="button"
            class="flex-shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap"
            :class="activeCategoryId === null
              ? 'bg-primary-500 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'"
            @click="activeCategoryId = null"
          >
            {{ t('goods.allCategories') }}
          </button>
          <button
            v-for="c in categories"
            :key="c.id"
            type="button"
            class="flex-shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap"
            :class="activeCategoryId === c.id
              ? 'bg-primary-500 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'"
            @click="activeCategoryId = c.id"
          >
            {{ c.name }}
          </button>
        </div>

        <div data-tour="goods-register-products" class="flex-1 overflow-y-auto -mx-1 px-1">
          <div v-if="visibleGoods.length" class="grid grid-cols-4 gap-3 pb-2">
            <!-- padding-bottom:100% (not the aspect-ratio property) makes a
                 responsive square whose height always equals its own resolved
                 width -- aspect-ratio's interaction with CSS Grid's auto row
                 sizing on a flex-col box with real content proved unreliable
                 here (it either overflowed past square or collapsed to
                 near-zero); this padding trick is a much older, unambiguous
                 mechanism and isn't affected by that. -->
            <div v-for="(g, idx) in visibleGoods" :key="g.id" class="relative w-full" style="padding-bottom: 100%">
              <button
                ref="cardButtons"
                type="button"
                :disabled="isOutOfStock(g) || addingGoodId === g.id"
                class="group absolute inset-0 flex flex-col text-left rounded-2xl border bg-white dark:bg-gray-900 overflow-hidden transition-all duration-150 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
                :class="isOutOfStock(g)
                  ? 'border-gray-200 dark:border-gray-800 opacity-50'
                  : 'border-gray-200 dark:border-gray-800 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-lg active:scale-[0.97] active:shadow-sm'"
                @click="addFromCard(g)"
                @keydown="(e) => onCardKeydown(e as KeyboardEvent, idx)"
              >
                <div class="flex-1 min-h-0 bg-gray-50 dark:bg-gray-800/60 flex items-center justify-center overflow-hidden relative">
                  <img v-if="g.imageUrl" :src="g.imageUrl" :alt="g.name" class="w-full h-full object-cover" />
                  <Icon v-else name="lucide:package" class="w-9 h-9 text-gray-300 dark:text-gray-700" />
                  <span
                    v-if="isOutOfStock(g)"
                    class="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-gray-900/80 text-white text-[10px] font-semibold uppercase tracking-wide"
                  >{{ t('goods.outOfStock') }}</span>
                  <div v-if="addingGoodId === g.id" class="absolute inset-0 bg-white/70 dark:bg-gray-900/70 flex items-center justify-center">
                    <Icon name="lucide:loader" class="w-5 h-5 animate-spin text-primary-600" />
                  </div>
                </div>
                <!-- Fixed height, not flex-shrink-0 -- a shrink-0 block still
                     claims its full content-based size as its flex-basis,
                     which could force this taller than the square. A fixed
                     height + overflow-hidden caps it regardless of content,
                     so the image above (flex-1 min-h-0) absorbs the rest. -->
                <div class="h-[5.25rem] overflow-hidden p-2.5 space-y-0.5 text-left">
                  <div class="text-sm font-medium text-gray-900 dark:text-white line-clamp-2 leading-tight min-h-[2.2em]">{{ g.name }}</div>
                  <div class="text-base font-bold text-primary-600 dark:text-primary-400 tabular-nums">{{ formatCents(g.salePriceCents) }}</div>
                </div>
              </button>
            </div>
          </div>
          <div v-else class="h-full flex flex-col items-center justify-center text-center text-sm text-gray-400 py-16">
            <Icon name="lucide:search-x" class="w-8 h-8 mb-2 text-gray-300 dark:text-gray-700" />
            {{ t('goods.noResults') }}
          </div>
        </div>
      </div>

      <!-- Cart + calculator: 1/3, pinned totals/payment at the bottom -->
      <div data-tour="goods-register-cart" class="flex flex-col min-h-0 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden shadow-sm">
        <div class="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-shrink-0">
          <span class="font-semibold text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
            <Icon name="lucide:shopping-cart" class="w-4 h-4 text-gray-400" />
            {{ t('goods.cart') }}
            <span v-if="activeSale?.items?.length" class="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-primary-500 text-white text-[11px] font-bold">
              {{ activeSale.items.length }}
            </span>
          </span>
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
          <div v-if="!activeSale?.items?.length" class="h-full flex flex-col items-center justify-center px-6 text-center text-sm text-gray-400">
            <Icon name="lucide:shopping-cart" class="w-10 h-10 mb-3 text-gray-200 dark:text-gray-800" />
            {{ t('goods.emptyCart') }}
          </div>
          <div v-else class="divide-y divide-gray-100 dark:divide-gray-800">
            <div v-for="item in activeSale.items" :key="item.id" class="flex items-center gap-2 px-4 py-2.5 text-sm">
              <div class="min-w-0 flex-1">
                <div class="font-medium text-gray-900 dark:text-white truncate">{{ goodNameById.get(item.goodId) || t('goods.unknownItem') }}</div>
                <div class="text-gray-400 tabular-nums text-xs">{{ formatCents(item.priceAtSaleCents) }} {{ t('goods.perUnit') }}</div>
              </div>

              <div class="flex items-center gap-1 flex-shrink-0 rounded-lg bg-gray-50 dark:bg-gray-800/70 p-0.5">
                <button
                  type="button"
                  :disabled="busyCartItemId === item.id"
                  class="w-6 h-6 flex items-center justify-center rounded-md text-gray-500 hover:bg-white dark:hover:bg-gray-700 hover:shadow-sm transition-colors disabled:opacity-40"
                  @click="changeCartItemQty(item, -1)"
                >
                  <Icon name="lucide:minus" class="w-3 h-3" />
                </button>
                <span class="w-7 text-center text-sm font-semibold tabular-nums">{{ item.quantity }}</span>
                <button
                  type="button"
                  :disabled="busyCartItemId === item.id"
                  class="w-6 h-6 flex items-center justify-center rounded-md text-gray-500 hover:bg-white dark:hover:bg-gray-700 hover:shadow-sm transition-colors disabled:opacity-40"
                  @click="changeCartItemQty(item, 1)"
                >
                  <Icon name="lucide:plus" class="w-3 h-3" />
                </button>
              </div>

              <div class="flex flex-col items-end flex-shrink-0 w-20">
                <span class="font-bold tabular-nums text-gray-900 dark:text-white">{{ formatCents(item.totalCents) }}</span>
                <button type="button" class="text-[11px] text-gray-400 hover:text-red-500 transition-colors" @click="removeCartItem(item.id)">
                  {{ t('goods.removeItem') }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Calculator: totals + payment, always visible at the bottom -->
        <div class="flex-shrink-0 border-t border-gray-100 dark:border-gray-800">
          <div v-if="activeSale?.items?.length" class="px-4 py-2.5 flex items-center justify-between text-sm border-b border-gray-100 dark:border-gray-800">
            <button type="button" class="text-primary-600 dark:text-primary-400 font-medium flex items-center gap-1" @click="openDiscount">
              <Icon name="lucide:percent" class="w-3.5 h-3.5" /> {{ t('goods.applyDiscount') }}
            </button>
            <span v-if="activeSale.discountAmountCents" class="text-red-500 tabular-nums font-medium">− {{ formatCents(activeSale.discountAmountCents) }}</span>
          </div>
          <div class="px-4 py-3.5 flex items-center justify-between">
            <span class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ t('goods.total') }}</span>
            <span class="text-3xl font-extrabold text-gray-900 dark:text-white tabular-nums tracking-tight">{{ activeSale?.items?.length ? formatCents(activeSale.totalAmountCents) : formatCents(0) }}</span>
          </div>
          <div v-if="activeSale?.items?.length" class="px-4 pb-4 grid grid-cols-2 gap-2">
            <UButton
              block size="xl" color="primary" :loading="paying" class="col-span-2 justify-center font-semibold"
              @click="payWith('CASH')"
            >
              <Icon name="lucide:banknote" class="w-5 h-5 mr-1.5" /> {{ t('goods.payCash') }}
            </UButton>
            <UButton block size="lg" color="blue" :loading="paying" class="justify-center font-medium" @click="payWith('CARD')">
              <Icon name="lucide:credit-card" class="w-4 h-4 mr-1.5" /> {{ t('goods.payCard') }}
            </UButton>
            <UButton block size="lg" color="violet" variant="soft" :loading="paying" class="justify-center font-medium" @click="showGiftCertPay = true">
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
        <div class="space-y-4">
          <UFormGroup :label="t('goods.movementType')">
            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                class="flex items-center justify-center gap-2 rounded-lg border-2 py-2.5 text-sm font-medium transition-colors"
                :class="cashMovementForm.type === 'CASH_IN'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                  : 'border-gray-200 dark:border-gray-800 text-gray-500 hover:border-gray-300 dark:hover:border-gray-700'"
                @click="cashMovementForm.type = 'CASH_IN'"
              >
                <Icon name="lucide:arrow-down-circle" class="w-4 h-4" /> {{ t('goods.cashIn') }}
              </button>
              <button
                type="button"
                class="flex items-center justify-center gap-2 rounded-lg border-2 py-2.5 text-sm font-medium transition-colors"
                :class="cashMovementForm.type === 'CASH_OUT'
                  ? 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                  : 'border-gray-200 dark:border-gray-800 text-gray-500 hover:border-gray-300 dark:hover:border-gray-700'"
                @click="cashMovementForm.type = 'CASH_OUT'"
              >
                <Icon name="lucide:arrow-up-circle" class="w-4 h-4" /> {{ t('goods.cashOut') }}
              </button>
            </div>
          </UFormGroup>
          <UFormGroup :label="t('goods.amount')" required>
            <UInput v-model.number="cashMovementForm.amount" type="number" min="0" step="0.01" size="lg" placeholder="0.00" />
          </UFormGroup>
          <UFormGroup :label="t('goods.reason')">
            <UInput v-model="cashMovementForm.reason" :placeholder="t('goods.reasonPlaceholder')" @keyup.enter="recordCashMovement" />
          </UFormGroup>
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
              <div>
                <span class="font-medium">{{ saleTitle(s) }}</span>
                <span v-if="s.number" class="text-xs text-gray-400 ml-1.5">{{ new Date(s.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) }}</span>
              </div>
              <div class="flex items-center gap-2">
                <UBadge :color="SALE_STATUS_COLORS[s.status]" variant="soft">{{ SALE_STATUS_LABELS[s.status] }}</UBadge>
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
        <div class="space-y-4">
          <UFormGroup :label="t('goods.reason')">
            <UInput v-model="returnForm.reason" />
          </UFormGroup>
          <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-3 space-y-3">
            <div class="text-xs font-semibold uppercase tracking-wide text-gray-400">{{ t('goods.return') }}</div>
            <UFormGroup :label="t('goods.product')">
              <USelectMenu
                v-model="returnItemDraft.goodId"
                :options="goods.map(g => ({ label: `${g.name} · ${formatCents(g.salePriceCents)}`, value: g.id }))"
                value-attribute="value" option-attribute="label" searchable
                :placeholder="t('goods.selectProduct')"
                :popper="{ strategy: 'fixed' }"
                @update:model-value="onReturnGoodSelected"
              />
            </UFormGroup>
            <div class="grid grid-cols-2 gap-2">
              <UFormGroup :label="t('goods.quantity')">
                <UInput v-model.number="returnItemDraft.quantity" type="number" min="0" size="sm" />
              </UFormGroup>
              <UFormGroup :label="t('goods.amount')">
                <UInput v-model.number="returnItemDraft.amount" type="number" min="0" step="0.01" size="sm" />
              </UFormGroup>
            </div>
            <UButton size="xs" color="gray" variant="soft" icon="lucide:plus" :disabled="!returnItemDraft.goodId" @click="addReturnDraftItem">{{ t('common.add') }}</UButton>
            <div v-if="returnDraftItems.length" class="divide-y divide-gray-100 dark:divide-gray-800 mt-2">
              <div v-for="(item, idx) in returnDraftItems" :key="idx" class="flex items-center justify-between text-sm py-1.5">
                <span>{{ goodNameById.get(item.goodId) || t('goods.unknownItem') }} — {{ item.quantity }} · {{ formatCents(Math.round(item.amount * 100)) }}</span>
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
