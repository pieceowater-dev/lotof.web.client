<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useMenuToken } from '@/composables/useMenuToken';
import { useConfirm } from '@/composables/useConfirm';
import { useMenuPlanLimits } from '@/composables/useMenuPlanLimits';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import AppTable from '@/components/ui/AppTable.vue';
import { FilterPaginationLengthEnum } from '@gql-hub';
import StaffModal from '@/components/menu/StaffModal.vue';
import type { MenuStaff, StaffRole } from '@/api/menu/staff/list';

const { t } = useI18n();
const { confirm } = useConfirm();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const { token: hubToken } = useAuth();
const { isAtLimit, loadPlanLimits } = useMenuPlanLimits();

const staff = ref<MenuStaff[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const members = ref<Array<{ userId: string; username: string; email: string }>>([]);

const roleLabel = (r: StaffRole) => ({
  OWNER: t('menu.roleOwner') || 'Owner',
  MANAGER: t('menu.roleManager') || 'Manager',
  COOK: t('menu.roleCook') || 'Cook',
  OPERATOR: t('menu.roleOperator') || 'Operator',
  COURIER: t('menu.roleCourier') || 'Courier',
}[r] || r);

const roleColor = (r: StaffRole): any => ({
  OWNER: 'amber',
  MANAGER: 'primary',
  COOK: 'orange',
  OPERATOR: 'teal',
  COURIER: 'violet',
}[r] || 'gray');

// Mirrors lota Contacts' role legend (components/contacts/settings/MembersRolesPanel.vue)
// — a toggleable explainer for what each role actually grants, using Menu's
// own 5 roles instead of Contacts' 4.
const ROLE_LEGEND: { role: StaffRole; border: string; bg: string; title: string; desc: string }[] = [
  { role: 'OWNER', border: 'border-amber-200 dark:border-amber-900/40', bg: 'bg-amber-50/70 dark:bg-amber-900/10', title: 'text-amber-700 dark:text-amber-300', desc: 'text-amber-600/80 dark:text-amber-200/80' },
  { role: 'MANAGER', border: 'border-primary-200 dark:border-primary-900/40', bg: 'bg-primary-50/70 dark:bg-primary-900/10', title: 'text-primary-700 dark:text-primary-300', desc: 'text-primary-600/80 dark:text-primary-200/80' },
  { role: 'COOK', border: 'border-orange-200 dark:border-orange-900/40', bg: 'bg-orange-50/70 dark:bg-orange-900/10', title: 'text-orange-700 dark:text-orange-300', desc: 'text-orange-600/80 dark:text-orange-200/80' },
  { role: 'OPERATOR', border: 'border-teal-200 dark:border-teal-900/40', bg: 'bg-teal-50/70 dark:bg-teal-900/10', title: 'text-teal-700 dark:text-teal-300', desc: 'text-teal-600/80 dark:text-teal-200/80' },
  { role: 'COURIER', border: 'border-violet-200 dark:border-violet-900/40', bg: 'bg-violet-50/70 dark:bg-violet-900/10', title: 'text-violet-700 dark:text-violet-300', desc: 'text-violet-600/80 dark:text-violet-200/80' },
];
const roleDesc = (r: StaffRole) => ({
  OWNER: t('menu.roleOwnerDesc') || 'Full control over the namespace and app.',
  MANAGER: t('menu.roleManagerDesc') || 'Manages staff, menu, and settings.',
  COOK: t('menu.roleCookDesc') || 'Prepares orders in the kitchen.',
  OPERATOR: t('menu.roleOperatorDesc') || 'Takes and manages orders.',
  COURIER: t('menu.roleCourierDesc') || 'Delivers orders to customers.',
}[r] || '');
const showRoleLegend = ref(false);

// One row per namespace member (not just per staff record) — a member with
// no staff record yet shows a neutral "No role" state instead of being
// absent from the list entirely, so assigning a role is a single click on
// an already-visible row instead of a separate "add" step. Mirrors lota
// Contacts' member/role table, but backed by Menu's real staff records
// (create/update/delete) rather than a display-only local label.
type StaffRow = { userId: string; username: string; email: string; staffId: string | null; role: StaffRole | null };
const rows = computed<StaffRow[]>(() => {
  const byUserId = new Map(staff.value.map((s) => [s.userId, s]));
  return members.value.map((m) => {
    const existing = byUserId.get(m.userId);
    return { userId: m.userId, username: m.username, email: m.email, staffId: existing?.id || null, role: existing?.role || null };
  });
});

async function loadMemberNames() {
  if (!hubToken.value || !nsSlug.value) return;
  try {
    const { hubNamespaceBySlug } = await import('@/api/hub/namespaces/get');
    const { hubMembersList } = await import('@/api/hub/members/list');
    const namespace = await hubNamespaceBySlug(hubToken.value, nsSlug.value);
    if (!namespace?.id) return;

    const collected: Array<{ userId: string; username: string; email: string }> = [];
    let page = 1;
    let batch: Array<{ userId: string; username: string; email: string }>;
    do {
      batch = await hubMembersList(hubToken.value, namespace.id, page, FilterPaginationLengthEnum.Fifty);
      collected.push(...batch);
      page += 1;
    } while (batch.length >= 50);

    members.value = collected;
  } catch (e) {
    logError('[menu/settings/staff] loadMemberNames failed', e);
  }
}

const isModalOpen = ref(false);
const editingRow = ref<StaffRow | null>(null);
const saving = ref(false);

const columns = computed(() => [
  { key: 'userId', label: t('menu.staffMember') || 'Staff member' },
  { key: 'email', label: t('menu.email') || 'Email' },
  { key: 'role', label: t('menu.role') || 'Role' },
  { key: 'actions', label: t('app.actions') || 'Actions' },
]);

async function getToken(): Promise<string> {
  const { current } = useMenuToken();
  const menuToken = current();
  if (!menuToken) throw new Error('No menu token');
  return menuToken;
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const menuToken = await getToken();
    const { menuStaffList } = await import('@/api/menu/staff/list');
    const res = await menuStaffList(menuToken, nsSlug.value);
    staff.value = res.staff;
  } catch (e) {
    logError('[menu/settings/staff] load failed', e);
    error.value = getErrorMessage(e) || 'Failed to load staff';
  } finally {
    loading.value = false;
  }
}

