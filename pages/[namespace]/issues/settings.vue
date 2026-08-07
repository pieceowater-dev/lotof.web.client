<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useTasksToken } from '@/composables/useTasksToken';
import { useIssuesPlanLimits } from '@/composables/useIssuesPlanLimits';
import { useTasksStaffRole } from '@/composables/useTasksStaffRole';
import { useConfirm } from '@/composables/useConfirm';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import AppTable from '@/components/ui/AppTable.vue';
import StaffModal from '@/components/tasks/StaffModal.vue';
import { FilterPaginationLengthEnum } from '@gql-hub';
import type { TasksStaff, TasksStaffRoleValue } from '@/api/tasks/staff/list';

const { t } = useI18n();
const { confirm } = useConfirm();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const { token: hubToken } = useAuth();

useHead({ title: 'Сотрудники — Issues' });

// Defense in depth: the Settings link itself is already hidden for
// assignee/viewer, but a direct URL visit would otherwise land on a page
// whose every action the backend rejects anyway (@issuesAuth(roles: [OWNER,
// MANAGER])). Bounce back rather than show a screen that can't do anything.
const { role: staffRole, isOwnerOrManager } = useTasksStaffRole();
watch(staffRole, (r) => {
  if (r && !isOwnerOrManager.value) {
    navigateTo(`/${nsSlug.value}/issues`);
  }
}, { immediate: true });

function goBack() {
  if (process.client) {
    window.history.back();
    return;
  }
  navigateTo(`/${nsSlug.value}/issues`);
}

const staff = ref<TasksStaff[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const members = ref<Array<{ userId: string; username: string; email: string }>>([]);

const roleLabel = (r: TasksStaffRoleValue) => ({
  OWNER: t('tasks.roleOwner') || 'Owner',
  MANAGER: t('tasks.roleManager') || 'Manager',
  ASSIGNEE: t('tasks.roleAssignee') || 'Assignee',
  VIEWER: t('tasks.roleViewer') || 'Viewer',
}[r] || r);

const roleColor = (r: TasksStaffRoleValue): any => ({
  OWNER: 'amber',
  MANAGER: 'primary',
  ASSIGNEE: 'teal',
  VIEWER: 'gray',
}[r] || 'gray');

type StaffRow = { userId: string; username: string; email: string; staffId: string | null; role: TasksStaffRoleValue | null };
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
    logError('[tasks/settings] loadMemberNames failed', e);
  }
}

const columns = computed(() => [
  { key: 'userId', label: t('tasks.staffMember') || 'Staff member' },
  { key: 'email', label: t('tasks.email') || 'Email' },
  { key: 'role', label: t('tasks.role') || 'Role' },
  { key: 'actions', label: t('app.actions') || 'Actions' },
]);

async function getToken(): Promise<string> {
  const { current } = useTasksToken();
  const token = current();
  if (!token) throw new Error('No tasks token');
  return token;
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const token = await getToken();
    const { tasksStaffList } = await import('@/api/tasks/staff/list');
    const res = await tasksStaffList(token, nsSlug.value);
    staff.value = res.staff;
  } catch (e) {
    logError('[tasks/settings] load failed', e);
    error.value = getErrorMessage(e, t) || 'Failed to load staff';
  } finally {
    loading.value = false;
  }
}

const { isAtLimit, loadPlanLimits } = useIssuesPlanLimits();
const isModalOpen = ref(false);
const editingRow = ref<StaffRow | null>(null);
const saving = ref(false);

function openRoleModal(row: StaffRow) {
  editingRow.value = row;
  isModalOpen.value = true;
}

async function handleSubmit(payload: { userId: string; role: TasksStaffRoleValue | null }) {
  if (payload.role === null) {
    if (!editingRow.value?.staffId) {
      isModalOpen.value = false;
      return;
    }
    if (!(await confirm({ message: t('tasks.confirmDeleteStaff') || 'Remove this staff member?' }))) return;
    saving.value = true;
    try {
      const token = await getToken();
      const { tasksDeleteStaff } = await import('@/api/tasks/staff/mutate');
      await tasksDeleteStaff(token, nsSlug.value, editingRow.value.staffId);
      staff.value = staff.value.filter((s) => s.id !== editingRow.value!.staffId);
      useToast().add({ title: t('tasks.staffDeleted') || 'Staff member removed', color: 'primary' });
      isModalOpen.value = false;
    } catch (e) {
      logError('[tasks/settings] save failed', e);
      useToast().add({ title: getErrorMessage(e, t) || 'Failed to save staff member', color: 'red' });
    } finally {
      saving.value = false;
    }
    return;
  }

  if (!editingRow.value?.staffId && isAtLimit('max_staff', staff.value.length)) {
    useToast().add({ title: t('tasks.planLimitStaff') || 'Staff limit reached for your plan — upgrade to add more.', color: 'amber' });
    return;
  }

  saving.value = true;
  try {
    const token = await getToken();
    if (editingRow.value?.staffId) {
      const { tasksUpdateStaffRole } = await import('@/api/tasks/staff/mutate');
      const updated = await tasksUpdateStaffRole(token, nsSlug.value, { id: editingRow.value.staffId, role: payload.role });
      const idx = staff.value.findIndex((s) => s.id === updated.id);
      if (idx !== -1) staff.value[idx] = updated;
      useToast().add({ title: t('tasks.staffUpdated') || 'Role updated', color: 'primary' });
    } else {
      const { tasksCreateStaff } = await import('@/api/tasks/staff/mutate');
      const created = await tasksCreateStaff(token, nsSlug.value, { userId: payload.userId, role: payload.role });
      staff.value = [...staff.value, created];
      useToast().add({ title: t('tasks.staffCreated') || 'Staff member added', color: 'primary' });
    }
    isModalOpen.value = false;
  } catch (e) {
    logError('[tasks/settings] save failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to save staff member', color: 'red' });
  } finally {
    saving.value = false;
  }
}

