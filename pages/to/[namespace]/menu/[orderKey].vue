<script lang="ts" setup>
import AppSkeleton from '@/components/ui/AppSkeleton.vue';
import { useI18n } from '@/composables/useI18n';
import { logError } from '@/utils/logger';
import { getPublicStorefront, getPublicOrderStatus } from '@/api/menu/public/storefront';
import type { PublicOrderStatus } from '@/api/menu/public/storefront';
import type { MenuBrandSettings } from '@/api/menu/brandsettings/get';
import type { MenuBranch } from '@/api/menu/branch/list';
import { getContrastTextColor } from '@/utils/color';
import { formatMoney } from '@/utils/currency';
import { smartOrderNumber, parseOrderStatusKey } from '@/utils/orderNumber';
import { withRetry } from '@/utils/retry';
import { statusBadgeStyle, ORDER_STATUSES } from '@/utils/orderStatus';
import { orderTypeIcon, orderTypeLabelInfo } from '@/utils/orderType';
import { parseTableTag } from '@/utils/tableTag';
import { parseSocialLinks, socialIcon, socialLabel } from '@/utils/social';
import { telHref } from '@/utils/phoneLinks';
import { getCatalogBusinesses } from '@/api/hub/catalog';
import ReviewForm from '@/components/menu/storefront/ReviewForm.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import StorefrontTopBar from '@/components/storefront/StorefrontTopBar.vue';
import StorefrontHero from '@/components/storefront/StorefrontHero.vue';
import { maskProfanity } from '@/utils/profanityFilter';

definePageMeta({ layout: false });

const { t, locale } = useI18n();
const LOCALE_TAG: Record<string, string> = { ru: 'ru-RU', kk: 'kk-KZ', en: 'en-US' };
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const orderKey = computed(() => route.params.orderKey as string);

const brand = ref<MenuBrandSettings | null>(null);
const branches = ref<MenuBranch[]>([]);
const order = ref<PublicOrderStatus | null>(null);
const loading = ref(true);
const invalidLink = ref(false);
const notFound = ref(false);
// Showcase (view-only) mode disables order tracking along with the cart --
// see pages/to/[namespace]/menu/index.vue's showcaseMode. Checked before
// ever attempting a lookup, not just hidden after the fact.
const trackingDisabled = ref(false);

// Same "primary branch phone stands in for the business line" convention as
// the main storefront page.
const brandPhone = computed(() => (branches.value.find((b) => b.isPrimary) || branches.value[0])?.phone || '');
const brandSocialLinks = computed(() => parseSocialLinks(brand.value?.socialLinks));

const primaryColor = computed(() => brand.value?.primaryColor || '#3b82f6');
const onPrimaryText = computed(() => getContrastTextColor(primaryColor.value));
const brandVars = computed(() => ({ '--brand': primaryColor.value, '--brand-ink': onPrimaryText.value, '--brand-fg': secondaryColor.value }));
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
// so a pickup/table order's track skips straight from READY to COMPLETED.
const trackedStatuses = computed(() => {
  if (order.value?.type === 'pickup' || order.value?.type === 'table') return ORDER_STATUSES.filter((s) => s !== 'DELIVERING' && s !== 'CANCELLED');
  return ORDER_STATUSES.filter((s) => s !== 'CANCELLED');
});

