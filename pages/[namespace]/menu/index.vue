<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useMenuToken } from '@/composables/useMenuToken';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import AppTable from '@/components/ui/AppTable.vue';
import CreateOrderModal from '@/components/menu/CreateOrderModal.vue';
import OrderDetailModal from '@/components/menu/OrderDetailModal.vue';
import type { MenuOrder } from '@/api/menu/order/list';
import type { MenuBranch } from '@/api/menu/branch/list';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);

const STATUSES = ['NEW', 'ACCEPTED', 'IN_PREPARATION', 'READY', 'DELIVERING', 'COMPLETED', 'CANCELLED'] as const;

const statusLabel = (s: string) => ({
  NEW: t('menu.statusNew') || 'New',
  ACCEPTED: t('menu.statusAccepted') || 'Accepted',
  IN_PREPARATION: t('menu.statusInPreparation') || 'Preparing',
  READY: t('menu.statusReady') || 'Ready',
  DELIVERING: t('menu.statusDelivering') || 'On the way',
  COMPLETED: t('menu.statusCompleted') || 'Completed',
  CANCELLED: t('menu.statusCancelled') || 'Cancelled',
}[s] || s);

const statusColor = (s: string): any => ({
  NEW: 'blue',
  ACCEPTED: 'primary',
  IN_PREPARATION: 'amber',
  READY: 'teal',
  DELIVERING: 'violet',
  COMPLETED: 'emerald',
  CANCELLED: 'red',
}[s] || 'gray');

const CARD_STYLE: Record<string, { icon: string; active: string; iconBg: string; iconColor: string; checkColor: string }> = {
  NEW: {
    icon: 'lucide:inbox',
    active: 'border-blue-300 bg-blue-50 shadow-sm dark:border-blue-700 dark:bg-blue-950/30',
    iconBg: 'bg-blue-100 dark:bg-blue-900/40',
    iconColor: 'text-blue-600 dark:text-blue-300',
    checkColor: 'text-blue-300 dark:text-blue-700',
  },
  ACCEPTED: {
    icon: 'lucide:check',
    active: 'border-primary-300 bg-primary-50 shadow-sm dark:border-primary-700 dark:bg-primary-950/30',
    iconBg: 'bg-primary-100 dark:bg-primary-900/40',
    iconColor: 'text-primary-600 dark:text-primary-300',
    checkColor: 'text-primary-300 dark:text-primary-700',
  },
  IN_PREPARATION: {
    icon: 'lucide:cooking-pot',
    active: 'border-amber-300 bg-amber-50 shadow-sm dark:border-amber-700 dark:bg-amber-950/30',
    iconBg: 'bg-amber-100 dark:bg-amber-900/40',
    iconColor: 'text-amber-600 dark:text-amber-300',
    checkColor: 'text-amber-300 dark:text-amber-700',
  },
  READY: {
    icon: 'lucide:package-check',
    active: 'border-teal-300 bg-teal-50 shadow-sm dark:border-teal-700 dark:bg-teal-950/30',
    iconBg: 'bg-teal-100 dark:bg-teal-900/40',
    iconColor: 'text-teal-600 dark:text-teal-300',
    checkColor: 'text-teal-300 dark:text-teal-700',
  },
  DELIVERING: {
    icon: 'lucide:truck',
    active: 'border-violet-300 bg-violet-50 shadow-sm dark:border-violet-700 dark:bg-violet-950/30',
    iconBg: 'bg-violet-100 dark:bg-violet-900/40',
    iconColor: 'text-violet-600 dark:text-violet-300',
    checkColor: 'text-violet-300 dark:text-violet-700',
  },
  COMPLETED: {
    icon: 'lucide:check-check',
    active: 'border-emerald-300 bg-emerald-50 shadow-sm dark:border-emerald-700 dark:bg-emerald-950/30',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
    iconColor: 'text-emerald-600 dark:text-emerald-300',
    checkColor: 'text-emerald-300 dark:text-emerald-700',
  },
  CANCELLED: {
    icon: 'lucide:x',
    active: 'border-red-300 bg-red-50 shadow-sm dark:border-red-700 dark:bg-red-950/30',
    iconBg: 'bg-red-100 dark:bg-red-900/40',
    iconColor: 'text-red-600 dark:text-red-300',
    checkColor: 'text-red-300 dark:text-red-700',
  },
};
const ALL_CARD_STYLE = {
  icon: 'lucide:layout-grid',
  active: 'border-primary-300 bg-primary-50 shadow-sm dark:border-primary-700 dark:bg-primary-950/30',
  iconBg: 'bg-primary-100 dark:bg-primary-900/40',
  iconColor: 'text-primary-600 dark:text-primary-300',
  checkColor: 'text-primary-300 dark:text-primary-700',
};
const CARD_INACTIVE = 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700';
const CARD_INACTIVE_ICON_BG = 'bg-gray-100 dark:bg-gray-800';
const CARD_INACTIVE_ICON_COLOR = 'text-gray-500 dark:text-gray-400';