function openRoleModal(row: StaffRow) {
  editingRow.value = row;
  isModalOpen.value = true;
}

// role: null is "No role" from the modal's dropdown — same outcome as the
// trash-icon action (revoke access via delete), just reachable from within
// the role selector itself instead of a separate button.
async function handleSubmit(payload: { userId: string; role: StaffRole | null }) {
  if (payload.role === null) {
    if (!editingRow.value?.staffId) {
      // Already has no role — nothing to revoke.
      isModalOpen.value = false;
      return;
    }
    if (!(await confirm({ message: t('menu.confirmDeleteStaff') || 'Remove this staff member?' }))) return;
    saving.value = true;
    try {
      const menuToken = await getToken();
      const { menuDeleteStaff } = await import('@/api/menu/staff/delete');
      await menuDeleteStaff(menuToken, nsSlug.value, editingRow.value.staffId);
      staff.value = staff.value.filter((s) => s.id !== editingRow.value!.staffId);
      useToast().add({ title: t('menu.staffDeleted') || 'Staff member removed', color: 'primary' });
      isModalOpen.value = false;
    } catch (e) {
      logError('[menu/settings/staff] save failed', e);
      useToast().add({ title: getErrorMessage(e) || 'Failed to save staff member', color: 'red' });
    } finally {
      saving.value = false;
    }
    return;
  }

  if (!editingRow.value?.staffId && isAtLimit('max_staff', staff.value.length)) {
    useToast().add({ title: t('menu.planLimitStaff') || 'Staff limit reached for your plan — upgrade to add more.', color: 'amber' });
    return;
  }

  saving.value = true;
  try {
    const menuToken = await getToken();
    if (editingRow.value?.staffId) {
      const { menuUpdateStaffRole } = await import('@/api/menu/staff/update');
      const updated = await menuUpdateStaffRole(menuToken, nsSlug.value, editingRow.value.staffId, payload.role);
      const idx = staff.value.findIndex((s) => s.id === updated.id);
      if (idx !== -1) staff.value[idx] = updated;
      useToast().add({ title: t('menu.staffUpdated') || 'Role updated', color: 'primary' });
    } else {
      const { menuCreateStaff } = await import('@/api/menu/staff/create');
      const created = await menuCreateStaff(menuToken, nsSlug.value, payload.userId, payload.role);
      staff.value = [...staff.value, created];
      useToast().add({ title: t('menu.staffCreated') || 'Staff member added', color: 'primary' });
    }
    isModalOpen.value = false;
  } catch (e) {
    logError('[menu/settings/staff] save failed', e);
    useToast().add({ title: getErrorMessage(e) || 'Failed to save staff member', color: 'red' });
  } finally {
    saving.value = false;
  }
}

