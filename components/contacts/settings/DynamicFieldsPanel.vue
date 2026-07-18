<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useAuth } from '@/composables/useAuth';
import { useContactsToken } from '@/composables/useContactsToken';
import { useConfirm } from '@/composables/useConfirm';
import { logError } from '@/utils/logger';
import { parseResourceLimitErrorToast } from '@/utils/contactsErrorToasts';
import { dynamicFieldDataTypeOptions, dynamicFieldScopeOptions } from '@/utils/constants/contactsSettings';
import DynamicFieldPreviewControl from '@/components/contacts/DynamicFieldPreviewControl.vue';
import DynamicFieldOptionsEditor from '@/components/contacts/DynamicFieldOptionsEditor.vue';
import {
  listDynamicFields,
  createDynamicField,
  updateDynamicField,
  deleteDynamicField,
  restoreDynamicField,
  type DynamicField,
  type DynamicFieldDataType,
  type DynamicFieldClientScope,
} from '@/api/contacts/dynamicFields';

type DynamicFieldPreviewValue = string | number | boolean | string[];

const { t } = useI18n();
const route = useRoute();
const toast = useToast();
const { token: hubToken } = useAuth();
const { ensure } = useContactsToken();
const { confirm } = useConfirm();

const nsSlug = computed(() => route.params.namespace as string);

const dynamicFields = ref<DynamicField[]>([]);
const dynamicFieldsLoading = ref(false);
const dynamicFieldsError = ref<string | null>(null);
const includeDeletedDynamicFields = ref(false);

const showCreateDynamicFieldModal = ref(false);
const showEditDynamicFieldModal = ref(false);
const createDynamicFieldLoading = ref(false);
const editDynamicFieldLoading = ref(false);
const deleteDynamicFieldLoading = ref(false);
const createDynamicFieldError = ref<string | null>(null);
const editDynamicFieldError = ref<string | null>(null);

const createDynamicFieldForm = ref({
  key: '',
  label: '',
  dataType: 'STRING' as DynamicFieldDataType,
  clientTypeScope: 'ALL' as DynamicFieldClientScope,
  isRequired: false,
  searchable: false,
});
const createDynamicFieldOptions = ref<string[]>(['']);
const createPreviewValue = ref<DynamicFieldPreviewValue>('');

const editDynamicFieldForm = ref({
  id: '',
  key: '',
  label: '',
  viewOrder: 0,
  dataType: 'STRING' as DynamicFieldDataType,
  clientTypeScope: 'ALL' as DynamicFieldClientScope,
  isRequired: false,
  searchable: false,
  deletedAt: '' as string | null,
});
const editDynamicFieldOptions = ref<string[]>(['']);
const editPreviewValue = ref<DynamicFieldPreviewValue>('');

const isCreateDynamicFieldValid = computed(() => {
  const data = createDynamicFieldForm.value;
  if (!data.label.trim()) return false;

  if (data.dataType === 'SELECT' || data.dataType === 'MULTI_SELECT') {
    return createDynamicFieldOptions.value.some((option) => !!option.trim());
  }

  return true;
});

const createDynamicFieldOptionChoices = computed(() => {
  return createDynamicFieldOptions.value
    .map((option) => option.trim())
    .filter(Boolean)
    .map((option) => ({ label: option, value: option }));
});

const editDynamicFieldOptionChoices = computed(() => {
  return editDynamicFieldOptions.value
    .map((option) => option.trim())
    .filter(Boolean)
    .map((option) => ({ label: option, value: option }));
});

const filteredDynamicFields = computed(() => {
  return dynamicFields.value
    .slice()
    .sort((a, b) => a.viewOrder - b.viewOrder);
});

const isEditDynamicFieldValid = computed(() => {
  return !!editDynamicFieldForm.value.id && !!editDynamicFieldForm.value.label.trim();
});

function dynamicFieldTypeLabel(type: DynamicFieldDataType): string {
  return dynamicFieldDataTypeOptions.find((option) => option.value === type)?.label || type;
}

function dynamicFieldScopeLabel(scope: DynamicFieldClientScope): string {
  return dynamicFieldScopeOptions.find((option) => option.value === scope)?.label || scope;
}

function defaultPreviewValue(dataType: DynamicFieldDataType): DynamicFieldPreviewValue {
  if (dataType === 'BOOLEAN') return false;
  if (dataType === 'MULTI_SELECT') return [];
  return '';
}