function cardStyle(s: string) {
  return CARD_STYLE[s] || ALL_CARD_STYLE;
}

const orders = ref<MenuOrder[]>([]);
const totalCount = ref(0);
const loading = ref(false);
const error = ref<string | null>(null);

const branches = ref<MenuBranch[]>([]);
const selectedBranchIds = ref<string[]>([]);
const selectedStatuses = ref<string[]>([]);
const search = ref('');
const statusCounts = ref<Record<string, number>>({});

const branchOptions = computed(() => branches.value.map((b) => ({ label: b.name, value: b.id })));
const branchSelectLabel = computed(() => {
  if (selectedBranchIds.value.length === 0) return t('menu.allBranches') || 'All branches';
  if (selectedBranchIds.value.length === 1) {
    return branches.value.find((b) => b.id === selectedBranchIds.value[0])?.name || (t('menu.allBranches') || 'All branches');
  }
  return `${selectedBranchIds.value.length} ${t('menu.branchesSelected') || 'branches selected'}`;
});

async function getToken(): Promise<string> {
  const { current } = useMenuToken();
  const menuToken = current();
  if (!menuToken) throw new Error('No menu token');
  return menuToken;
}

async function loadBranches() {
  try {
    const menuToken = await getToken();
    const { menuBranchesList } = await import('@/api/menu/branch/list');
    const res = await menuBranchesList(menuToken, nsSlug.value);
    branches.value = res.branches;
  } catch (e) {
    logError('[menu/index] loadBranches failed', e);
  }
}

let searchDebounce: ReturnType<typeof setTimeout> | null = null;

async function loadOrders() {
  loading.value = true;
  error.value = null;
  try {
    const menuToken = await getToken();
    const { menuOrdersList } = await import('@/api/menu/order/list');
    const res = await menuOrdersList(menuToken, nsSlug.value, {
      statuses: selectedStatuses.value,
      branchIds: selectedBranchIds.value,
      search: search.value.trim() || undefined,
      length: 'FIFTY',
    });
    orders.value = res.orders;
    totalCount.value = res.count;
  } catch (e) {
    logError('[menu/index] loadOrders failed', e);
    error.value = getErrorMessage(e) || 'Failed to load orders';
  } finally {
    loading.value = false;
  }
}

async function loadStatusCounts() {
  try {
    const menuToken = await getToken();
    const { menuOrdersList } = await import('@/api/menu/order/list');
    const results = await Promise.all(
      STATUSES.map((s) =>
        menuOrdersList(menuToken, nsSlug.value, {
          statuses: [s],
          branchIds: selectedBranchIds.value,
          length: 'TEN',
        }).then((r) => [s, r.count] as const).catch(() => [s, 0] as const)
      )
    );
    statusCounts.value = Object.fromEntries(results);
  } catch (e) {
    logError('[menu/index] loadStatusCounts failed', e);
  }
}

function toggleStatus(s: string) {
  const idx = selectedStatuses.value.indexOf(s);
  if (idx === -1) selectedStatuses.value = [...selectedStatuses.value, s];
  else selectedStatuses.value = selectedStatuses.value.filter((v) => v !== s);
  loadOrders();
}

function clearStatuses() {
  selectedStatuses.value = [];
  loadOrders();
}

watch(selectedBranchIds, () => {
  loadOrders();
  loadStatusCounts();
});

watch(search, () => {
  if (searchDebounce) clearTimeout(searchDebounce);
  searchDebounce = setTimeout(loadOrders, 400);
});

const columns = computed(() => [
  { key: 'number', label: t('menu.orderNumber') || 'Order #' },
  { key: 'customerName', label: t('menu.customer') || 'Customer' },
  { key: 'phone', label: t('menu.phone') || 'Phone' },
  { key: 'type', label: t('menu.type') || 'Type' },
  { key: 'status', label: t('menu.status') || 'Status' },
  { key: 'totalAmount', label: t('menu.total') || 'Total' },
  { key: 'createdAt', label: t('menu.createdAt') || 'Created' },
]);

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

onMounted(() => {
  loadBranches();
  loadOrders();
  loadStatusCounts();
});

const isCreateOrderOpen = ref(false);
const creatingOrder = ref(false);
const updatingStatusId = ref<string | null>(null);

