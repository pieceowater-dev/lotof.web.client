<script lang="ts" setup>
import { atModalUi, atCardUi } from '@/utils/atraceUi';
import { useI18n } from '@/composables/useI18n';
import { useMenuToken } from '@/composables/useMenuToken';
import { useConfirm } from '@/composables/useConfirm';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import AppTable from '@/components/ui/AppTable.vue';
import type { MenuOrderField, OrderFieldDataType } from '@/api/menu/orderfield/list';

const { t } = useI18n();
const { confirm } = useConfirm();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);

const fields = ref<MenuOrderField[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

const typeOptions = computed<{ label: string; value: OrderFieldDataType }[]>(() => [
  { label: t('menu.orderFieldTypeText') || 'Text', value: 'TEXT' },
  { label: t('menu.orderFieldTypeNumber') || 'Number', value: 'NUMBER' },
  { label: t('menu.orderFieldTypeBoolean') || 'Yes / No', value: 'BOOLEAN' },
  { label: t('menu.orderFieldTypeDate') || 'Date', value: 'DATE' },
  { label: t('menu.orderFieldTypeSelect') || 'Choice from list', value: 'SELECT' },
]);
const typeLabel = (type: string) => typeOptions.value.find((o) => o.value === type)?.label || type;

const columns = computed(() => [
  { key: 'label', label: t('menu.orderFieldLabel') || 'Name' },
  { key: 'dataType', label: t('menu.orderFieldType') || 'Type' },
  { key: 'isRequired', label: t('menu.orderFieldRequired') || 'Required' },
  { key: 'isActive', label: t('menu.docTemplateStatus') || 'Status' },
  { key: 'actions', label: t('app.actions') || 'Actions' },
]);

function getToken(): string {
  const { current } = useMenuToken();
  const menuToken = current();
  if (!menuToken) throw new Error('No menu token');
  return menuToken;
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const { menuOrderFieldsList } = await import('@/api/menu/orderfield/list');
    fields.value = (await menuOrderFieldsList(getToken(), nsSlug.value)).fields;
  } catch (e) {
    logError('[menu/settings/orderFields] load failed', e);
    error.value = getErrorMessage(e, t) || 'Failed to load fields';
  } finally {
    loading.value = false;
  }
}

const isModalOpen = ref(false);
const editing = ref<MenuOrderField | null>(null);
const saving = ref(false);
const form = reactive({
  label: '',
  dataType: 'TEXT' as OrderFieldDataType,
  optionsText: '',
  isRequired: false,
  isActive: true,
  viewOrder: 0,
});

function openCreate() {
  editing.value = null;
  form.label = '';
  form.dataType = 'TEXT';
  form.optionsText = '';
  form.isRequired = false;
  form.isActive = true;
  form.viewOrder = fields.value.length ? Math.max(...fields.value.map((f) => f.viewOrder)) + 1 : 0;
  isModalOpen.value = true;
}

function openEdit(row: MenuOrderField) {
  editing.value = row;
  form.label = row.label;
  form.dataType = row.dataType;
  form.optionsText = row.options.join('\n');
  form.isRequired = row.isRequired;
  form.isActive = row.isActive;
  form.viewOrder = row.viewOrder;
  isModalOpen.value = true;
}

const parsedOptions = computed(() =>
  form.optionsText.split('\n').map((o) => o.trim()).filter(Boolean)
);
const isFormValid = computed(() =>
  form.label.trim().length > 0 && (form.dataType !== 'SELECT' || parsedOptions.value.length > 0)
);

async function handleSave() {
  if (!isFormValid.value || saving.value) return;
  saving.value = true;
  try {
    const base = {
      label: form.label.trim(),
      dataType: form.dataType,
      isRequired: form.isRequired,
      options: form.dataType === 'SELECT' ? parsedOptions.value : [],
      viewOrder: Number(form.viewOrder) || 0,
    };
    if (editing.value) {
      const { menuUpdateOrderField } = await import('@/api/menu/orderfield/update');
      const updated = await menuUpdateOrderField(getToken(), nsSlug.value, editing.value.id, { ...base, isActive: form.isActive });
      const idx = fields.value.findIndex((f) => f.id === updated.id);
      if (idx !== -1) fields.value[idx] = updated;
      useToast().add({ title: t('menu.orderFieldUpdated') || 'Field updated', color: 'primary' });
    } else {
      const { menuCreateOrderField } = await import('@/api/menu/orderfield/create');
      fields.value = [...fields.value, await menuCreateOrderField(getToken(), nsSlug.value, base)];
      useToast().add({ title: t('menu.orderFieldCreated') || 'Field created', color: 'primary' });
    }
    fields.value = [...fields.value].sort((a, b) => a.viewOrder - b.viewOrder);
    isModalOpen.value = false;
  } catch (e) {
    logError('[menu/settings/orderFields] save failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to save field', color: 'red' });
  } finally {
    saving.value = false;
  }
}

