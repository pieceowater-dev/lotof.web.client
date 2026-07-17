<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { logError } from '@/utils/logger';
import { getPublicStorefront, getPublicOrderStatus } from '@/api/menu/public/storefront';
import type { PublicOrderStatus } from '@/api/menu/public/storefront';
import type { MenuBrandSettings } from '@/api/menu/brandsettings/get';
import { getContrastTextColor } from '@/utils/color';
import { formatMoney } from '@/utils/currency';
import { smartOrderNumber, parseOrderStatusKey } from '@/utils/orderNumber';
import { statusBadgeStyle, ORDER_STATUSES } from '@/utils/orderStatus';

definePageMeta({ layout: false });

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const orderKey = computed(() => route.params.orderKey as string);

const brand = ref<MenuBrandSettings | null>(null);
const order = ref<PublicOrderStatus | null>(null);
const loading = ref(true);
const invalidLink = ref(false);
const notFound = ref(false);

const primaryColor = computed(() => brand.value?.primaryColor || '#3b82f6');
const onPrimaryText = computed(() => getContrastTextColor(primaryColor.value));
// primaryColor is the hero/background color — amount text uses secondaryColor
// instead, same convention as the storefront's cart/checkout totals.
const secondaryColor = computed(() => brand.value?.secondaryColor || primaryColor.value);

const statusLabel = (s: string) => ({
  NEW: t('menu.statusNew') || 'New',
  ACCEPTED: t('menu.statusAccepted') || 'Accepted',
  IN_PREPARATION: t('menu.statusInPreparation') || 'Preparing',
  READY: t('menu.statusReady') || 'Ready',
  DELIVERING: t('menu.statusDelivering') || 'On the way',
  COMPLETED: t('menu.statusCompleted') || 'Completed',
  CANCELLED: t('menu.statusCancelled') || 'Cancelled',
}[s] || s);

// The visible step track — DELIVERING only makes sense for delivery orders,
// so a pickup order's track skips straight from READY to COMPLETED.
const trackedStatuses = computed(() => {
  if (order.value?.type === 'pickup') return ORDER_STATUSES.filter((s) => s !== 'DELIVERING' && s !== 'CANCELLED');
  return ORDER_STATUSES.filter((s) => s !== 'CANCELLED');
});
const currentStepIndex = computed(() => {
  if (!order.value) return -1;
  return (trackedStatuses.value as readonly string[]).indexOf(order.value.status);
});

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ', ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

async function load() {
  loading.value = true;
  invalidLink.value = false;
  notFound.value = false;
  try {
    brand.value = (await getPublicStorefront(nsSlug.value)).brandSettings;
  } catch (e) {
    logError('[order-status] getPublicStorefront failed', e);
  }

  const parsed = parseOrderStatusKey(orderKey.value);
  if (!parsed) {
    invalidLink.value = true;
    loading.value = false;
    return;
  }

  try {
    order.value = await getPublicOrderStatus(nsSlug.value, parsed.number, parsed.phone, parsed.createdFrom, parsed.createdTo);
    if (!order.value) notFound.value = true;
  } catch (e) {
    logError('[order-status] getPublicOrderStatus failed', e);
    notFound.value = true;
  } finally {
    loading.value = false;
  }
}

// Soft live refresh: the customer typically leaves this tab open while
// waiting, so poll for status changes instead of requiring a manual
// reload — same cadence as the admin orders page. Stops once the order
// reaches a terminal state (nothing left to change) or the tab is
// backgrounded (no point spending requests on a page nobody's watching).
const TERMINAL_STATUSES = ['COMPLETED', 'CANCELLED'];
let pollTimer: ReturnType<typeof setInterval> | null = null;

