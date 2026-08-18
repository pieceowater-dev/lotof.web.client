<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useGoodsToken } from '@/composables/useGoodsToken';
import { useGoodsStaffRole } from '@/composables/useGoodsStaffRole';
import { useNamespace } from '@/composables/useNamespace';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import type { GoodsWarehouse } from '@/api/goods/warehouse';
import type { GoodsRegister, GoodsCashShift } from '@/api/goods/register';
import type { GoodsSale, GoodsPaymentMethod } from '@/api/goods/sale';

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
    const { goods } = await goodsListGoods(goodsToken, nsSlug.value);
    goodNameById.value = new Map(goods.map((g) => [g.id, g.name]));
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

async function closeShift() {
  if (!currentShift.value) return;
  shiftBusy.value = true;
  try {
    const goodsToken = await getToken();
    const { goodsCloseShift } = await import('@/api/goods/register');
    await goodsCloseShift(goodsToken, nsSlug.value, currentShift.value.id, Math.round(closingCash.value * 100));
    currentShift.value = null;
    activeSale.value = null;
    showCloseShift.value = false;
  } catch (e) {
    logError('[goods/register] closeShift failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to close shift', color: 'red' });
  } finally {
    shiftBusy.value = false;
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

// --- Search / scan ---
const query = ref('');
const searching = ref(false);
const searchResults = ref<{ id: string; name: string; sku: string; baseUnitId: string }[]>([]);

async function onSearchEnter() {
  const raw = query.value.trim();
  if (!raw) return;
  searching.value = true;
  searchResults.value = [];
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
    const { goodsListGoods } = await import('@/api/goods/good');
    const { goods } = await goodsListGoods(goodsToken, nsSlug.value, { search: raw });
    searchResults.value = goods.map((g) => ({ id: g.id, name: g.name, sku: g.sku, baseUnitId: g.baseUnitId }));
  } catch (e) {
    logError('[goods/register] onSearchEnter failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Search failed', color: 'red' });
  } finally {
    searching.value = false;
  }
}

async function pickSearchResult(result: { id: string; baseUnitId: string }) {
  await addGoodToCart(result.id, result.baseUnitId, 1);
  query.value = '';
  searchResults.value = [];
}

// --- Payment ---
const paying = ref(false);
async function payWith(method: GoodsPaymentMethod) {
  if (!activeSale.value) return;
  paying.value = true;
  try {
    const goodsToken = await getToken();
    const { goodsPaySale } = await import('@/api/goods/sale');
    await goodsPaySale(goodsToken, nsSlug.value, activeSale.value.id, [{ method, amountCents: activeSale.value.totalAmountCents }]);
    useToast().add({ title: t('goods.checkoutSuccess'), color: 'green' });
    activeSale.value = null;
  } catch (e) {
    logError('[goods/register] payWith failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Payment failed', color: 'red' });
  } finally {
    paying.value = false;
  }
}

function formatCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

onMounted(bootstrap);
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 py-6 space-y-4">
    <!-- Minimal chrome: this is the face of the product -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ t('goods.register') }}</h1>
      <div class="flex items-center gap-2">
        <UButton color="gray" variant="soft" icon="lucide:warehouse" :to="`/${nsSlug}/goods`">
          {{ t('goods.warehouse') }}
        </UButton>
        <UButton v-if="currentShift" color="gray" variant="ghost" icon="lucide:log-out" @click="showCloseShift = true">
          {{ t('goods.closeShift') }}
        </UButton>
      </div>
    </div>

    <div v-if="loading" class="text-center py-16 text-gray-400">
      <Icon name="lucide:loader" class="w-6 h-6 animate-spin mx-auto" />
    </div>

    <!-- No register yet on this warehouse -->
    <div v-else-if="!activeRegister" class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 text-center space-y-3">
      <Icon name="lucide:store" class="w-8 h-8 mx-auto text-gray-400" />
      <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('goods.noRegisterYet') }}</p>
      <UButton v-if="isOwnerOrManager" color="primary" :loading="creatingRegister" @click="createRegisterHere">
        {{ t('goods.createRegister') }}
      </UButton>
    </div>

    <!-- No open shift -->
    <div v-else-if="!currentShift" class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 space-y-4">
      <p class="text-sm text-gray-500 dark:text-gray-400 text-center">{{ t('goods.openShift') }}</p>
      <UFormGroup :label="t('goods.openingCash')">
        <UInput v-model.number="openingCash" type="number" min="0" step="0.01" size="lg" @keyup.enter="openShift" />
      </UFormGroup>
      <UButton block color="primary" :loading="shiftBusy" @click="openShift">{{ t('goods.openShift') }}</UButton>
    </div>

    <!-- POS -->
    <div v-else class="space-y-4" data-tour="goods-register-pos">
      <UInput
        v-model="query"
        size="xl"
        icon="lucide:scan-barcode"
        :placeholder="t('goods.search')"
        :loading="searching"
        autofocus
        @keyup.enter="onSearchEnter"
      />

      <div v-if="searchResults.length" class="rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden">
        <button
          v-for="r in searchResults"
          :key="r.id"
          type="button"
          class="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800/60 text-left"
          @click="pickSearchResult(r)"
        >
          <span class="font-medium text-gray-900 dark:text-white">{{ r.name }}</span>
          <span class="text-gray-400">{{ r.sku }}</span>
        </button>
      </div>

      <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        <div class="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 font-medium text-sm text-gray-500 dark:text-gray-400">
          {{ t('goods.cart') }}
        </div>
        <div v-if="!activeSale?.items?.length" class="px-4 py-10 text-center text-sm text-gray-400">
          {{ t('goods.emptyCart') }}
        </div>
        <div v-else class="divide-y divide-gray-100 dark:divide-gray-800">
          <div v-for="item in activeSale.items" :key="item.id" class="flex items-center justify-between px-4 py-2.5 text-sm">
            <div>
              <div class="font-medium text-gray-900 dark:text-white">{{ goodNameById.get(item.goodId) || item.goodId }}</div>
              <div class="text-gray-400">{{ item.quantity }} × {{ formatCents(item.priceAtSaleCents) }}</div>
            </div>
            <div class="flex items-center gap-3">
              <span class="font-semibold">{{ formatCents(item.totalCents) }}</span>
              <UButton color="gray" variant="ghost" icon="lucide:x" size="2xs" @click="removeCartItem(item.id)" />
            </div>
          </div>
        </div>
        <div v-if="activeSale?.items?.length" class="px-4 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <span class="text-sm text-gray-500 dark:text-gray-400">{{ t('goods.total') }}</span>
          <span class="text-lg font-bold text-gray-900 dark:text-white">{{ formatCents(activeSale.totalAmountCents) }}</span>
        </div>
      </div>

      <div v-if="activeSale?.items?.length" class="grid grid-cols-2 gap-2">
        <UButton block size="xl" color="primary" :loading="paying" @click="payWith('CASH')">
          <Icon name="lucide:banknote" class="w-4 h-4 mr-1" /> {{ t('goods.payCash') }}
        </UButton>
        <UButton block size="xl" color="primary" variant="soft" :loading="paying" @click="payWith('CARD')">
          <Icon name="lucide:credit-card" class="w-4 h-4 mr-1" /> {{ t('goods.payCard') }}
        </UButton>
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
  </div>
</template>
