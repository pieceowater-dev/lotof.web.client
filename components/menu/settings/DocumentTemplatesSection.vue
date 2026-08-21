<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useMenuToken } from '@/composables/useMenuToken';
import { useConfirm } from '@/composables/useConfirm';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import AppTable from '@/components/ui/AppTable.vue';
import DocumentTemplateEditor from '@/components/menu/DocumentTemplateEditor.vue';
import type { MenuDocumentTemplate } from '@/api/menu/documenttemplate/list';
import type { MenuBranch } from '@/api/menu/branch/list';

const { t } = useI18n();
const { confirm } = useConfirm();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);

const templates = ref<MenuDocumentTemplate[]>([]);
const branches = ref<MenuBranch[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

const columns = computed(() => [
  { key: 'name', label: t('menu.docTemplateName') || 'Name' },
  { key: 'branchId', label: t('menu.docTemplateBranch') || 'Branch' },
  { key: 'isActive', label: t('menu.docTemplateStatus') || 'Status' },
  { key: 'actions', label: t('app.actions') || 'Actions' },
]);

function branchName(branchId?: string | null): string {
  if (!branchId) return t('menu.docTemplateAllBranches') || 'All branches';
  return branches.value.find((b) => b.id === branchId)?.name || branchId;
}

const branchOptions = computed(() => [
  { label: t('menu.docTemplateAllBranches') || 'All branches', value: undefined },
  ...branches.value.map((b) => ({ label: b.name, value: b.id })),
]);

async function loadBranches() {
  try {
    const menuToken = await getToken();
    const { menuBranchesList } = await import('@/api/menu/branch/list');
    const res = await menuBranchesList(menuToken, nsSlug.value);
    branches.value = res.branches;
  } catch (e) {
    logError('[menu/settings/documentTemplates] loadBranches failed', e);
  }
}

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
    const { menuDocumentTemplatesList } = await import('@/api/menu/documenttemplate/list');
    const res = await menuDocumentTemplatesList(menuToken, nsSlug.value);
    templates.value = res.templates;
  } catch (e) {
    logError('[menu/settings/documentTemplates] load failed', e);
    error.value = getErrorMessage(e, t) || 'Failed to load document templates';
  } finally {
    loading.value = false;
  }
}

const isEditorOpen = ref(false);
const editingTemplate = ref<MenuDocumentTemplate | null>(null);
const formName = ref('');
const formContent = ref('');
const formIsActive = ref(true);
const formBranchId = ref<string | undefined>(undefined);
const saving = ref(false);

// Snapshot taken when the editor opens, so closeEditor() can tell a genuine
// edit apart from "opened and immediately closed" without asking every time.
const initialSnapshot = ref({ name: '', content: '', isActive: true, branchId: undefined as string | undefined });
const isDirty = computed(() =>
  formName.value !== initialSnapshot.value.name ||
  formContent.value !== initialSnapshot.value.content ||
  formIsActive.value !== initialSnapshot.value.isActive ||
  formBranchId.value !== initialSnapshot.value.branchId
);

function openCreate() {
  editingTemplate.value = null;
  formName.value = '';
  formContent.value = '';
  formIsActive.value = true;
  formBranchId.value = undefined;
  initialSnapshot.value = { name: '', content: '', isActive: true, branchId: undefined };
  isEditorOpen.value = true;
}

function openEdit(row: MenuDocumentTemplate) {
  editingTemplate.value = row;
  formName.value = row.name;
  formContent.value = row.content;
  formIsActive.value = row.isActive;
  formBranchId.value = row.branchId || undefined;
  initialSnapshot.value = { name: row.name, content: row.content, isActive: row.isActive, branchId: row.branchId || undefined };
  isEditorOpen.value = true;
}

// The editor is a full-screen takeover (not a UModal) specifically so there's
// no backdrop-click/Esc path that silently discards an in-progress template
// -- closing is only ever this explicit action, which itself confirms first
// when there are unsaved changes.
async function closeEditor() {
  if (isDirty.value && !(await confirm({ message: t('menu.confirmDiscardDocTemplate') || 'Discard unsaved changes to this template?' }))) {
    return;
  }
  isEditorOpen.value = false;
}

async function handleSave() {
  if (!formName.value.trim()) return;
  saving.value = true;
  try {
    const menuToken = await getToken();
    if (editingTemplate.value) {
      const { menuUpdateDocumentTemplate } = await import('@/api/menu/documenttemplate/update');
      const updated = await menuUpdateDocumentTemplate(menuToken, nsSlug.value, editingTemplate.value.id, {
        name: formName.value.trim(),
        content: formContent.value,
        isActive: formIsActive.value,
        branchId: formBranchId.value,
      });
      const idx = templates.value.findIndex((tpl) => tpl.id === updated.id);
      if (idx !== -1) templates.value[idx] = updated;
      useToast().add({ title: t('menu.docTemplateUpdated') || 'Template updated', color: 'primary' });
    } else {
      const { menuCreateDocumentTemplate } = await import('@/api/menu/documenttemplate/create');
      const created = await menuCreateDocumentTemplate(menuToken, nsSlug.value, formName.value.trim(), formContent.value, formBranchId.value);
      templates.value = [...templates.value, created];
      useToast().add({ title: t('menu.docTemplateCreated') || 'Template created', color: 'primary' });
    }
    isEditorOpen.value = false;
  } catch (e) {
    logError('[menu/settings/documentTemplates] save failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to save template', color: 'red' });
  } finally {
    saving.value = false;
  }
}