async function pollTick() {
  if (document.hidden || invalidLink.value || !order.value || TERMINAL_STATUSES.includes(order.value.status)) return;
  const parsed = parseOrderStatusKey(orderKey.value);
  if (!parsed) return;
  try {
    const fresh = await getPublicOrderStatus(nsSlug.value, parsed.number, parsed.phone, parsed.createdFrom, parsed.createdTo);
    if (fresh) order.value = fresh;
  } catch (e) {
    logError('[order-status] pollTick failed', e);
  }
}

onMounted(async () => {
  await load();
  pollTimer = setInterval(pollTick, 8000);
});

// This page always opens in a fresh tab (checkout's "View order" / the "My
// order" lookup both use window.open) — a fresh tab's history still has an
// "about:blank" entry ahead of the real page, so history.length is always
// >1 and history.back() would land on that blank page instead of the menu.
// document.referrer is the reliable signal instead: when it's set (the
// normal case — window.open still populates it), navigate straight there so
// the menu page's own query string (source tags, branch, etc.) survives;
// otherwise fall back to a bare menu URL.
function backToMenu() {
  if (document.referrer) {
    try {
      const ref = new URL(document.referrer);
      if (ref.origin === window.location.origin) {
        window.location.href = document.referrer;
        return;
      }
    } catch {
      // fall through to the default below
    }
  }
  navigateTo(`/to/${nsSlug.value}/menu`);
}

onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer);
});

