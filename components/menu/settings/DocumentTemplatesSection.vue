<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useMenuToken } from '@/composables/useMenuToken';
import { useConfirm } from '@/composables/useConfirm';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import AppTable from '@/components/ui/AppTable.vue';
import DocumentTemplateEditor from '@/components/menu/DocumentTemplateEditor.vue';
import type { MenuDocumentTemplate } from '@/api/menu/documenttemplate/list';

const { t } = useI18n();
const { confirm } = useConfirm();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);

const templates = ref<MenuDocumentTemplate[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

const columns = computed(() => [
  { key: 'name', label: t('menu.docTemplateName') || 'Name' },
  { key: 'isActive', label: t('menu.docTemplateStatus') || 'Status' },
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
const saving = ref(false);

function openCreate() {
  editingTemplate.value = null;
  formName.value = '';
  formContent.value = '';
  formIsActive.value = true;
  isEditorOpen.value = true;
}

function openEdit(row: MenuDocumentTemplate) {
  editingTemplate.value = row;
  formName.value = row.name;
  formContent.value = row.content;
  formIsActive.value = row.isActive;
  isEditorOpen.value = true;
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
      });
      const idx = templates.value.findIndex((tpl) => tpl.id === updated.id);
      if (idx !== -1) templates.value[idx] = updated;
      useToast().add({ title: t('menu.docTemplateUpdated') || 'Template updated', color: 'primary' });
    } else {
      const { menuCreateDocumentTemplate } = await import('@/api/menu/documenttemplate/create');
      const created = await menuCreateDocumentTemplate(menuToken, nsSlug.value, formName.value.trim(), formContent.value);
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

onMounted(load);
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

    <UModal v-model="isEditorOpen" :ui="{ width: 'sm:max-w-3xl' }">
      <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">
              {{ editingTemplate ? (t('menu.docTemplateEdit') || 'Edit template') : (t('menu.docTemplateNew') || 'New template') }}
            </h3>
            <UButton icon="lucide:x" size="sm" color="gray" variant="ghost" @click="isEditorOpen = false" />
          </div>
        </template>

        <div class="space-y-3">
          <div class="flex items-center gap-3">
            <UFormGroup :label="t('menu.docTemplateName') || 'Name'" required class="flex-1">
              <UInput v-model="formName" size="sm" :placeholder="t('menu.docTemplateNamePlaceholder') || 'e.g. Act of completed work'" />
            </UFormGroup>
            <UFormGroup :label="t('menu.docTemplateStatus') || 'Status'">
              <UToggle v-model="formIsActive" />
            </UFormGroup>
          </div>

          <DocumentTemplateEditor :key="editingTemplate?.id || 'new'" v-model="formContent" />
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="ghost" :label="t('app.cancel')" @click="isEditorOpen = false" />
            <UButton
              color="primary"
              :label="saving ? (t('app.loading') || 'Loading...') : (t('app.save') || 'Save')"
              :loading="saving"
              :disabled="!formName.trim() || saving"
              @click="handleSave"
            />
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>
