<script lang="ts" setup>
definePageMeta({ layout: 'workspace' });

import PageHeader from '@/components/ui/PageHeader.vue';
import { useI18n } from '@/composables/useI18n';
import { useMenuToken } from '@/composables/useMenuToken';
import { useAuth } from '@/composables/useAuth';
import { useOrderStages } from '@/composables/useOrderStages';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import { statusBadgeStyle, nextStatuses } from '@/utils/orderStatus';
import { defaultStatusLabel } from '@/utils/orderStatusLabels';
import { displayOrderNumber } from '@/utils/orderNumber';
import { formatDisplayPhoneUniversal } from '@/utils/phone';
import OrderDetailModal from '@/components/menu/OrderDetailModal.vue';
import OpenOnPhoneModal from '@/components/tasks/OpenOnPhoneModal.vue';
import type { MenuOrder } from '@/api/menu/order/list';
import { usePageTitle } from '@/composables/usePageTitle';

// "My orders": a phone-first list for someone working in the field. Only the
// orders the signed-in person is assigned to, still open, newest activity first;
// call the customer, move the order on, or open the full card (works, parts,
// payment, photos and notes live there).
const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const { user: currentUser, fetchUser } = useAuth();
const { load: loadStages, byId: stageById } = useOrderStages();

usePageTitle('menu', { section: 'mine' });

const orders = ref<MenuOrder[]>([]);
const loading = ref(true);
const busyId = ref<string | null>(null);
const showClosed = ref(false);
const selected = ref<MenuOrder | null>(null);
const detailOpen = ref(false);
// On a desktop the page is shown as a QR to open it on a phone (installable as an app there).
const phoneOpen = ref(false);
const phoneUrl = computed(() => (typeof window === 'undefined' ? '' : `${window.location.origin}/${nsSlug.value}/menu/mine`));

function token(): string {
  const tk = useMenuToken().current();
  if (!tk) throw new Error('No menu token');
  return tk;
}

const stageLabel = (o: MenuOrder) => stageById(o.stageId)?.name || defaultStatusLabel(o.status, t);
const stageColor = (o: MenuOrder) => stageById(o.stageId)?.color || statusBadgeStyle(o.status).bg;
const isOpen = (o: MenuOrder) => !['COMPLETED', 'CANCELLED'].includes(o.status);

async function load() {
  loading.value = true;
  try {
    await fetchUser();
    const uid = currentUser.value?.id;
    if (!uid) return;
    await loadStages(token(), nsSlug.value);
    const { menuOrdersList } = await import('@/api/menu/order/list');
    const res = await menuOrdersList(token(), nsSlug.value, { participantUserId: uid, length: 'FIFTY' });
    orders.value = res.orders;
  } catch (e) {
    logError('[menu/mine] load failed', e);
    useToast().add({ title: getErrorMessage(e, t) || t('common.error'), color: 'red' });
  } finally {
    loading.value = false;
  }
}
onMounted(load);

const visible = computed(() => orders.value.filter((o) => showClosed.value || isOpen(o)));

async function advance(o: MenuOrder, status: string) {
  busyId.value = o.id;
  try {
    const { menuUpdateOrderStatus } = await import('@/api/menu/order/updateStatus');
    const updated = await menuUpdateOrderStatus(token(), nsSlug.value, o.id, status);
    const i = orders.value.findIndex((x) => x.id === o.id);
    if (i >= 0) orders.value[i] = updated;
  } catch (e) {
    logError('[menu/mine] advance failed', e);
    useToast().add({ title: getErrorMessage(e, t) || t('common.error'), color: 'red' });
  } finally {
    busyId.value = null;
  }
}

function open(o: MenuOrder) {
  selected.value = o;
  detailOpen.value = true;
}
function onChanged(updated: MenuOrder) {
  const i = orders.value.findIndex((x) => x.id === updated.id);
  if (i >= 0) orders.value[i] = updated;
  selected.value = updated;
}
</script>