async function ensureToken(): Promise<string | null> {
  if (!hubToken.value || !nsSlug.value) return null;
  return ensure(nsSlug.value, hubToken.value);
}

const resetCreateDynamicFieldForm = () => {
  createDynamicFieldForm.value = {
    key: '',
    label: '',
    dataType: 'STRING',
    clientTypeScope: 'ALL',
    isRequired: false,
    searchable: false,
  };
  createDynamicFieldOptions.value = [''];
  createPreviewValue.value = defaultPreviewValue(createDynamicFieldForm.value.dataType);
  createDynamicFieldError.value = null;
};

function onCreateDynamicFieldDataTypeChange(value: DynamicFieldDataType) {
  createDynamicFieldForm.value.dataType = value;
  createPreviewValue.value = defaultPreviewValue(value);
  if (value === 'BOOLEAN') {
    createDynamicFieldForm.value.isRequired = false;
  }
  if (value !== 'SELECT' && value !== 'MULTI_SELECT') {
    createDynamicFieldOptions.value = [''];
  }
}

const openCreateDynamicFieldModal = () => {
  resetCreateDynamicFieldForm();
  showCreateDynamicFieldModal.value = true;
};

const closeCreateDynamicFieldModal = () => {
  showCreateDynamicFieldModal.value = false;
  createDynamicFieldError.value = null;
};

const openEditDynamicFieldModal = (field: DynamicField) => {
  editDynamicFieldForm.value = {
    id: field.id,
    key: field.key,
    label: field.label,
    viewOrder: field.viewOrder,
    dataType: field.dataType,
    clientTypeScope: field.clientTypeScope,
    isRequired: field.dataType === 'BOOLEAN' ? false : field.isRequired,
    searchable: field.searchable,
    deletedAt: field.deletedAt || null,
  };
  editDynamicFieldOptions.value =
    field.dataType === 'SELECT' || field.dataType === 'MULTI_SELECT'
      ? ((field.options && field.options.length > 0 ? field.options : ['']).map((option) => String(option)))
      : [''];
  editPreviewValue.value = defaultPreviewValue(field.dataType);
  editDynamicFieldError.value = null;
  showEditDynamicFieldModal.value = true;
};

const closeEditDynamicFieldModal = () => {
  showEditDynamicFieldModal.value = false;
  editDynamicFieldError.value = null;
  editDynamicFieldOptions.value = [''];
  editPreviewValue.value = defaultPreviewValue(editDynamicFieldForm.value.dataType);
};

function isDynamicFieldsEmptyStateError(error: unknown): boolean {
  const graphQLErrorMessages = Array.isArray((error as any)?.response?.errors)
    ? (error as any).response.errors.map((item: any) => String(item?.message || '')).join(' | ')
    : '';

  const message = String(
    graphQLErrorMessages
    || (error as any)?.response?.errors?.[0]?.message
    || (error as any)?.message
    || error
    || '',
  ).toLowerCase();

  const mentionsDynamicFields =
    message.includes('dynamic field')
    || message.includes('dynamicfield')
    || message.includes('listdynamicfields')
    || message.includes('contactsdynamicfieldservice');

  const isGenericEmptyState =
    message.includes('record not found')
    || message.includes('not found')
    || message.includes('no rows')
    || message.includes('no data');

  return message.includes('no dynamic fields')
    || message.includes('no dynamic field values')
    || (mentionsDynamicFields && isGenericEmptyState)
    || isGenericEmptyState;
}

async function loadDynamicFieldsData(token: string) {
  dynamicFieldsLoading.value = true;
  dynamicFieldsError.value = null;
  try {
    const response = await listDynamicFields(token, nsSlug.value, {
      includeDeleted: includeDeletedDynamicFields.value,
    });
    dynamicFields.value = response.dynamicFields?.rows || [];
  } catch (e) {
    if (isDynamicFieldsEmptyStateError(e)) {
      dynamicFields.value = [];
      dynamicFieldsError.value = null;
      return;
    }

    logError('Failed to load dynamic fields:', e);
    dynamicFieldsError.value = t('common.errorDetails.loadFailed') || 'Failed to load dynamic fields';
  } finally {
    dynamicFieldsLoading.value = false;
  }
}

async function reloadDynamicFields() {
  const token = await ensureToken();
  if (token) await loadDynamicFieldsData(token);
}