async function handleDelete(row: MenuOrderField) {
  if (!(await confirm({ message: t('menu.confirmDeleteOrderField') || 'Delete this field? Values already saved in orders stop being shown.' }))) return;
  try {
    const { menuDeleteOrderField } = await import('@/api/menu/orderfield/delete');
    await menuDeleteOrderField(getToken(), nsSlug.value, row.id);
    fields.value = fields.value.filter((f) => f.id !== row.id);
    useToast().add({ title: t('menu.orderFieldDeleted') || 'Field deleted', color: 'primary' });
  } catch (e) {
    logError('[menu/settings/orderFields] delete failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to delete field', color: 'red' });
  }
}

onMounted(load);
</script>

<template>
  <div class="h-full flex flex-col min-h-0">
    <div class="flex items-start justify-between gap-3 mb-3 flex-shrink-0">
      <p class="text-sm text-gray-600 dark:text-gray-400">
        {{ t('menu.orderFieldsIntro') || 'Extra details every order carries — for example a device model and serial number, or a licence plate.' }}
      </p>
      <UButton size="xs" color="primary" icon="lucide:plus" class="min-w-fit whitespace-nowrap" @click="openCreate">
        {{ t('menu.orderFieldNew') || 'New field' }}
      </UButton>
    </div>

    <div v-if="error" class="mb-4 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm px-3 py-2">
      {{ error }}
    </div>

    <div class="flex-1 min-h-0">
      <AppTable soft :rows="fields" :columns="columns" :loading="loading" empty-icon="lucide:list-plus">
        <template #label-data="{ row }">
          <button type="button" class="font-medium text-gray-900 dark:text-gray-100 hover:text-primary-600 dark:hover:text-primary-400 text-left" @click="openEdit(row)">
            {{ row.label }}
          </button>
        </template>
        <template #dataType-data="{ row }">
          <span class="text-gray-600 dark:text-gray-300">{{ typeLabel(row.dataType) }}</span>
        </template>
        <template #isRequired-data="{ row }">
          <UIcon v-if="row.isRequired" name="lucide:check" class="w-4 h-4 text-primary-600" />
          <span v-else class="text-gray-400">—</span>
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

    <UModal class="at-modal" v-model="isModalOpen" :ui="{ ...atModalUi, width: 'sm:max-w-md' }">
      <UCard :ui="atCardUi">
        <template #header>
          <h3 class="text-lg font-semibold">
            {{ editing ? (t('menu.orderFieldEdit') || 'Edit field') : (t('menu.orderFieldNew') || 'New field') }}
          </h3>
        </template>

        <div class="space-y-4">
          <UFormGroup :label="t('menu.orderFieldLabel') || 'Name'" required>
            <UInput v-model="form.label" :placeholder="t('menu.orderFieldLabelPlaceholder') || 'e.g. Serial number'" :ui="{ rounded: 'rounded-xl' }" />
          </UFormGroup>
          <UFormGroup :label="t('menu.orderFieldType') || 'Type'">
            <USelectMenu
              v-model="form.dataType"
              :options="typeOptions"
              value-attribute="value"
              option-attribute="label"
              :ui="{ rounded: 'rounded-xl' }"
              :popper="{ strategy: 'fixed' }"
            />
          </UFormGroup>
          <UFormGroup
            v-if="form.dataType === 'SELECT'"
            :label="t('menu.orderFieldOptions') || 'Options'"
            :help="t('menu.orderFieldOptionsHint') || 'One option per line'"
            required
          >
            <UTextarea v-model="form.optionsText" :rows="4" :ui="{ rounded: 'rounded-xl' }" />
          </UFormGroup>
          <div class="grid grid-cols-2 gap-4">
            <UFormGroup :label="t('menu.orderFieldOrder') || 'Order'">
              <UInput v-model="form.viewOrder" type="number" min="0" :ui="{ rounded: 'rounded-xl' }" />
            </UFormGroup>
            <div class="flex flex-col justify-end gap-3 pb-1">
              <label class="flex items-center gap-2 text-sm">
                <UToggle v-model="form.isRequired" />
                {{ t('menu.orderFieldRequired') || 'Required' }}
              </label>
              <label v-if="editing" class="flex items-center gap-2 text-sm">
                <UToggle v-model="form.isActive" />
                {{ t('menu.docTemplateActive') || 'Active' }}
              </label>
            </div>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="ghost" :label="t('app.cancel')" :disabled="saving" @click="isModalOpen = false" />
            <UButton
              color="primary"
              class="rounded-xl"
              :label="saving ? (t('app.loading') || 'Loading...') : (t('app.save') || 'Save')"
              :loading="saving"
              :disabled="!isFormValid || saving"
              @click="handleSave"
            />
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>