useHead(() => ({
  title: order.value ? `${t('menu.yourOrder') || 'Your order'} ${smartOrderNumber(order.value)}` : (brand.value?.name || 'Order status'),
}));
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950">
    <!-- Header: mirrors the main storefront's hero (colored band, big logo
         card, brand name) so the two pages read as the same product — plus
         a small back link since this sub-page needs a way out, unlike the
         storefront itself. -->
    <div class="relative" :style="{ backgroundColor: primaryColor }">
      <div class="max-w-lg mx-auto px-4 pt-4 pb-6">
        <button
          type="button"
          class="inline-flex items-center gap-1 text-xs font-medium mb-3 opacity-80 hover:opacity-100 transition-opacity"
          :style="{ color: onPrimaryText }"
          @click="backToMenu"
        >
          <Icon name="lucide:arrow-left" class="w-3.5 h-3.5" />
          {{ t('menu.backToMenu') || 'Back to menu' }}
        </button>
        <div class="flex items-center gap-4">
          <div class="w-16 h-16 rounded-2xl bg-white shadow-lg ring-4 ring-white/30 flex-shrink-0 overflow-hidden flex items-center justify-center">
            <img v-if="brand?.logoUrl" :src="brand.logoUrl" :alt="brand.logoAlt || brand.name" class="w-full h-full object-contain p-1.5">
            <Icon v-else name="lucide:store" class="w-6 h-6 text-gray-300" />
          </div>
          <h1 class="min-w-0 flex-1 text-xl font-bold truncate" :style="{ color: onPrimaryText }">{{ brand?.name || nsSlug }}</h1>
        </div>
      </div>
    </div>

    <div class="max-w-lg mx-auto px-4 py-6">
      <!-- Loading -->
      <div v-if="loading" class="flex flex-col items-center justify-center py-20 text-gray-400">
        <Icon name="lucide:loader-2" class="w-6 h-6 animate-spin mb-2" />
        {{ t('app.loading') || 'Loading...' }}
      </div>

      <!-- Invalid link / not found -->
      <div v-else-if="invalidLink || notFound" class="text-center py-16 space-y-3">
        <span class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
          <Icon name="lucide:search-x" class="w-6 h-6 text-gray-400" />
        </span>
        <p class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ t('menu.orderStatusNotFound') || "We couldn't find that order" }}
        </p>
        <p class="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
          {{ t('menu.orderStatusNotFoundHint') || 'Double-check the order number and phone it was placed under.' }}
        </p>
      </div>

      <!-- Order status -->
      <template v-else-if="order">
        <div class="rounded-2xl overflow-hidden shadow-sm">
          <div class="p-5" :style="{ backgroundColor: primaryColor, color: onPrimaryText }">
            <div class="text-xs font-medium uppercase tracking-wide opacity-80">{{ t('menu.yourOrder') || 'Your order' }}</div>
            <div class="text-2xl font-bold font-mono tabular-nums mt-0.5">{{ smartOrderNumber(order) }}</div>
            <div class="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">
              <Icon :name="statusBadgeStyle(order.status).icon" class="w-4 h-4" />
              {{ statusLabel(order.status) }}
            </div>
          </div>

          <div class="bg-white dark:bg-gray-900 p-5 space-y-5">
            <!-- Step tracker -->
            <div v-if="order.status !== 'CANCELLED'" class="flex items-center">
              <template v-for="(step, i) in trackedStatuses" :key="step">
                <div class="flex flex-col items-center flex-1">
                  <span
                    class="flex h-8 w-8 items-center justify-center rounded-full text-white flex-shrink-0 transition-colors"
                    :style="{ backgroundColor: i <= currentStepIndex ? statusBadgeStyle(step).bg : undefined }"
                    :class="i > currentStepIndex && 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600'"
                  >
                    <Icon :name="statusBadgeStyle(step).icon" class="w-3.5 h-3.5" />
                  </span>
                  <span class="mt-1.5 text-[10px] text-center leading-tight" :class="i <= currentStepIndex ? 'text-gray-700 dark:text-gray-300 font-medium' : 'text-gray-400 dark:text-gray-600'">
                    {{ statusLabel(step) }}
                  </span>
                </div>
                <div
                  v-if="i < trackedStatuses.length - 1"
                  class="h-0.5 flex-1 -mt-5 transition-colors"
                  :class="i < currentStepIndex ? '' : 'bg-gray-200 dark:bg-gray-800'"
                  :style="i < currentStepIndex ? { backgroundColor: statusBadgeStyle(step).bg } : undefined"
                />
              </template>
            </div>
            <div v-else class="rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm px-3 py-2.5 flex items-center gap-2">
              <Icon name="lucide:x-circle" class="w-4 h-4 flex-shrink-0" />
              {{ t('menu.orderStatusCancelledHint') || 'This order was cancelled.' }}
            </div>

            <!-- Details -->
            <div class="space-y-2.5 pt-1 border-t border-gray-100 dark:border-gray-800">
              <div class="flex items-center justify-between text-sm pt-3">
                <span class="text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                  <Icon :name="order.type === 'pickup' ? 'lucide:store' : 'lucide:truck'" class="w-4 h-4" />
                  {{ order.type === 'pickup' ? (t('menu.pickup') || 'Pickup') : (t('menu.delivery') || 'Delivery') }}
                </span>
                <span v-if="order.deliveryAddress" class="text-gray-700 dark:text-gray-300 text-right max-w-[60%] truncate">{{ order.deliveryAddress }}</span>
              </div>
              <div class="flex items-center justify-between text-sm">
                <span class="text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                  <Icon name="lucide:clock" class="w-4 h-4" />
                  {{ t('menu.createdAt') || 'Created' }}
                </span>
                <span class="text-gray-700 dark:text-gray-300">{{ formatDateTime(order.createdAt) }}</span>
              </div>
              <div v-if="order.closedAt" class="flex items-center justify-between text-sm">
                <span class="text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                  <Icon name="lucide:check-check" class="w-4 h-4" />
                  {{ t('menu.closedAt') || 'Closed' }}
                </span>
                <span class="text-gray-700 dark:text-gray-300">{{ formatDateTime(order.closedAt) }}</span>
              </div>
              <div class="flex items-center justify-between text-base font-semibold pt-2 border-t border-gray-100 dark:border-gray-800">
                <span class="text-gray-900 dark:text-white">{{ t('menu.total') || 'Total' }}</span>
                <span :style="{ color: secondaryColor }">{{ formatMoney(order.totalAmount, brand?.currencyCode) }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