async function handleCreateDynamicField() {
  const data = createDynamicFieldForm.value;
  if (!data.label.trim()) {
    createDynamicFieldError.value = t('common.error') || 'Required fields are missing';
    return;
  }

  const token = await ensureToken();
  if (!token) {
    createDynamicFieldError.value = t('common.notAuthenticated') || 'Not authenticated';
    return;
  }

  try {
    createDynamicFieldLoading.value = true;
    createDynamicFieldError.value = null;
    await createDynamicField(token, nsSlug.value, {
      key: '',
      label: data.label.trim(),
      options: (data.dataType === 'SELECT' || data.dataType === 'MULTI_SELECT')
        ? createDynamicFieldOptions.value.map((option) => option.trim()).filter(Boolean)
        : undefined,
      dataType: data.dataType,
      clientTypeScope: data.clientTypeScope,
      isRequired: data.dataType === 'BOOLEAN' ? false : data.isRequired,
      searchable: data.searchable,
    });
    closeCreateDynamicFieldModal();
    await loadDynamicFieldsData(token);
    toast.add({
      title: t('common.success') || 'Success',
      description: t('common.create') || 'Created',
      color: 'emerald',
    });
  } catch (e) {
    logError('Failed to create dynamic field:', e);
    const errorToast = parseResourceLimitErrorToast(e, 'customFields', t);
    createDynamicFieldError.value = errorToast.description;
    toast.add({
      title: errorToast.title,
      description: errorToast.description,
      color: 'red',
    });
    createDynamicFieldLoading.value = false;
  }
}

async function handleEditDynamicField() {
  const data = editDynamicFieldForm.value;
  if (!data.id || !data.label.trim()) {
    editDynamicFieldError.value = t('common.error') || 'Required fields are missing';
    return;
  }

  const token = await ensureToken();
  if (!token) {
    editDynamicFieldError.value = t('common.notAuthenticated') || 'Not authenticated';
    return;
  }

  try {
    editDynamicFieldLoading.value = true;
    editDynamicFieldError.value = null;
    await updateDynamicField(token, nsSlug.value, {
      id: data.id,
      label: data.label.trim(),
      viewOrder: data.viewOrder,
      options: (data.dataType === 'SELECT' || data.dataType === 'MULTI_SELECT')
        ? editDynamicFieldOptions.value.map((option) => option.trim()).filter(Boolean)
        : undefined,
      isRequired: data.dataType === 'BOOLEAN' ? false : data.isRequired,
      searchable: data.searchable,
    });
    closeEditDynamicFieldModal();
    await loadDynamicFieldsData(token);
    toast.add({
      title: t('common.success') || 'Success',
      description: t('common.save') || 'Saved',
      color: 'emerald',
    });
  } catch (e) {
    logError('Failed to update dynamic field:', e);
    editDynamicFieldError.value = t('common.error') || 'Failed to update dynamic field';
  } finally {
    editDynamicFieldLoading.value = false;
  }
}

async function moveDynamicField(field: DynamicField, direction: 'up' | 'down') {
  const token = await ensureToken();
  if (!token) return;

  const movable = filteredDynamicFields.value
    .filter((item) => !item.deletedAt)
    .slice()
    .sort((a, b) => a.viewOrder - b.viewOrder);

  const index = movable.findIndex((item) => item.id === field.id);
  if (index < 0) return;

  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= movable.length) return;

  const current = movable[index];
  const target = movable[targetIndex];

  try {
    editDynamicFieldLoading.value = true;

    await Promise.all([
      updateDynamicField(token, nsSlug.value, {
        id: current.id,
        label: current.label,
        viewOrder: target.viewOrder,
        isRequired: current.isRequired,
        searchable: current.searchable,
      }),
      updateDynamicField(token, nsSlug.value, {
        id: target.id,
        label: target.label,
        viewOrder: current.viewOrder,
        isRequired: target.isRequired,
        searchable: target.searchable,
      }),
    ]);

    await loadDynamicFieldsData(token);
  } catch (e) {
    logError('Failed to reorder dynamic fields:', e);
    toast.add({
      title: t('common.error') || 'Error',
      description: t('common.error') || 'Reorder failed',
      color: 'red',
    });
  } finally {
    editDynamicFieldLoading.value = false;
  }
}