async function handleDelete(row: MenuDocumentTemplate) {
  if (!(await confirm({ message: t('menu.confirmDeleteDocTemplate') || 'Delete this document template?' }))) return;
  try {
    const menuToken = await getToken();
    const { menuDeleteDocumentTemplate } = await import('@/api/menu/documenttemplate/delete');
    await menuDeleteDocumentTemplate(menuToken, nsSlug.value, row.id);
    templates.value = templates.value.filter((tpl) => tpl.id !== row.id);
    useToast().add({ title: t('menu.docTemplateDeleted') || 'Template deleted', color: 'primary' });
  } catch (e) {
    logError('[menu/settings/documentTemplates] delete failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to delete template', color: 'red' });
  }
}

onMounted(() => {
  load();
  loadBranches();
});
</script>

<template>
  <div class="h-full flex flex-col min-h-0">
    <div class="flex items-start justify-between gap-3 mb-3 flex-shrink-0">
      <p class="text-sm text-gray-600 dark:text-gray-400">
        {{ t('menu.docTemplatesIntro') || 'Design printable documents (e.g. an act of completed work) with variables filled in automatically from each order.' }}
      </p>
      <UButton size="xs" color="primary" icon="lucide:plus" class="min-w-fit whitespace-nowrap" @click="openCreate">
        {{ t('menu.docTemplateNew') || 'New template' }}
      </UButton>
    </div>

    <div v-if="error" class="mb-4 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm px-3 py-2">
      {{ error }}
    </div>

    <div class="flex-1 min-h-0">
      <AppTable :rows="templates" :columns="columns" :loading="loading" empty-icon="lucide:file-text">
        <template #name-data="{ row }">
          <button type="button" class="font-medium text-gray-900 dark:text-gray-100 hover:text-primary-600 dark:hover:text-primary-400 text-left" @click="openEdit(row)">
            {{ row.name }}
          </button>
        </template>
        <template #branchId-data="{ row }">
          <span class="text-gray-600 dark:text-gray-300">{{ branchName(row.branchId) }}</span>
        </template>
        <template #isActive-data="{ row }">
          <UBadge :color="row.isActive ? 'primary' : 'gray'" variant="subtle">
            {{ row.isActive ? (t('menu.docTemplateActive') || 'Active') : (t('menu.docTemplateInactive') || 'Inactive') }}
          </UBadge>
        </template>
        <template #actions-data="{ row }">
          <div class="flex items-center gap-1">
            <UButton icon="lucide:pencil" size="2xs" color="gray" variant="ghost" @click="openEdit(row)" />
            <UButton icon="lucide:trash-2" size="2xs" color="red" variant="ghost" @click="handleDelete(row)" />
          </div>
        </template>
      </AppTable>
    </div>

    <!-- Full-screen takeover, not a UModal -- see closeEditor()'s comment for
         why: an in-progress template is too easy to lose to a stray
         backdrop click or Esc press otherwise. -->
    <div v-if="isEditorOpen" class="fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col">
      <div class="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
        <h3 class="text-lg font-semibold truncate">
          {{ editingTemplate ? (t('menu.docTemplateEdit') || 'Edit template') : (t('menu.docTemplateNew') || 'New template') }}
        </h3>
        <div class="flex items-center gap-2 flex-shrink-0">
          <UButton color="gray" variant="ghost" :label="t('app.cancel')" :disabled="saving" @click="closeEditor" />
          <UButton
            color="primary"
            :label="saving ? (t('app.loading') || 'Loading...') : (t('app.save') || 'Save')"
            :loading="saving"
            :disabled="!formName.trim() || saving"
            @click="handleSave"
          />
          <UButton icon="lucide:x" size="sm" color="gray" variant="ghost" :disabled="saving" @click="closeEditor" />
        </div>
      </div>

      <div class="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        <div class="max-w-4xl mx-auto h-full flex flex-col space-y-3">
          <div class="flex items-center gap-3 flex-shrink-0">
            <UFormGroup :label="t('menu.docTemplateName') || 'Name'" required class="flex-1">
              <UInput v-model="formName" size="sm" :placeholder="t('menu.docTemplateNamePlaceholder') || 'e.g. Act of completed work'" />
            </UFormGroup>
            <UFormGroup :label="t('menu.docTemplateBranch') || 'Branch'" class="w-56">
              <USelectMenu
                v-model="formBranchId"
                :options="branchOptions"
                value-attribute="value"
                option-attribute="label"
                size="sm"
                :popper="{ strategy: 'fixed' }"
              />
            </UFormGroup>
            <UFormGroup :label="t('menu.docTemplateStatus') || 'Status'">
              <UToggle v-model="formIsActive" />
            </UFormGroup>
          </div>

          <DocumentTemplateEditor :key="editingTemplate?.id || 'new'" v-model="formContent" class="flex-1 min-h-0" />
        </div>
      </div>
    </div>
  </div>
</template>
