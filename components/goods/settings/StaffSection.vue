<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useGoodsAuth } from '@/composables/useGoodsAuth';
import { useConfirm } from '@/composables/useConfirm';
import { useGoodsPlanLimits } from '@/composables/useGoodsPlanLimits';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import AppTable from '@/components/ui/AppTable.vue';
import UserAvatar from '@/components/ui/UserAvatar.vue';
import { FilterPaginationLengthEnum } from '@gql-hub';
import GoodsStaffModal from '@/components/goods/GoodsStaffModal.vue';
import type { GoodsStaff } from '@/api/goods/staff';
import type { GoodsStaffRole } from '@/composables/useGoodsStaffRole';
import { memberDisplayName } from '@/utils/memberDisplayName';

const props = defineProps<{ nsSlug: string }>();

const { t } = useI18n();
const { confirm } = useConfirm();
const { token: hubToken } = useAuth();
const { isAtLimit, loadPlanLimits } = useGoodsPlanLimits();
const { getToken: getGoodsTokenRaw } = useGoodsAuth();

const staff = ref<GoodsStaff[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const members = ref<Array<{ userId: string; username: string; email: string; nickname?: string | null }>>([]);

const roleLabel = (r: GoodsStaffRole) => ({
  OWNER: t('goods.roleOwner'),
  MANAGER: t('goods.roleManager'),
  CASHIER: t('goods.roleCashier'),
  STOCKKEEPER: t('goods.roleStockkeeper'),
  VIEWER: t('goods.roleViewer'),
}[r] || r);

const roleColor = (r: GoodsStaffRole): any => ({
  OWNER: 'amber',
  MANAGER: 'primary',
  CASHIER: 'teal',
  STOCKKEEPER: 'orange',
  VIEWER: 'gray',
}[r] || 'gray');

// Mirrors lota Menu's role legend (components/menu/settings/StaffSection.vue)
// -- same toggleable explainer pattern, using Goods' own 5 roles.
const ROLE_LEGEND: { role: GoodsStaffRole; border: string; bg: string; title: string; desc: string }[] = [
  { role: 'OWNER', border: 'border-amber-200 dark:border-amber-900/40', bg: 'bg-amber-50/70 dark:bg-amber-900/10', title: 'text-amber-700 dark:text-amber-300', desc: 'text-amber-600/80 dark:text-amber-200/80' },
  { role: 'MANAGER', border: 'border-primary-200 dark:border-primary-900/40', bg: 'bg-primary-50/70 dark:bg-primary-900/10', title: 'text-primary-700 dark:text-primary-300', desc: 'text-primary-600/80 dark:text-primary-200/80' },
  { role: 'CASHIER', border: 'border-teal-200 dark:border-teal-900/40', bg: 'bg-teal-50/70 dark:bg-teal-900/10', title: 'text-teal-700 dark:text-teal-300', desc: 'text-teal-600/80 dark:text-teal-200/80' },
  { role: 'STOCKKEEPER', border: 'border-orange-200 dark:border-orange-900/40', bg: 'bg-orange-50/70 dark:bg-orange-900/10', title: 'text-orange-700 dark:text-orange-300', desc: 'text-orange-600/80 dark:text-orange-200/80' },
  { role: 'VIEWER', border: 'border-gray-200 dark:border-gray-800', bg: 'bg-gray-50/70 dark:bg-gray-800/40', title: 'text-gray-700 dark:text-gray-300', desc: 'text-gray-500 dark:text-gray-400' },
];
const roleDesc = (r: GoodsStaffRole) => ({
  OWNER: t('goods.roleOwnerDesc'),
  MANAGER: t('goods.roleManagerDesc'),
  CASHIER: t('goods.roleCashierDesc'),
  STOCKKEEPER: t('goods.roleStockkeeperDesc'),
  VIEWER: t('goods.roleViewerDesc'),
}[r] || '');
const showRoleLegend = ref(false);

// One row per namespace member (not just per staff record) -- a member with
// no staff record yet shows a neutral "No role" state instead of being
// absent from the list entirely. Mirrors lota Menu's staff table.
type StaffRow = { userId: string; username: string; email: string; nickname?: string | null; staffId: string | null; role: GoodsStaffRole | null };
const rows = computed<StaffRow[]>(() => {
  const byUserId = new Map(staff.value.map((s) => [s.userId, s]));
  return members.value.map((m) => {
    const existing = byUserId.get(m.userId);
    return { userId: m.userId, username: m.username, email: m.email, nickname: m.nickname, staffId: existing?.id || null, role: existing?.role || null };
  });
});

async function loadMemberNames() {
  if (!hubToken.value || !props.nsSlug) return;
  try {
    const { hubNamespaceBySlug } = await import('@/api/hub/namespaces/get');
    const { hubMembersList } = await import('@/api/hub/members/list');
    const namespace = await hubNamespaceBySlug(hubToken.value, props.nsSlug);
    if (!namespace?.id) return;

    const collected: Array<{ userId: string; username: string; email: string; nickname?: string | null }> = [];
    let page = 1;
    let batch: Array<{ userId: string; username: string; email: string; nickname?: string | null }>;
    do {
      batch = await hubMembersList(hubToken.value, namespace.id, page, FilterPaginationLengthEnum.Fifty);
      collected.push(...batch);
      page += 1;
    } while (batch.length >= 50);

    members.value = collected;
  } catch (e) {
    logError('[goods/settings/staff] loadMemberNames failed', e);
  }
}

const isModalOpen = ref(false);
const editingRow = ref<StaffRow | null>(null);
const saving = ref(false);

const columns = computed(() => [
  { key: 'userId', label: t('goods.staffMember') },
  { key: 'email', label: t('goods.staffEmail') },
  { key: 'role', label: t('goods.role') },
  { key: 'actions', label: t('app.actions') },
]);

async function getToken(): Promise<string> {
  return getGoodsTokenRaw(props.nsSlug);
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const goodsToken = await getToken();
    const { goodsListStaff } = await import('@/api/goods/staff');
    const res = await goodsListStaff(goodsToken, props.nsSlug);
    staff.value = res.staff;
  } catch (e) {
    logError('[goods/settings/staff] load failed', e);
    error.value = getErrorMessage(e, t) || 'Failed to load staff';
  } finally {
    loading.value = false;
  }
}