async function deleteDynamicFieldById(id: string) {
  const token = await ensureToken();
  if (!token) return;

  try {
    deleteDynamicFieldLoading.value = true;
    await deleteDynamicField(token, nsSlug.value, id);
    await loadDynamicFieldsData(token);
    toast.add({
      title: t('common.success') || 'Success',
      description: t('common.delete') || 'Deleted',
      color: 'emerald',
    });
  } catch (e) {
    logError('Failed to delete dynamic field:', e);
    toast.add({
      title: t('common.error') || 'Error',
      description: t('common.error') || 'Delete failed',
      color: 'red',
    });
  } finally {
    deleteDynamicFieldLoading.value = false;
  }
}

async function confirmDeleteDynamicField(id: string) {
  const ok = await confirm({
    title: 'Удалить поле',
    message: 'Поле будет скрыто, но его можно восстановить позже.',
    confirmLabel: t('common.delete') || 'Удалить',
    color: 'red',
    icon: 'lucide:trash-2',
  });
  if (!ok) return;
  await deleteDynamicFieldById(id);
}

async function handleRestoreDynamicField(id: string) {
  const token = await ensureToken();
  if (!token) return;
  try {
    deleteDynamicFieldLoading.value = true;
    await restoreDynamicField(token, nsSlug.value, id);
    await loadDynamicFieldsData(token);
    toast.add({
      title: t('common.success') || 'Success',
      description: t('common.restore') || 'Restored',
      color: 'emerald',
    });
  } catch (e) {
    logError('Failed to restore dynamic field:', e);
    toast.add({
      title: t('common.error') || 'Error',
      description: t('common.error') || 'Restore failed',
      color: 'red',
    });
  } finally {
    deleteDynamicFieldLoading.value = false;
  }
}

onMounted(async () => {
  const token = await ensureToken();
  if (!token) {
    dynamicFieldsError.value = t('common.error.missingCredentials') || 'Not authenticated';
    return;
  }
  await loadDynamicFieldsData(token);
});
</script>