async function handleRemove(row: StaffRow) {
  if (!row.staffId) return;
  if (!(await confirm({ message: t('menu.confirmDeleteStaff') || 'Remove this staff member?' }))) return;
  try {
    const menuToken = await getToken();
    const { menuDeleteStaff } = await import('@/api/menu/staff/delete');
    await menuDeleteStaff(menuToken, nsSlug.value, row.staffId);
    staff.value = staff.value.filter((s) => s.id !== row.staffId);
    useToast().add({ title: t('menu.staffDeleted') || 'Staff member removed', color: 'primary' });
  } catch (e) {
    logError('[menu/settings/staff] delete failed', e);
    useToast().add({ title: getErrorMessage(e) || 'Failed to remove staff member', color: 'red' });
  }
}

onMounted(async () => {
  load();
  loadMemberNames();
  loadPlanLimits(await getToken(), nsSlug.value);
});
</script>

<template>
  <div class="h-full flex flex-col min-h-0">
    <div class="flex flex-col gap-3 mb-3 flex-shrink-0">
      <div class="flex items-start justify-between gap-3">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ t('menu.staffIntro') || 'Assign a role to any namespace member to grant them access.' }}
        </p>
        <UButton
          size="xs"
          color="gray"
          variant="soft"
          icon="lucide:circle-help"
          class="min-w-fit whitespace-nowrap"
          @click="showRoleLegend = !showRoleLegend"
        >
          {{ showRoleLegend ? (t('menu.hideRoleLegend') || 'Hide role hint') : (t('menu.showRoleLegend') || 'Role hint') }}
        </UButton>
      </div>
      <div v-if="showRoleLegend" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-2">
        <div v-for="entry in ROLE_LEGEND" :key="entry.role" class="rounded-lg border p-3" :class="[entry.border, entry.bg]">
          <div class="text-sm font-semibold" :class="entry.title">{{ roleLabel(entry.role) }}</div>
          <p class="text-xs mt-1" :class="entry.desc">{{ roleDesc(entry.role) }}</p>
        </div>
      </div>
    </div>

    <div
      v-if="error"
      class="mb-4 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm px-3 py-2"
    >
      {{ error }}
    </div>

    <div class="flex-1 min-h-0">
      <AppTable
        :rows="rows"
        :columns="columns"
        :loading="loading"
        empty-icon="lucide:users"
      >
        <template #userId-data="{ row }">
          <button
            type="button"
            class="group flex items-center gap-2 text-left"
            :class="row.role === 'OWNER' && 'cursor-default'"
            @click="row.role !== 'OWNER' && openRoleModal(row)"
          >
            <span class="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-[10px] font-semibold uppercase text-gray-600 dark:text-gray-300 flex-shrink-0">
              {{ (row.username || row.email || '?').slice(0, 2) }}
            </span>
            <span
              class="font-medium text-gray-900 dark:text-gray-100 transition-colors"
              :class="row.role !== 'OWNER' && 'group-hover:text-primary-600 dark:group-hover:text-primary-400'"
            >{{ row.username }}</span>
          </button>
        </template>
        <template #email-data="{ row }">
          <span class="text-gray-600 dark:text-gray-300">{{ row.email }}</span>
        </template>
        <template #role-data="{ row }">
          <UBadge v-if="row.role" :color="roleColor(row.role)" variant="subtle">
            {{ roleLabel(row.role) }}
          </UBadge>
          <UBadge v-else color="gray" variant="subtle">
            {{ t('menu.noRole') || 'No role' }}
          </UBadge>
        </template>
        <template #actions-data="{ row }">
          <!-- The owner's role is fixed — auto-provisioned on first login,
               can't be changed or revoked by anyone (see
               StaffService.UpdateStaffRole/DeleteStaff in menu.msvc.core) —
               so there's nothing to offer here but a locked indicator. -->
          <div v-if="row.role === 'OWNER'" class="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
            <Icon name="lucide:lock" class="w-3.5 h-3.5" />
            {{ t('menu.ownerLocked') || 'Fixed' }}
          </div>
          <div v-else class="flex items-center gap-1">
            <UButton
              size="2xs"
              variant="soft"
              color="primary"
              icon="lucide:shield-check"
              @click="openRoleModal(row)"
            >
              {{ t('menu.changeRole') || 'Change role' }}
            </UButton>
            <UButton
              v-if="row.staffId"
              icon="lucide:trash-2"
              size="2xs"
              color="red"
              variant="ghost"
              @click="handleRemove(row)"
            />
          </div>
        </template>
      </AppTable>
    </div>

    <StaffModal
      v-model="isModalOpen"
      :member="editingRow"
      :current-role="editingRow?.role"
      :saving="saving"
      @submit="handleSubmit"
    />
  </div>
</template>