function openRoleModal(row: StaffRow) {
  editingRow.value = row;
  isModalOpen.value = true;
}

// role: null is "No role" from the modal's dropdown -- same outcome as the
// trash-icon action (revoke access via delete), just reachable from within
// the role selector itself instead of a separate button.
async function handleSubmit(payload: { userId: string; role: GoodsStaffRole | null }) {
  if (payload.role === null) {
    if (!editingRow.value?.staffId) {
      isModalOpen.value = false;
      return;
    }
    if (!(await confirm({ message: t('goods.confirmDeleteStaff') }))) return;
    saving.value = true;
    try {
      const goodsToken = await getToken();
      const { goodsDeleteStaff } = await import('@/api/goods/staff');
      await goodsDeleteStaff(goodsToken, props.nsSlug, editingRow.value.staffId);
      staff.value = staff.value.filter((s) => s.id !== editingRow.value!.staffId);
      useToast().add({ title: t('goods.staffDeleted'), color: 'primary' });
      isModalOpen.value = false;
    } catch (e) {
      logError('[goods/settings/staff] save failed', e);
      useToast().add({ title: getErrorMessage(e, t) || 'Failed to save staff member', color: 'red' });
    } finally {
      saving.value = false;
    }
    return;
  }

  if (!editingRow.value?.staffId && isAtLimit('max_staff', staff.value.length)) {
    useToast().add({ title: t('goods.planLimitStaff'), color: 'amber' });
    return;
  }

  saving.value = true;
  try {
    const goodsToken = await getToken();
    if (editingRow.value?.staffId) {
      const { goodsUpdateStaffRole } = await import('@/api/goods/staff');
      const updated = await goodsUpdateStaffRole(goodsToken, props.nsSlug, editingRow.value.staffId, payload.role);
      const idx = staff.value.findIndex((s) => s.id === updated.id);
      if (idx !== -1) staff.value[idx] = updated;
      useToast().add({ title: t('goods.staffUpdated'), color: 'primary' });
    } else {
      const { goodsCreateStaff } = await import('@/api/goods/staff');
      const created = await goodsCreateStaff(goodsToken, props.nsSlug, payload.userId, payload.role);
      staff.value = [...staff.value, created];
      useToast().add({ title: t('goods.staffCreated'), color: 'primary' });
    }
    isModalOpen.value = false;
  } catch (e) {
    logError('[goods/settings/staff] save failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to save staff member', color: 'red' });
  } finally {
    saving.value = false;
  }
}