<template>
  <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
    <div class="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <h3 class="font-semibold text-gray-900 dark:text-gray-100">
          {{ t('contacts.dynamicFields.title') || 'Пользовательские поля' }}
        </h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {{ t('contacts.dynamicFields.description') || 'Дополнительные поля для карточки клиента.' }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <UButton
          icon="lucide:plus"
          size="sm"
          color="emerald"
          variant="soft"
          :disabled="dynamicFieldsLoading"
          @click="openCreateDynamicFieldModal"
        >
          {{ t('common.add') || 'Add' }}
        </UButton>
      </div>
    </div>

    <div class="mb-3 flex flex-wrap items-center gap-3 text-sm">
      <span class="px-2 py-1 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
        {{ t('common.showing') || 'Показано' }}: <strong>{{ filteredDynamicFields.length }}</strong>
      </span>
      <div class="inline-flex items-center gap-2">
        <UToggle
          v-model="includeDeletedDynamicFields"
          @update:model-value="reloadDynamicFields"
        />
        <span class="text-gray-600 dark:text-gray-400">{{ t('common.showDeleted') || 'Показывать удаленные' }}</span>
      </div>
    </div>

    <div
      v-if="dynamicFieldsLoading"
      class="flex items-center justify-center py-8"
    >
      <UIcon
        name="lucide:loader-2"
        class="w-5 h-5 animate-spin text-gray-400"
      />
    </div>

    <div
      v-else-if="dynamicFieldsError"
      class="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 text-sm"
    >
      {{ dynamicFieldsError }}
    </div>

    <div
      v-else-if="filteredDynamicFields.length === 0"
      class="text-center py-8 text-gray-500 dark:text-gray-400"
    >
      <UIcon
        name="lucide:table-properties"
        class="w-8 h-8 mx-auto mb-2 opacity-50"
      />
      <p>{{ t('common.noData') || 'Нет данных' }}</p>
    </div>

    <div
      v-else
      class="grid gap-3"
    >
      <div
        v-for="(field, index) in filteredDynamicFields"
        :key="field.id"
        class="rounded-lg border border-gray-200 dark:border-gray-700 p-4"
        :class="field.deletedAt ? 'opacity-70 bg-gray-50 dark:bg-gray-900/30' : ''"
      >
        <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h4 class="font-medium text-gray-900 dark:text-gray-100">
                {{ field.label }}
              </h4>
              <UBadge
                color="gray"
                variant="soft"
              >
                {{ dynamicFieldTypeLabel(field.dataType) }}
              </UBadge>
              <UBadge
                color="gray"
                variant="soft"
              >
                {{ dynamicFieldScopeLabel(field.clientTypeScope) }}
              </UBadge>
              <UBadge
                v-if="field.searchable"
                color="gray"
                variant="soft"
              >
                {{ t('common.search') || 'Поиск' }}
              </UBadge>
              <UBadge
                v-if="field.deletedAt"
                color="gray"
                variant="soft"
              >
                {{ t('common.deleted') || 'Удалено' }}
              </UBadge>
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {{ t('common.createdAt') || 'Создано' }}: {{ new Date(field.createdAt).toLocaleString() }}
            </p>
          </div>

          <div class="flex items-center gap-2">
            <UButton
              v-if="field.deletedAt"
              icon="lucide:rotate-ccw"
              size="xs"
              color="primary"
              variant="soft"
              :disabled="deleteDynamicFieldLoading"
              @click="handleRestoreDynamicField(field.id)"
            >
              {{ t('common.restore') || 'Восстановить' }}
            </UButton>
            <template v-else>
              <UButton
                icon="lucide:arrow-up"
                size="xs"
                color="gray"
                variant="ghost"
                :disabled="editDynamicFieldLoading || index === 0"
                @click="moveDynamicField(field, 'up')"
              />
              <UButton
                icon="lucide:arrow-down"
                size="xs"
                color="gray"
                variant="ghost"
                :disabled="editDynamicFieldLoading || index === filteredDynamicFields.length - 1"
                @click="moveDynamicField(field, 'down')"
              />
              <UButton
                icon="lucide:pencil"
                size="xs"
                color="gray"
                variant="ghost"
                :disabled="editDynamicFieldLoading"
                @click="openEditDynamicFieldModal(field)"
              />
              <UButton
                icon="lucide:trash-2"
                size="xs"
                color="red"
                variant="ghost"
                :disabled="deleteDynamicFieldLoading"
                @click="confirmDeleteDynamicField(field.id)"
              />
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Dynamic Field Modal -->
    <UModal
      v-model="showCreateDynamicFieldModal"
      @close="closeCreateDynamicFieldModal"
    >
      <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
        <template #header>
          <div class="flex items-center justify-between gap-3">
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Создать поле
              </h3>
            </div>
            <UButton
              icon="lucide:x"
              size="xs"
              color="gray"
              variant="ghost"
              @click="closeCreateDynamicFieldModal"
            />
          </div>
        </template>

        <div class="space-y-4">
          <div
            v-if="createDynamicFieldError"
            class="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 text-sm"
          >
            {{ createDynamicFieldError }}
          </div>

          <div class="grid grid-cols-1 gap-4">
            <UFormGroup
              label="Название"
              required
            >
              <UInput
                v-model="createDynamicFieldForm.label"
                placeholder="День рождения"
                :disabled="createDynamicFieldLoading"
              />
            </UFormGroup>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UFormGroup
              label="Тип данных"
              required
            >
              <USelectMenu
                :model-value="createDynamicFieldForm.dataType"
                :options="dynamicFieldDataTypeOptions"
                value-attribute="value"
                option-attribute="label"
                :disabled="createDynamicFieldLoading"
                @update:model-value="(value) => onCreateDynamicFieldDataTypeChange(value as DynamicFieldDataType)"
              />
            </UFormGroup>
            <UFormGroup
              label="Область применения"
              required
            >
              <USelectMenu
                v-model="createDynamicFieldForm.clientTypeScope"
                :options="dynamicFieldScopeOptions"
                value-attribute="value"
                option-attribute="label"
                :disabled="createDynamicFieldLoading"
              />
            </UFormGroup>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div class="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
              <span class="text-sm text-gray-700 dark:text-gray-300">Показывать звездочку</span>
              <UToggle
                v-model="createDynamicFieldForm.isRequired"
                :disabled="createDynamicFieldLoading || createDynamicFieldForm.dataType === 'BOOLEAN'"
              />
            </div>
          </div>

          <div
            v-if="createDynamicFieldForm.dataType === 'SELECT' || createDynamicFieldForm.dataType === 'MULTI_SELECT'"
            class="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-900/20 p-3 space-y-3"
          >
            <DynamicFieldOptionsEditor
              v-model="createDynamicFieldOptions"
              :disabled="createDynamicFieldLoading"
            />
          </div>

          <div class="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/60 p-3">
            <div class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
              Превью поля
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium text-slate-800 dark:text-slate-200">
                {{ createDynamicFieldForm.label.trim() || 'Название поля' }}
                <span
                  v-if="createDynamicFieldForm.isRequired"
                  class="text-red-500"
                >*</span>
              </label>

              <DynamicFieldPreviewControl
                v-model="createPreviewValue"
                :data-type="createDynamicFieldForm.dataType"
                :options="createDynamicFieldOptionChoices"
                :disabled="createDynamicFieldLoading"
                string-placeholder="Текстовое значение"
                number-placeholder="0"
                select-placeholder="Выберите вариант"
              />
            </div>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton
              color="gray"
              variant="soft"
              :disabled="createDynamicFieldLoading"
              @click="closeCreateDynamicFieldModal"
            >
              {{ t('common.cancel') || 'Отмена' }}
            </UButton>
            <UButton
              color="primary"
              :loading="createDynamicFieldLoading"
              :disabled="!isCreateDynamicFieldValid"
              @click="handleCreateDynamicField"
            >
              {{ t('common.create') || 'Создать' }}
            </UButton>
          </div>
        </template>
      </UCard>
    </UModal>

    <!-- Edit Dynamic Field Modal -->
    <UModal
      v-model="showEditDynamicFieldModal"
      @close="closeEditDynamicFieldModal"
    >
      <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
        <template #header>
          <div class="flex items-center justify-between gap-3">
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Редактирование поля
              </h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                Обновите название, параметры и варианты выбора
              </p>
            </div>
            <UButton
              icon="lucide:x"
              size="xs"
              color="gray"
              variant="ghost"
              @click="closeEditDynamicFieldModal"
            />
          </div>
        </template>

        <div class="space-y-4">
          <div
            v-if="editDynamicFieldError"
            class="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 text-sm"
          >
            {{ editDynamicFieldError }}
          </div>

          <div class="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/60 p-3">
            <div class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
              Основное
            </div>
            <div class="grid grid-cols-1 gap-4">
              <UFormGroup
                label="Название"
                required
              >
                <UInput
                  v-model="editDynamicFieldForm.label"
                  :disabled="editDynamicFieldLoading"
                />
              </UFormGroup>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UFormGroup label="Тип данных">
              <UInput
                :model-value="dynamicFieldTypeLabel(editDynamicFieldForm.dataType)"
                disabled
              />
            </UFormGroup>
            <UFormGroup label="Область применения">
              <UInput
                :model-value="dynamicFieldScopeLabel(editDynamicFieldForm.clientTypeScope)"
                disabled
              />
            </UFormGroup>
          </div>

          <div class="flex flex-wrap gap-4">
            <div class="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 flex-1 min-w-[220px]">
              <span class="text-sm text-gray-700 dark:text-gray-300">Показывать звездочку</span>
              <UToggle
                v-model="editDynamicFieldForm.isRequired"
                :disabled="editDynamicFieldLoading || editDynamicFieldForm.dataType === 'BOOLEAN'"
              />
            </div>
          </div>

          <div
            v-if="editDynamicFieldForm.dataType === 'SELECT' || editDynamicFieldForm.dataType === 'MULTI_SELECT'"
            class="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-900/20 p-3 space-y-3"
          >
            <DynamicFieldOptionsEditor
              v-model="editDynamicFieldOptions"
              :disabled="editDynamicFieldLoading"
            />

            <div class="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 p-3">
              <div class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                Превью выбора
              </div>
              <DynamicFieldPreviewControl
                v-model="editPreviewValue"
                :data-type="editDynamicFieldForm.dataType"
                :options="editDynamicFieldOptionChoices"
                :disabled="editDynamicFieldLoading"
                select-placeholder="Выберите вариант"
              />
            </div>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton
              color="gray"
              variant="soft"
              :disabled="editDynamicFieldLoading"
              @click="closeEditDynamicFieldModal"
            >
              {{ t('common.cancel') || 'Отмена' }}
            </UButton>
            <UButton
              color="primary"
              :loading="editDynamicFieldLoading"
              :disabled="!isEditDynamicFieldValid"
              @click="handleEditDynamicField"
            >
              {{ t('common.save') || 'Сохранить' }}
            </UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>