async function handleStatusChange(order: MenuOrder, status: string) {
  if (order.status === status) return;
  updatingStatusId.value = order.id;
  try {
    const menuToken = await getToken();
    const { menuUpdateOrderStatus } = await import('@/api/menu/order/updateStatus');
    const updated = await menuUpdateOrderStatus(menuToken, nsSlug.value, order.id, status);
    const idx = orders.value.findIndex((o) => o.id === updated.id);
    if (idx !== -1) orders.value[idx] = updated;
    loadStatusCounts();
    useToast().add({ title: t('menu.statusUpdated') || 'Status updated', color: 'primary' });
  } catch (e) {
    logError('[menu/index] handleStatusChange failed', e);
    useToast().add({ title: getErrorMessage(e) || 'Failed to update status', color: 'red' });
  } finally {
    updatingStatusId.value = null;
  }
}

function statusMenuItems(row: MenuOrder) {
  return [
    STATUSES.filter((s) => s !== row.status).map((s) => ({
      label: statusLabel(s),
      icon: cardStyle(s).icon,
      click: () => handleStatusChange(row, s),
    })),
  ];
}

const isDetailOpen = ref(false);
const selectedOrder = ref<MenuOrder | null>(null);

function openDetail(row: MenuOrder) {
  selectedOrder.value = row;
  isDetailOpen.value = true;
}

function handleDetailStatusChanged(updated: MenuOrder) {
  const idx = orders.value.findIndex((o) => o.id === updated.id);
  if (idx !== -1) orders.value[idx] = updated;
  selectedOrder.value = updated;
  loadStatusCounts();
}

