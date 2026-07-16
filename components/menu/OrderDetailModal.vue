<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useMenuToken } from '@/composables/useMenuToken';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import type { MenuOrder } from '@/api/menu/order/list';
import type { MenuOrderItem } from '@/api/menu/order/items';
import type { MenuOrderHistoryEntry } from '@/api/menu/order/history';
import type { MenuOrderMember } from '@/api/menu/order/members';
import type { MenuBranch } from '@/api/menu/branch/list';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);

const props = defineProps<{
  modelValue: boolean;
  order: MenuOrder | null;
  branches?: MenuBranch[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'statusChanged', order: MenuOrder): void;
}>();

const isOpen = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const STATUSES = ['NEW', 'ACCEPTED', 'IN_PREPARATION', 'READY', 'DELIVERING', 'COMPLETED', 'CANCELLED'] as const;
const ROLES = ['OWNER', 'MANAGER', 'COOK', 'OPERATOR', 'COURIER'] as const;

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

// Full literal class strings (not template-interpolated) so Tailwind's JIT
// content scanner can actually find and generate them at build time.
const HISTORY_DOT_STYLE: Record<string, { bg: string; dot: string }> = {
  NEW: { bg: 'bg-blue-100 dark:bg-blue-900/40', dot: 'text-blue-500' },
  ACCEPTED: { bg: 'bg-primary-100 dark:bg-primary-900/40', dot: 'text-primary-500' },
  IN_PREPARATION: { bg: 'bg-amber-100 dark:bg-amber-900/40', dot: 'text-amber-500' },
  READY: { bg: 'bg-teal-100 dark:bg-teal-900/40', dot: 'text-teal-500' },
  DELIVERING: { bg: 'bg-violet-100 dark:bg-violet-900/40', dot: 'text-violet-500' },
  COMPLETED: { bg: 'bg-emerald-100 dark:bg-emerald-900/40', dot: 'text-emerald-500' },
  CANCELLED: { bg: 'bg-red-100 dark:bg-red-900/40', dot: 'text-red-500' },
};
function historyDotStyle(s: string) {
  return HISTORY_DOT_STYLE[s] || { bg: 'bg-gray-100 dark:bg-gray-800', dot: 'text-gray-400' };
}

const roleLabel = (r: string) => ({
  OWNER: t('menu.roleOwner') || 'Owner',
  MANAGER: t('menu.roleManager') || 'Manager',
  COOK: t('menu.roleCook') || 'Cook',
  OPERATOR: t('menu.roleOperator') || 'Operator',
  COURIER: t('menu.roleCourier') || 'Courier',
}[r] || r);

const branchById = computed(() => {
  const map: Record<string, MenuBranch> = {};
  for (const b of props.branches || []) map[b.id] = b;
  return map;
});

const items = ref<MenuOrderItem[]>([]);
const history = ref<MenuOrderHistoryEntry[]>([]);
const members = ref<MenuOrderMember[]>([]);
const loading = ref(false);
const updatingStatus = ref(false);

async function getToken(): Promise<string> {
  const { current } = useMenuToken();
  const menuToken = current();
  if (!menuToken) throw new Error('No menu token');
  return menuToken;
}

async function loadDetails() {
  if (!props.order) return;
  loading.value = true;
  try {
    const menuToken = await getToken();
    const [itemsRes, historyRes, membersRes] = await Promise.all([
      import('@/api/menu/order/items').then((m) => m.menuOrderItems(menuToken, nsSlug.value, props.order!.id)),
      import('@/api/menu/order/history').then((m) => m.menuOrderHistory(menuToken, nsSlug.value, props.order!.id)),
      import('@/api/menu/order/members').then((m) => m.menuOrderMembers(menuToken, nsSlug.value, props.order!.id)),
    ]);
    items.value = itemsRes;
    history.value = historyRes.slice().sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    members.value = membersRes;
  } catch (e) {
    logError('[OrderDetailModal] loadDetails failed', e);
    useToast().add({ title: getErrorMessage(e) || 'Failed to load order details', color: 'red' });
  } finally {
    loading.value = false;
  }
}

watch(() => [props.modelValue, props.order?.id], ([open]) => {
  if (open && props.order) loadDetails();
  if (!open) {
    items.value = [];
    history.value = [];
    members.value = [];
  }
});

async function changeStatus(status: string) {
  if (!props.order || props.order.status === status) return;
  updatingStatus.value = true;
  try {
    const menuToken = await getToken();
    const { menuUpdateOrderStatus } = await import('@/api/menu/order/updateStatus');
    const updated = await menuUpdateOrderStatus(menuToken, nsSlug.value, props.order.id, status);
    emit('statusChanged', updated);
    await loadDetails();
    useToast().add({ title: t('menu.statusUpdated') || 'Status updated', color: 'primary' });
  } catch (e) {
    logError('[OrderDetailModal] changeStatus failed', e);
    useToast().add({ title: getErrorMessage(e) || 'Failed to update status', color: 'red' });
  } finally {
    updatingStatus.value = false;
  }
}

