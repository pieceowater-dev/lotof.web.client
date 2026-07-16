<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useMenuToken } from '@/composables/useMenuToken';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import AppTable from '@/components/ui/AppTable.vue';
import StaffModal from '@/components/menu/StaffModal.vue';
import type { MenuStaff, StaffRole } from '@/api/menu/staff/list';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const { token: hubToken } = useAuth();

const staff = ref<MenuStaff[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const members = ref<Array<{ userId: string; username: string; email: string }>>([]);
const userNames = computed<Record<string, string>>(() => Object.fromEntries(members.value.map((m) => [m.userId, m.username])));

function displayName(userId: string): string {
  return userNames.value[userId] || (t('menu.unknownMember') || 'Unknown member');
}

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
      batch = await hubMembersList(hubToken.value, namespace.id, page, 'FIFTY');
      collected.push(...batch);
      page += 1;
    } while (batch.length >= 50);

    members.value = collected;
  } catch (e) {
    logError('[menu/settings/staff] loadMemberNames failed', e);
  }
}

const isModalOpen = ref(false);
const editingStaff = ref<MenuStaff | null>(null);
const saving = ref(false);

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

const columns = computed(() => [
  { key: 'userId', label: t('menu.staffMember') || 'Staff member' },
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

function openCreate() {
  editingStaff.value = null;
  isModalOpen.value = true;
}

function openEdit(s: MenuStaff) {
  editingStaff.value = s;
  isModalOpen.value = true;
}

async function handleSubmit(payload: { userId: string; role: StaffRole }) {
  saving.value = true;
  try {
    const menuToken = await getToken();
    if (editingStaff.value) {
      const { menuUpdateStaffRole } = await import('@/api/menu/staff/update');
      const updated = await menuUpdateStaffRole(menuToken, nsSlug.value, editingStaff.value.id, payload.role);
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

async function handleDelete(s: MenuStaff) {
  if (process.client && !window.confirm(t('menu.confirmDeleteStaff') || 'Remove this staff member?')) return;
  try {
    const menuToken = await getToken();
    const { menuDeleteStaff } = await import('@/api/menu/staff/delete');
    await menuDeleteStaff(menuToken, nsSlug.value, s.id);
    staff.value = staff.value.filter((x) => x.id !== s.id);
    useToast().add({ title: t('menu.staffDeleted') || 'Staff member removed', color: 'primary' });
  } catch (e) {
    logError('[menu/settings/staff] delete failed', e);
    useToast().add({ title: getErrorMessage(e) || 'Failed to remove staff member', color: 'red' });
  }
}

onMounted(() => {
  load();
  loadMemberNames();
});
</script>

<template>
  <div class="h-full flex flex-col min-h-0">
    <div class="flex justify-end mb-3 flex-shrink-0">
      <UButton
        icon="lucide:user-plus"
        size="xs"
        color="primary"
        class="min-w-fit whitespace-nowrap"
        @click="openCreate"
      >
        {{ t('menu.addStaff') || 'Add staff' }}
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
        :rows="staff"
        :columns="columns"
        :loading="loading"
        empty-icon="lucide:users"
      >
        <template #userId-data="{ row }">
          <div class="flex items-center gap-2">
            <span class="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-[10px] font-semibold uppercase text-gray-600 dark:text-gray-300 flex-shrink-0">
              {{ displayName(row.userId).slice(0, 2) }}
            </span>
            <span>{{ displayName(row.userId) }}</span>
          </div>
        </template>
        <template #role-data="{ row }">
          <UBadge :color="roleColor(row.role)" variant="subtle">
            {{ roleLabel(row.role) }}
          </UBadge>
        </template>
        <template #actions-data="{ row }">
          <div class="flex gap-1">
            <UButton icon="lucide:pencil" size="2xs" color="gray" variant="ghost" @click="openEdit(row)" />
            <UButton
              v-if="row.role !== 'OWNER'"
              icon="lucide:trash-2"
              size="2xs"
              color="red"
              variant="ghost"
              @click="handleDelete(row)"
            />
          </div>
        </template>
      </AppTable>
    </div>

    <StaffModal
      v-model="isModalOpen"
      :staff="editingStaff"
      :members="members"
      :existing-staff-ids="staff.map((s) => s.userId)"
      :saving="saving"
      @submit="handleSubmit"
    />
  </div>
</template>