async function handleRemove(row: StaffRow) {
  if (!row.staffId) return;
  if (!(await confirm({ message: t('tasks.confirmDeleteStaff') || 'Remove this staff member?' }))) return;
  try {
    const token = await getToken();
    const { tasksDeleteStaff } = await import('@/api/tasks/staff/mutate');
    await tasksDeleteStaff(token, nsSlug.value, row.staffId);
    staff.value = staff.value.filter((s) => s.id !== row.staffId);
    useToast().add({ title: t('tasks.staffDeleted') || 'Staff member removed', color: 'primary' });
  } catch (e) {
    logError('[tasks/settings] delete failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to remove staff member', color: 'red' });
  }
}

onMounted(() => {
  load();
  loadMemberNames();
  const { current } = useTasksToken();
  const token = current();
  if (token) loadPlanLimits(token, nsSlug.value);
});
</script>

<template>
  <div class="h-full flex flex-col p-4 pb-safe-or-4 min-h-0">
    <div class="flex flex-col md:flex-row md:justify-between md:items-center mb-4 flex-shrink-0 gap-3">
      <div class="text-left">
        <h1 class="text-2xl font-semibold">{{ t('tasks.settings') || 'Settings' }}</h1>
      </div>
      <div class="flex flex-row flex-wrap justify-between items-center gap-2 w-full md:w-auto">
        <UButton
          v-if="staffRole === 'OWNER'"
          icon="lucide:star"
          size="xs"
          color="amber"
          variant="soft"
          class="min-w-fit whitespace-nowrap"
          :to="`/${nsSlug}/issues/plans?manage=1`"
        >
          {{ t('tasks.upgradePlan') || 'Upgrade plan' }}
        </UButton>
        <UButton icon="lucide:arrow-left" size="xs" color="primary" variant="soft" class="min-w-fit whitespace-nowrap gap-2" @click="goBack">
          {{ t('app.back') || 'Back' }}
        </UButton>
      </div>
    </div>

    <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1 flex-shrink-0 flex items-center gap-2">
      <UIcon name="lucide:users" class="w-4 h-4" />
      {{ t('tasks.staff') || 'Staff' }}
    </h2>
    <p class="text-sm text-gray-600 dark:text-gray-400 mb-3 flex-shrink-0">
      {{ t('tasks.staffIntro') || 'Assign a role to any namespace member to grant them access.' }}
    </p>

    <div v-if="error" class="mb-4 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm px-3 py-2">
      {{ error }}
    </div>

    <div class="flex-1 min-h-0">
      <AppTable :rows="rows" :columns="columns" :loading="loading" empty-icon="lucide:users">
        <template #userId-data="{ row }">
          <button type="button" class="group flex items-center gap-2 text-left" :class="row.role === 'OWNER' && 'cursor-default'" @click="row.role !== 'OWNER' && openRoleModal(row)">
            <UserAvatar :name="row.username || row.email" :seed="row.email" size="sm" />
            <span class="font-medium text-gray-900 dark:text-gray-100" :class="row.role !== 'OWNER' && 'group-hover:text-primary-600 dark:group-hover:text-primary-400'">{{ row.username }}</span>
          </button>
        </template>
        <template #email-data="{ row }">
          <span class="text-gray-600 dark:text-gray-300">{{ row.email }}</span>
        </template>
        <template #role-data="{ row }">
          <UBadge v-if="row.role" :color="roleColor(row.role)" variant="subtle">{{ roleLabel(row.role) }}</UBadge>
          <UBadge v-else color="gray" variant="subtle">{{ t('tasks.noRole') || 'No role' }}</UBadge>
        </template>
        <template #actions-data="{ row }">
          <div v-if="row.role === 'OWNER'" class="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
            <UIcon name="lucide:lock" class="w-3.5 h-3.5" />
            {{ t('tasks.ownerLocked') || 'Fixed' }}
          </div>
          <div v-else class="flex items-center gap-1">
            <UButton size="2xs" variant="soft" color="primary" icon="lucide:shield-check" @click="openRoleModal(row)">
              {{ t('tasks.changeRole') || 'Change role' }}
            </UButton>
            <UButton v-if="row.staffId" icon="lucide:trash-2" size="2xs" color="red" variant="ghost" @click="handleRemove(row)" />
          </div>
        </template>
      </AppTable>
    </div>

    <StaffModal v-model="isModalOpen" :member="editingRow" :current-role="editingRow?.role" :saving="saving" @submit="handleSubmit" />
  </div>
</template>