<template>
  <div class="at-scope ct-scope flex h-full min-h-0 flex-col p-4 pb-safe-or-4">
    <PageHeader :title="t('menu.myOrdersTitle')" :subtitle="t('menu.myOrdersHint')">
      <template #actions>
        <button type="button" class="at-btn hidden sm:inline-flex" @click="phoneOpen = true"><Icon name="lucide:smartphone" class="h-4 w-4" />{{ t('menu.myOrdersOnPhone') }}</button>
        <button type="button" class="at-btn !px-2.5" :aria-label="t('common.refresh')" :title="t('common.refresh')" @click="load"><Icon name="lucide:refresh-cw" class="h-4 w-4" /></button>
      </template>
    </PageHeader>

    <div class="mt-3 flex flex-shrink-0 items-center gap-1.5">
      <button type="button" class="pill-filter" :class="!showClosed ? 'pill-filter--active' : ''" @click="showClosed = false">{{ t('menu.myOrdersOpen') }}</button>
      <button type="button" class="pill-filter" :class="showClosed ? 'pill-filter--active' : ''" @click="showClosed = true">{{ t('menu.myOrdersAll') }}</button>
      <NuxtLink :to="`/${nsSlug}/menu`" class="ml-auto text-sm text-accent-700 dark:text-blue-300">{{ t('menu.myOrdersAllOrders') }}</NuxtLink>
    </div>

    <!-- Phones: one column; wider screens: a grid of cards instead of one stretched row per order. -->
    <div class="mt-3 grid min-h-0 flex-1 content-start gap-3 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">
      <AppSkeleton v-if="loading" variant="list" :rows="4" class="col-span-full" />
      <div v-else-if="!visible.length" class="at-panel col-span-full !p-6 text-center">
        <Icon name="lucide:inbox" class="mx-auto mb-2 h-8 w-8 text-gray-400" />
        <div class="text-sm font-medium">{{ t('menu.myOrdersEmpty') }}</div>
      </div>

      <div v-for="o in visible" :key="o.id" class="at-panel flex flex-col !p-4">
        <button type="button" class="block w-full text-left" @click="open(o)">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="font-mono text-base font-bold">{{ displayOrderNumber(o) }}</div>
              <div class="truncate text-sm text-gray-700 dark:text-gray-200">{{ o.customerName || t('menu.guestCustomer') }}</div>
            </div>
            <span class="flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-medium text-white" :style="{ backgroundColor: stageColor(o) }">{{ stageLabel(o) }}</span>
          </div>
          <div v-if="o.deliveryAddress" class="mt-1.5 flex items-start gap-1.5 text-sm text-gray-500 dark:text-gray-400">
            <Icon name="lucide:map-pin" class="mt-0.5 h-4 w-4 flex-shrink-0" /><span class="line-clamp-2">{{ o.deliveryAddress }}</span>
          </div>
          <div v-if="o.totalAmount" class="mt-1.5 text-sm tabular-nums text-gray-500 dark:text-gray-400">
            {{ o.totalAmount.toLocaleString() }}<span v-if="o.paidAmount"> · {{ t('menu.colPaid') }}: {{ o.paidAmount.toLocaleString() }}</span>
          </div>
        </button>

        <div class="mt-auto flex flex-wrap items-center gap-2 pt-3">
          <a v-if="o.phone" :href="`tel:${o.phone}`" class="at-btn !px-3.5 !py-2" :aria-label="formatDisplayPhoneUniversal(o.phone)">
            <Icon name="lucide:phone" class="h-4 w-4" />{{ t('menu.myOrdersCall') }}
          </a>
          <button
            v-for="s in nextStatuses(o.status, o.type).filter((x) => x !== 'CANCELLED').slice(0, 1)"
            :key="s"
            type="button"
            class="at-btn at-btn--primary !px-3.5 !py-2"
            :disabled="busyId === o.id"
            @click="advance(o, s)"
          >
            <Icon name="lucide:arrow-right" class="h-4 w-4" />{{ defaultStatusLabel(s, t) }}
          </button>
          <button type="button" class="at-btn !px-3.5 !py-2" @click="open(o)">{{ t('menu.myOrdersOpenCard') }}</button>
        </div>
      </div>
    </div>

    <OpenOnPhoneModal v-model="phoneOpen" :url="phoneUrl" />
    <OrderDetailModal v-model="detailOpen" :order="selected" @status-changed="onChanged" />
  </div>
</template>
