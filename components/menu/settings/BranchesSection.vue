<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useMenuToken } from '@/composables/useMenuToken';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import AppTable from '@/components/ui/AppTable.vue';
import BranchModal from '@/components/menu/BranchModal.vue';
import type { MenuBranch } from '@/api/menu/branch/list';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);

const branches = ref<MenuBranch[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

const isModalOpen = ref(false);
const editingBranch = ref<MenuBranch | null>(null);
const saving = ref(false);

const columns = computed(() => [
  { key: 'name', label: t('menu.name') || 'Name' },
  { key: 'address', label: t('menu.address') || 'Address' },
  { key: 'city', label: t('menu.city') || 'City' },
  { key: 'isPrimary', label: t('menu.isPrimary') || 'Primary' },
  { key: 'isActive', label: t('menu.isActive') || 'Active' },
  { key: 'actions', label: t('app.actions') || 'Actions' },
]);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const { current } = useMenuToken();
    const menuToken = current();
    if (!menuToken) throw new Error('No menu token');
    const { menuBranchesList } = await import('@/api/menu/branch/list');
    const res = await menuBranchesList(menuToken, nsSlug.value);
    branches.value = res.branches;
  } catch (e) {
    logError('[menu/settings/branches] load failed', e);
    error.value = getErrorMessage(e) || 'Failed to load branches';
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editingBranch.value = null;
  isModalOpen.value = true;
}

function openEdit(b: MenuBranch) {
  editingBranch.value = b;
  isModalOpen.value = true;
}

async function handleSubmit(payload: Record<string, any>) {
  saving.value = true;
  try {
    const { current } = useMenuToken();
    const menuToken = current();
    if (!menuToken) throw new Error('No menu token');
    if (editingBranch.value) {
      const { menuUpdateBranch } = await import('@/api/menu/branch/update');
      const updated = await menuUpdateBranch(menuToken, nsSlug.value, { id: editingBranch.value.id, ...payload });
      const idx = branches.value.findIndex((b) => b.id === updated.id);
      if (idx !== -1) branches.value[idx] = updated;
      if (updated.isPrimary) {
        branches.value = branches.value.map((b) => (b.id === updated.id ? b : { ...b, isPrimary: false }));
      }
      useToast().add({ title: t('menu.branchUpdated') || 'Branch updated', color: 'primary' });
    } else {
      const { menuCreateBranch } = await import('@/api/menu/branch/create');
      const created = await menuCreateBranch(menuToken, nsSlug.value, payload as any);
      if (created.isPrimary) {
        branches.value = branches.value.map((b) => ({ ...b, isPrimary: false }));
      }
      branches.value = [...branches.value, created];
      useToast().add({ title: t('menu.branchCreated') || 'Branch created', color: 'primary' });
    }
    isModalOpen.value = false;
  } catch (e) {
    logError('[menu/settings/branches] save failed', e);
    useToast().add({ title: getErrorMessage(e) || 'Failed to save branch', color: 'red' });
  } finally {
    saving.value = false;
  }
}

async function handleDelete(b: MenuBranch) {
  if (process.client && !window.confirm(t('menu.confirmDeleteBranch') || 'Delete this branch?')) return;
  try {
    const { current } = useMenuToken();
    const menuToken = current();
    if (!menuToken) throw new Error('No menu token');
    const { menuDeleteBranch } = await import('@/api/menu/branch/delete');
    await menuDeleteBranch(menuToken, nsSlug.value, b.id);
    branches.value = branches.value.filter((x) => x.id !== b.id);
    useToast().add({ title: t('menu.branchDeleted') || 'Branch deleted', color: 'primary' });
  } catch (e) {
    logError('[menu/settings/branches] delete failed', e);
    useToast().add({ title: getErrorMessage(e) || 'Failed to delete branch', color: 'red' });
  }
}

onMounted(load);
</script>

<template>
  <div class="h-full flex flex-col min-h-0">
    <div class="flex justify-end mb-3 flex-shrink-0">
      <UButton
        icon="lucide:plus"
        size="xs"
        color="primary"
        class="min-w-fit whitespace-nowrap"
        @click="openCreate"
      >
        {{ t('menu.createBranch') || 'Add branch' }}
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
        :rows="branches"
        :columns="columns"
        :loading="loading"
        empty-icon="lucide:map-pin"
      >
        <template #isPrimary-data="{ row }">
          <UIcon v-if="row.isPrimary" name="lucide:star" class="w-4 h-4 text-amber-500" />
          <span v-else class="text-gray-400">—</span>
        </template>
        <template #isActive-data="{ row }">
          <UBadge :color="row.isActive ? 'primary' : 'gray'" variant="subtle">
            {{ row.isActive ? (t('menu.isActive') || 'Active') : '—' }}
          </UBadge>
        </template>
        <template #actions-data="{ row }">
          <div class="flex gap-1">
            <UButton icon="lucide:pencil" size="2xs" color="gray" variant="ghost" @click="openEdit(row)" />
            <UButton icon="lucide:trash-2" size="2xs" color="red" variant="ghost" @click="handleDelete(row)" />
          </div>
        </template>
      </AppTable>
    </div>

    <BranchModal
      v-model="isModalOpen"
      :branch="editingBranch"
      :saving="saving"
      @submit="handleSubmit"
    />
  </div>
</template>