const newMemberUserId = ref('');
const newMemberRole = ref<string>('COURIER');
const addingMember = ref(false);

async function addMember() {
  if (!props.order || !newMemberUserId.value.trim()) return;
  addingMember.value = true;
  try {
    const menuToken = await getToken();
    const { menuAddOrderMember } = await import('@/api/menu/order/members');
    const created = await menuAddOrderMember(menuToken, nsSlug.value, props.order.id, newMemberUserId.value.trim(), newMemberRole.value);
    members.value = [...members.value, created];
    newMemberUserId.value = '';
    useToast().add({ title: t('menu.memberAdded') || 'Member added', color: 'primary' });
  } catch (e) {
    logError('[OrderDetailModal] addMember failed', e);
    useToast().add({ title: getErrorMessage(e) || 'Failed to add member', color: 'red' });
  } finally {
    addingMember.value = false;
  }
}

async function removeMember(m: MenuOrderMember) {
  try {
    const menuToken = await getToken();
    const { menuRemoveOrderMember } = await import('@/api/menu/order/members');
    await menuRemoveOrderMember(menuToken, nsSlug.value, m.id);
    members.value = members.value.filter((x) => x.id !== m.id);
    useToast().add({ title: t('menu.memberRemoved') || 'Member removed', color: 'primary' });
  } catch (e) {
    logError('[OrderDetailModal] removeMember failed', e);
    useToast().add({ title: getErrorMessage(e) || 'Failed to remove member', color: 'red' });
  }
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

const itemsTotal = computed(() => items.value.reduce((sum, i) => sum + i.priceAtPurchase * i.quantity, 0));
</script>

<template>
  <UModal v-model="isOpen" :ui="{ width: 'sm:max-w-3xl' }">
    <UCard v-if="order" :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800', body: { base: 'max-h-[75vh] overflow-y-auto' } }">
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <span class="font-mono font-bold text-lg">#{{ order.number }}</span>
            <UDropdown :items="[STATUSES.filter((s) => s !== order!.status).map((s) => ({ label: statusLabel(s), click: () => changeStatus(s) }))]">
              <button type="button" class="inline-flex items-center gap-1 rounded-full disabled:opacity-50" :disabled="updatingStatus">
                <UBadge :color="statusColor(order.status)" variant="subtle" class="cursor-pointer">{{ statusLabel(order.status) }}</UBadge>
                <Icon :name="updatingStatus ? 'lucide:loader-2' : 'lucide:chevron-down'" class="w-3 h-3 text-gray-400" :class="{ 'animate-spin': updatingStatus }" />
              </button>
            </UDropdown>
          </div>
          <UButton icon="lucide:x" size="sm" color="gray" variant="ghost" @click="isOpen = false" />
        </div>
      </template>

      <div v-if="loading" class="flex items-center justify-center py-12">
        <UIcon name="lucide:loader-2" class="w-6 h-6 animate-spin text-gray-400" />
      </div>

      <div v-else class="space-y-6">
        <!-- Customer & delivery -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="rounded-xl ring-1 ring-gray-200 dark:ring-gray-800 p-4 space-y-2.5">
            <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t('menu.contactInfo') || 'Contact info' }}</div>
            <div class="flex items-center gap-2 text-sm">
              <Icon name="lucide:user" class="w-4 h-4 text-gray-400" />
              {{ order.customerName || '—' }}
            </div>
            <div class="flex items-center gap-2 text-sm">
              <Icon name="lucide:phone" class="w-4 h-4 text-gray-400" />
              {{ order.phone }}
            </div>
            <div class="flex items-center gap-2 text-sm">
              <Icon name="lucide:calendar" class="w-4 h-4 text-gray-400" />
              {{ formatDate(order.createdAt) }}
            </div>
          </div>
          <div class="rounded-xl ring-1 ring-gray-200 dark:ring-gray-800 p-4 space-y-2.5">
            <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {{ order.type === 'pickup' ? (t('menu.pickup') || 'Pickup') : (t('menu.delivery') || 'Delivery') }}
            </div>
            <div v-if="order.type === 'pickup' && order.branchId" class="flex items-start gap-2 text-sm">
              <Icon name="lucide:map-pin" class="w-4 h-4 text-gray-400 mt-0.5" />
              <span>{{ branchById[order.branchId]?.name || '—' }} — {{ branchById[order.branchId]?.address || '' }}</span>
            </div>
            <div v-else class="flex items-start gap-2 text-sm">
              <Icon name="lucide:map-pin" class="w-4 h-4 text-gray-400 mt-0.5" />
              <span>{{ order.deliveryAddress || '—' }}</span>
            </div>
            <div v-if="order.comment" class="flex items-start gap-2 text-sm">
              <Icon name="lucide:message-square" class="w-4 h-4 text-gray-400 mt-0.5" />
              <span class="text-gray-600 dark:text-gray-300">{{ order.comment }}</span>
            </div>
            <div v-if="order.sourceTag" class="flex items-center gap-2 text-xs text-gray-400">
              <Icon name="lucide:tag" class="w-3.5 h-3.5" />
              {{ order.sourceTag }}
            </div>
          </div>
        </div>

        <!-- Items -->
        <div>
          <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">{{ t('menu.menuItems') || 'Items' }}</div>
          <div class="rounded-xl ring-1 ring-gray-200 dark:ring-gray-800 overflow-hidden">
            <div v-if="!items.length" class="text-sm text-gray-400 text-center py-6">{{ t('menu.noMenuItems') || 'No items' }}</div>
            <table v-else class="w-full text-sm">
              <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
                <tr v-for="i in items" :key="i.id">
                  <td class="px-4 py-2.5">{{ i.name }}</td>
                  <td class="px-4 py-2.5 text-gray-500 dark:text-gray-400 text-center w-16">×{{ i.quantity }}</td>
                  <td class="px-4 py-2.5 text-right w-28 tabular-nums">{{ i.priceAtPurchase }} × {{ i.quantity }}</td>
                  <td class="px-4 py-2.5 text-right w-24 font-medium tabular-nums">{{ i.priceAtPurchase * i.quantity }}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr class="border-t border-gray-200 dark:border-gray-800 font-semibold">
                  <td class="px-4 py-2.5" colspan="3">{{ t('menu.total') || 'Total' }}</td>
                  <td class="px-4 py-2.5 text-right tabular-nums">{{ order.totalAmount ?? itemsTotal }}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <!-- Assigned staff -->
        <div>
          <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">{{ t('menu.staff') || 'Staff' }}</div>
          <div class="rounded-xl ring-1 ring-gray-200 dark:ring-gray-800 p-4 space-y-3">
            <div v-if="!members.length" class="text-sm text-gray-400">{{ t('menu.noStaffAssigned') || 'No staff assigned yet' }}</div>
            <div v-else class="flex flex-wrap gap-2">
              <div v-for="m in members" :key="m.id" class="group inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-xs">
                <span class="font-medium">{{ roleLabel(m.role) }}</span>
                <button type="button" class="w-4 h-4 rounded-full flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700" @click="removeMember(m)">
                  <Icon name="lucide:x" class="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
            <div class="flex gap-2 pt-1">
              <UInput v-model="newMemberUserId" size="sm" :placeholder="t('menu.userId') || 'User ID'" class="flex-1" />
              <USelect v-model="newMemberRole" :options="ROLES.map((r) => ({ label: roleLabel(r), value: r }))" value-attribute="value" option-attribute="label" size="sm" class="w-36" />
              <UButton size="sm" icon="lucide:plus" :loading="addingMember" :disabled="!newMemberUserId.trim() || addingMember" @click="addMember" />
            </div>
          </div>
        </div>

        <!-- Status history -->
        <div>
          <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">{{ t('menu.statusHistory') || 'Status history' }}</div>
          <div v-if="!history.length" class="text-sm text-gray-400">{{ t('menu.noHistory') || 'No history yet' }}</div>
          <ol v-else class="space-y-3">
            <li v-for="h in history" :key="h.id" class="flex items-start gap-3">
              <span class="flex h-6 w-6 items-center justify-center rounded-full flex-shrink-0 mt-0.5" :class="historyDotStyle(h.newStatus).bg">
                <Icon name="lucide:circle" class="w-2 h-2" :class="historyDotStyle(h.newStatus).dot" />
              </span>
              <div class="min-w-0 flex-1">
                <div class="text-sm">
                  <span class="text-gray-500 dark:text-gray-400">{{ statusLabel(h.previousStatus) }}</span>
                  <Icon name="lucide:arrow-right" class="w-3 h-3 inline mx-1 text-gray-400" />
                  <span class="font-medium">{{ statusLabel(h.newStatus) }}</span>
                </div>
                <div class="text-xs text-gray-400">{{ formatDate(h.createdAt) }}</div>
                <div v-if="h.comment" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ h.comment }}</div>
              </div>
            </li>
          </ol>
        </div>
      </div>
    </UCard>
  </UModal>
</template>