const tableTag = computed(() => parseTableTag(order.value?.sourceTag));
const currentStepIndex = computed(() => {
  if (!order.value) return -1;
  return (trackedStatuses.value as readonly string[]).indexOf(order.value.status);
});

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    const tag = LOCALE_TAG[locale.value] || undefined;
    return d.toLocaleDateString(tag, { day: 'numeric', month: 'short' }) + ', ' + d.toLocaleTimeString(tag, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

async function load() {
  loading.value = true;
  invalidLink.value = false;
  notFound.value = false;
  try {
    const storefront = await withRetry(() => getPublicStorefront(nsSlug.value));
    brand.value = storefront.brandSettings;
    branches.value = storefront.branches;
  } catch (e) {
    logError('[order-status] getPublicStorefront failed', e);
  }

  if (brand.value?.showcaseViewOnly) {
    trackingDisabled.value = true;
    loading.value = false;
    return;
  }

  const parsed = parseOrderStatusKey(orderKey.value);
  if (!parsed) {
    invalidLink.value = true;
    loading.value = false;
    return;
  }

  try {
    order.value = await withRetry(() => getPublicOrderStatus(nsSlug.value, parsed.number, parsed.phone, parsed.createdFrom, parsed.createdTo));
    if (!order.value) notFound.value = true;
  } catch (e) {
    // A genuinely-missing order and a transient backend hiccup (surfaced as
    // a thrown error even after retrying) look the same to the user here —
    // both land on the "not found" state rather than a raw error screen.
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
  if (trackingDisabled.value) return;
  // This is the most-replicated poller in the app — every customer with an
  // order open runs their own copy, unlike the admin/board pages where
  // there's normally just one watcher per venue — so it's worth erring
  // toward a slightly longer interval here specifically.
  pollTimer = setInterval(pollTick, 10000);
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

// Review prompt: only once the order is actually done -- resolves the same
// CatalogBusiness id the storefront's own review form uses (see
// pages/to/[namespace]/menu/index.vue), matched by this order's branchId
// rather than an activeBranch selection (this page has no branch picker).
const catalogBusinessId = ref<string | null>(null);
watch(order, async (o) => {
  if (!o || o.status !== 'COMPLETED' || !o.branchId) return;
  try {
    const { rows } = await getCatalogBusinesses({ namespaceSlug: nsSlug.value });
    catalogBusinessId.value = rows.find((b) => b.sourceBranchId === o.branchId)?.id || rows[0]?.id || null;
  } catch (e) {
    logError('[order-status] failed to resolve catalog business id', e);
  }
});

useHead(() => ({
  title: order.value ? `${t('menu.yourOrder') || 'Your order'} ${smartOrderNumber(order.value)}` : (brand.value?.name || 'Order status'),
}));
</script>

<template>
  <div class="sf" :style="brandVars">
    <StorefrontTopBar :powered-label="t('menu.poweredBy') || 'Powered by'" />

    <!-- Header: mirrors the main storefront's hero so the two pages read as
         one product, plus a back link since this sub-page needs a way out. -->
    <StorefrontHero
      compact
      :name="brand?.name ? maskProfanity(brand.name) : nsSlug"
      :logo-url="brand?.logoUrl"
      :logo-alt="brand?.logoAlt || brand?.name"
      fallback-icon="lucide:store"
      :back-label="t('menu.backToMenu') || 'Back to menu'"
      @back="backToMenu"
    />

    <div class="mx-auto max-w-lg px-4 py-8">
      <!-- Loading -->
      <div v-if="loading" class="py-6">
        <AppSkeleton variant="panel" :rows="2" />
      </div>

      <!-- Showcase (view-only) mode: tracking is off entirely, not just "this
           particular order wasn't found". -->
      <EmptyState
        v-else-if="trackingDisabled"
        icon="lucide:eye"
        size="lg"
        :title="t('menu.orderTrackingDisabled') || 'Order tracking is unavailable'"
        :description="t('menu.orderTrackingDisabledHint') || 'This storefront is a showcase-only menu right now.'"
      />

      <!-- Invalid link / not found -->
      <EmptyState
        v-else-if="invalidLink || notFound"
        icon="lucide:search-x"
        size="lg"
        :title="t('menu.orderStatusNotFound') || `We couldn't find that order`"
        :description="t('menu.orderStatusNotFoundHint') || 'Double-check the order number and phone it was placed under.'"
      />

      <!-- Order status -->
      <template v-else-if="order">
        <div class="sf-card overflow-hidden">
          <div class="relative overflow-hidden p-6" :style="{ background: 'linear-gradient(160deg, color-mix(in srgb, var(--brand) 88%, white), var(--brand))', color: onPrimaryText }">
            <div class="sf-label" :style="{ color: onPrimaryText, opacity: 0.8 }">{{ t('menu.yourOrder') || 'Your order' }}</div>
            <div class="mt-1 font-mono text-3xl font-extrabold tabular-nums tracking-tight">{{ smartOrderNumber(order) }}</div>
            <div class="sf-pill mt-4 !text-sm">
              <Icon :name="statusBadgeStyle(order.status).icon" class="h-4 w-4" />
              {{ statusLabel(order.status) }}
            </div>
          </div>

          <div class="space-y-5 p-6">
            <!-- Step tracker -->
            <div v-if="order.status !== 'CANCELLED'" class="flex items-center">
              <template v-for="(step, i) in trackedStatuses" :key="step">
                <div class="flex flex-1 flex-col items-center">
                  <span
                    class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-white transition-colors"
                    :style="{ backgroundColor: i <= currentStepIndex ? statusBadgeStyle(step).bg : undefined }"
                    :class="i > currentStepIndex && 'bg-gray-200 text-gray-400 dark:bg-white/10 dark:text-gray-500'"
                  >
                    <Icon :name="statusBadgeStyle(step).icon" class="h-4 w-4" />
                  </span>
                  <span class="mt-1.5 text-center text-[10px] leading-tight" :class="i <= currentStepIndex ? 'font-semibold text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-600'">
                    {{ statusLabel(step) }}
                  </span>
                </div>
                <div
                  v-if="i < trackedStatuses.length - 1"
                  class="-mt-5 h-0.5 flex-1 transition-colors"
                  :class="i < currentStepIndex ? '' : 'bg-gray-200 dark:bg-white/10'"
                  :style="i < currentStepIndex ? { backgroundColor: statusBadgeStyle(step).bg } : undefined"
                />
              </template>
            </div>
            <div v-else class="flex items-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
              <Icon name="lucide:x-circle" class="h-4 w-4 flex-shrink-0" />
              {{ t('menu.orderStatusCancelledHint') || 'This order was cancelled.' }}
            </div>

            <!-- Details -->
            <div class="space-y-2.5 border-t border-gray-100 pt-1 dark:border-white/10">
              <div class="flex items-center justify-between pt-3 text-sm">
                <span class="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                  <Icon :name="orderTypeIcon(order.type)" class="h-4 w-4" />
                  {{ t(orderTypeLabelInfo(order.type).key) || orderTypeLabelInfo(order.type).fallback }}
                </span>
                <span v-if="tableTag" class="max-w-[60%] truncate text-right text-gray-700 dark:text-gray-300">{{ t('menu.tableNumber', { number: tableTag }) || `Table ${tableTag}` }}</span>
                <span v-else-if="order.deliveryAddress" class="max-w-[60%] truncate text-right text-gray-700 dark:text-gray-300">{{ order.deliveryAddress }}</span>
              </div>
              <div class="flex items-center justify-between text-sm">
                <span class="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                  <Icon name="lucide:clock" class="h-4 w-4" />
                  {{ t('menu.createdAt') || 'Created' }}
                </span>
                <span class="text-gray-700 dark:text-gray-300">{{ formatDateTime(order.createdAt) }}</span>
              </div>
              <div v-if="order.closedAt" class="flex items-center justify-between text-sm">
                <span class="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                  <Icon name="lucide:check-check" class="h-4 w-4" />
                  {{ t('menu.closedAt') || 'Closed' }}
                </span>
                <span class="text-gray-700 dark:text-gray-300">{{ formatDateTime(order.closedAt) }}</span>
              </div>
              <div class="flex items-center justify-between border-t border-gray-100 pt-3 dark:border-white/10">
                <span class="text-base font-bold text-gray-900 dark:text-white">{{ t('menu.total') || 'Total' }}</span>
                <span class="text-xl font-extrabold tracking-tight" :style="{ color: secondaryColor }">{{ formatMoney(order.totalAmount, brand?.currencyCode) }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>

      <div v-if="order?.status === 'COMPLETED' && catalogBusinessId" class="mt-6">
        <ReviewForm :business-id="catalogBusinessId" />
      </div>

      <!-- Contact us: shown regardless of whether the order was found —
           most useful exactly when the lookup fails and someone needs a
           human instead. -->
      <div v-if="brandPhone || brandSocialLinks.length" class="mt-8 text-center">
        <p class="mb-3 text-xs text-gray-400 dark:text-gray-500">{{ t('menu.getInTouch') || 'Need help? Get in touch' }}</p>
        <div class="flex items-center justify-center gap-2">
          <a v-if="brandPhone" :href="telHref(brandPhone)" class="sf-social !h-10 !w-10" :aria-label="t('menu.call') || 'Call'">
            <Icon name="lucide:phone" class="h-4 w-4" />
          </a>
          <a
            v-for="link in brandSocialLinks"
            :key="link.link"
            :href="link.link"
            target="_blank"
            rel="noopener"
            class="sf-social !h-10 !w-10"
            :aria-label="link.description || socialLabel(link.name)"
          >
            <Icon :name="socialIcon(link.name)" class="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  </div>
</template>