async function handleCreateOrder(payload: any) {
  creatingOrder.value = true;
  try {
    const menuToken = await getToken();
    const { menuCreateOrder } = await import('@/api/menu/order/create');
    await menuCreateOrder(menuToken, nsSlug.value, payload);
    useToast().add({ title: t('menu.orderCreated') || 'Order created', color: 'emerald' });
    isCreateOrderOpen.value = false;
    loadOrders();
    loadStatusCounts();
  } catch (e) {
    logError('[menu/index] handleCreateOrder failed', e);
    useToast().add({ title: getErrorMessage(e) || 'Failed to create order', color: 'red' });
  } finally {
    creatingOrder.value = false;
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-4 pb-safe-or-4 min-h-0">
    <div class="flex flex-col md:flex-row md:justify-between md:items-center mb-4 flex-shrink-0 gap-3">
      <div class="text-left">
        <h1 class="text-2xl font-semibold">
          {{ t('menu.title') || 'Orders' }}
        </h1>
        <span class="text-sm text-gray-600 dark:text-gray-400">{{ t('menu.subtitle') || 'Orders, quick filters and search' }}</span>
      </div>
      <div class="flex items-center gap-2 self-start">
        <UButton
          icon="lucide:external-link"
          size="xs"
          color="gray"
          variant="soft"
          class="min-w-fit whitespace-nowrap gap-2"
          :to="`/to/${nsSlug}/menu`"
          target="_blank"
        >
          {{ t('menu.storefront') || 'Storefront' }}
        </UButton>
        <UButton
          icon="lucide:settings"
          size="xs"
          color="primary"
          variant="soft"
          class="min-w-fit whitespace-nowrap gap-2"
          :to="`/${nsSlug}/menu/settings`"
        >
          {{ t('menu.settings') || 'Settings' }}
        </UButton>
      </div>
    </div>

    <!-- Quick status filter cards (multi-select) -->
    <div class="flex gap-2.5 overflow-x-auto pb-2 mb-3 flex-shrink-0">
      <button
        class="group flex-shrink-0 flex items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 min-w-[116px] text-left transition-all duration-200"
        :class="selectedStatuses.length === 0 ? cardStyle('').active : CARD_INACTIVE"
        @click="clearStatuses"
      >
        <span
          class="flex h-8 w-8 items-center justify-center rounded-xl transition-colors"
          :class="selectedStatuses.length === 0 ? cardStyle('').iconBg : CARD_INACTIVE_ICON_BG"
        >
          <Icon
            :name="cardStyle('').icon"
            class="h-4 w-4"
            :class="selectedStatuses.length === 0 ? cardStyle('').iconColor : CARD_INACTIVE_ICON_COLOR"
          />
        </span>
        <span>
          <span class="block text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t('menu.all') || 'All' }}</span>
          <span class="block text-lg font-bold leading-tight tabular-nums text-gray-900 dark:text-gray-100">{{ totalCount }}</span>
        </span>
      </button>
      <button
        v-for="s in STATUSES"
        :key="s"
        class="group relative flex-shrink-0 flex items-center gap-2.5 rounded-2xl border py-2.5 text-left transition-all duration-200"
        :class="[selectedStatuses.includes(s) ? cardStyle(s).active : CARD_INACTIVE, selectedStatuses.includes(s) ? 'pl-3.5 pr-7' : 'px-3.5']"
        @click="toggleStatus(s)"
      >
        <Icon
          v-if="selectedStatuses.includes(s)"
          name="lucide:check-circle-2"
          class="absolute top-1.5 right-1.5 h-4 w-4"
          :class="cardStyle(s).checkColor"
        />
        <span
          class="flex h-8 w-8 items-center justify-center rounded-xl transition-colors"
          :class="selectedStatuses.includes(s) ? cardStyle(s).iconBg : CARD_INACTIVE_ICON_BG"
        >
          <Icon
            :name="cardStyle(s).icon"
            class="h-4 w-4"
            :class="selectedStatuses.includes(s) ? cardStyle(s).iconColor : CARD_INACTIVE_ICON_COLOR"
          />
        </span>
        <span>
          <span class="block text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ statusLabel(s) }}</span>
          <span class="block text-lg font-bold leading-tight tabular-nums text-gray-900 dark:text-gray-100">{{ statusCounts[s] ?? 0 }}</span>
        </span>
      </button>
    </div>

    <!-- Branch filter (multi-select) + search -->
    <div class="flex flex-col sm:flex-row gap-2 mb-3 flex-shrink-0">
      <USelectMenu
        v-model="selectedBranchIds"
        multiple
        icon="lucide:map-pin"
        :options="branchOptions"
        value-attribute="value"
        option-attribute="label"
        class="w-full sm:w-56"
        :ui="{ rounded: 'rounded-xl' }"
      >
        <template #label>
          <span class="truncate">{{ branchSelectLabel }}</span>
        </template>
      </USelectMenu>
      <UInput
        v-model="search"
        icon="lucide:search"
        :placeholder="t('menu.searchOrders') || 'Search by phone, name or order #'"
        class="w-full sm:flex-1"
        :ui="{ rounded: 'rounded-xl' }"
      />
      <UButton
        icon="lucide:plus"
        color="primary"
        variant="soft"
        class="w-full sm:w-auto justify-center flex-shrink-0"
        :ui="{ rounded: 'rounded-xl' }"
        @click="isCreateOrderOpen = true"
      >
        {{ t('menu.createOrder') || 'Create order' }}
      </UButton>
    </div>

    <div
      v-if="error"
      class="mb-4 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm px-3 py-2"
    >
      {{ error }}
    </div>

    <div class="flex-1 min-h-0">
      <AppTable
        :rows="orders"
        :columns="columns"
        :loading="loading"
        empty-icon="lucide:receipt"
        @select="openDetail"
      >
        <template #number-data="{ row }">
          <span class="font-mono font-semibold">#{{ row.number }}</span>
        </template>
        <template #customerName-data="{ row }">
          {{ row.customerName || '—' }}
        </template>
        <template #type-data="{ row }">
          <UBadge color="gray" variant="subtle">
            {{ row.type === 'pickup' ? (t('menu.pickup') || 'Pickup') : (t('menu.delivery') || 'Delivery') }}
          </UBadge>
        </template>
        <template #status-data="{ row }">
          <UDropdown :items="statusMenuItems(row)">
            <button
              type="button"
              class="inline-flex items-center gap-1 rounded-full transition-opacity hover:opacity-80 disabled:opacity-50"
              :disabled="updatingStatusId === row.id"
              @click.stop
            >
              <UBadge :color="statusColor(row.status)" variant="subtle" class="cursor-pointer">
                {{ statusLabel(row.status) }}
              </UBadge>
              <Icon
                :name="updatingStatusId === row.id ? 'lucide:loader-2' : 'lucide:chevron-down'"
                class="w-3 h-3 text-gray-400"
                :class="{ 'animate-spin': updatingStatusId === row.id }"
              />
            </button>
          </UDropdown>
        </template>
        <template #totalAmount-data="{ row }">
          {{ row.totalAmount }}
        </template>
        <template #createdAt-data="{ row }">
          {{ formatDate(row.createdAt) }}
        </template>
      </AppTable>
    </div>

    <CreateOrderModal
      v-model="isCreateOrderOpen"
      :ns-slug="nsSlug"
      :branches="branches"
      :saving="creatingOrder"
      @submit="handleCreateOrder"
    />

    <OrderDetailModal
      v-model="isDetailOpen"
      :order="selectedOrder"
      :branches="branches"
      @status-changed="handleDetailStatusChanged"
    />
  </div>
</template>