async function handleRemove(row: StaffRow) {
  if (!row.staffId) return;
  if (!(await confirm({ message: t('goods.confirmDeleteStaff') }))) return;
  try {
    const goodsToken = await getToken();
    const { goodsDeleteStaff } = await import('@/api/goods/staff');
    await goodsDeleteStaff(goodsToken, props.nsSlug, row.staffId);
    staff.value = staff.value.filter((s) => s.id !== row.staffId);
    useToast().add({ title: t('goods.staffDeleted'), color: 'primary' });
  } catch (e) {
    logError('[goods/settings/staff] delete failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to remove staff member', color: 'red' });
  }
}

onMounted(async () => {
  load();
  loadMemberNames();
  loadPlanLimits(await getToken(), props.nsSlug);
});
</script>

<template>
  <div class="h-full flex flex-col min-h-0">
    <div class="flex flex-col gap-3 mb-3 flex-shrink-0">
      <div class="flex items-start justify-between gap-3">
        <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('goods.staffIntro') }}</p>
        <UButton
          size="xs"
          color="gray"
          variant="soft"
          icon="lucide:circle-help"
          class="min-w-fit whitespace-nowrap"
          @click="showRoleLegend = !showRoleLegend"
        >
          {{ showRoleLegend ? t('goods.hideRoleLegend') : t('goods.showRoleLegend') }}
        </UButton>
      </div>
      <div v-if="showRoleLegend" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-2">
        <div v-for="entry in ROLE_LEGEND" :key="entry.role" class="rounded-lg border p-3" :class="[entry.border, entry.bg]">
          <div class="text-sm font-semibold" :class="entry.title">{{ roleLabel(entry.role) }}</div>
          <p class="text-xs mt-1" :class="entry.desc">{{ roleDesc(entry.role) }}</p>
        </div>
      </div>
    </div>

    <div v-if="error" class="mb-4 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm px-3 py-2">
      {{ error }}
    </div>

    <div class="flex-1 min-h-0">
      <AppTable :rows="rows" :columns="columns" :loading="loading" empty-icon="lucide:users">
        <template #userId-data="{ row }">
          <button
            type="button"
            class="group flex items-center gap-2 text-left"
            :class="row.role === 'OWNER' && 'cursor-default'"
            @click="row.role !== 'OWNER' && openRoleModal(row)"
          >
            <UserAvatar :name="memberDisplayName(row) || row.email" :seed="row.email" size="sm" />
            <span
              class="font-medium text-gray-900 dark:text-gray-100 transition-colors"
              :class="row.role !== 'OWNER' && 'group-hover:text-primary-600 dark:group-hover:text-primary-400'"
            >{{ memberDisplayName(row) }}</span>
          </button>
        </template>
        <template #email-data="{ row }">
          <span class="text-gray-600 dark:text-gray-300">{{ row.email }}</span>
        </template>
        <template #role-data="{ row }">
          <UBadge v-if="row.role" :color="roleColor(row.role)" variant="subtle">{{ roleLabel(row.role) }}</UBadge>
          <UBadge v-else color="gray" variant="subtle">{{ t('goods.noRole') }}</UBadge>
        </template>
        <template #actions-data="{ row }">
          <!-- The owner's role is fixed -- auto-provisioned on first login,
               can't be changed or revoked by anyone (see
               StaffService.UpdateStaffRole/DeleteStaff in goods.msvc.core) --
               so there's nothing to offer here but a locked indicator. -->
          <div v-if="row.role === 'OWNER'" class="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
            <Icon name="lucide:lock" class="w-3.5 h-3.5" />
            {{ t('goods.ownerLocked') }}
          </div>
          <div v-else class="flex items-center gap-1">
            <UButton size="2xs" variant="soft" color="primary" icon="lucide:shield-check" @click="openRoleModal(row)">
              {{ t('goods.changeRole') }}
            </UButton>
            <UButton v-if="row.staffId" icon="lucide:trash-2" size="2xs" color="red" variant="ghost" @click="handleRemove(row)" />
          </div>
        </template>
      </AppTable>
    </div>

    <GoodsStaffModal
      v-model="isModalOpen"
      :member="editingRow"
      :current-role="editingRow?.role"
      :saving="saving"
      @submit="handleSubmit"
    />
  </div>
</template>
