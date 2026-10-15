<script lang="ts" setup>
import { atModalUi, atCardUiFit } from '@/utils/atraceUi';
import { useI18n } from '@/composables/useI18n';
import { useMenuToken } from '@/composables/useMenuToken';
import { useConfirm } from '@/composables/useConfirm';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import AppSkeleton from '@/components/ui/AppSkeleton.vue';
import OrderFieldInput from '@/components/menu/OrderFieldInput.vue';
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
  { label: t('menu.orderFieldTypeTextarea'), value: 'TEXTAREA' },
  { label: t('menu.orderFieldTypeNumber') || 'Number', value: 'NUMBER' },
  { label: t('menu.orderFieldTypeBoolean') || 'Yes / No', value: 'BOOLEAN' },
  { label: t('menu.orderFieldTypeDate') || 'Date', value: 'DATE' },
  { label: t('menu.orderFieldTypeDateTime'), value: 'DATETIME' },
  { label: t('menu.orderFieldTypeSelect') || 'Choice from list', value: 'SELECT' },
  { label: t('menu.orderFieldTypeMulti'), value: 'MULTISELECT' },
  { label: t('menu.orderFieldTypeHeading'), value: 'HEADING' },
]);
const sourceOptions = computed(() => [
  { label: t('menu.orderFieldSourceStatic'), value: 'STATIC' },
  { label: t('menu.orderFieldSourceStaff'), value: 'STAFF' },
  { label: t('menu.orderFieldSourceBranches'), value: 'BRANCHES' },
]);
const isList = (ty: string) => ty === 'SELECT' || ty === 'MULTISELECT';
const typeLabel = (type: string) => typeOptions.value.find((o) => o.value === type)?.label || type;

const TYPE_ICONS: Record<string, string> = {
  TEXT: 'lucide:type', TEXTAREA: 'lucide:align-left', NUMBER: 'lucide:hash', BOOLEAN: 'lucide:toggle-left',
  DATE: 'lucide:calendar', DATETIME: 'lucide:calendar-clock', SELECT: 'lucide:list', MULTISELECT: 'lucide:list-checks', HEADING: 'lucide:heading',
};
const typeIcon = (ty: string) => TYPE_ICONS[ty] || 'lucide:type';

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
  defaultValue: '',
  placeholder: '',
  hint: '',
  source: 'STATIC',
  copyToWarranty: true,
});

function openCreate() {
  editing.value = null;
  form.label = '';
  form.dataType = 'TEXT';
  form.optionsText = '';
  form.isRequired = false;
  form.isActive = true;
  Object.assign(form, { defaultValue: '', placeholder: '', hint: '', source: 'STATIC', copyToWarranty: true });
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
  Object.assign(form, { defaultValue: row.defaultValue || '', placeholder: row.placeholder || '', hint: row.hint || '', source: row.source || 'STATIC', copyToWarranty: row.copyToWarranty !== false });
  form.viewOrder = row.viewOrder;
  isModalOpen.value = true;
}

const parsedOptions = computed(() =>
  form.optionsText.split('\n').map((o) => o.trim()).filter(Boolean)
);
// The field being edited, as the order form would receive it (drives the live preview).
const previewField = computed<MenuOrderField>(() => ({
  id: 'preview',
  label: form.label,
  dataType: form.dataType,
  isRequired: form.isRequired,
  options: isList(form.dataType) && form.source === 'STATIC' ? parsedOptions.value : [],
  viewOrder: 0,
  isActive: true,
  defaultValue: form.defaultValue,
  placeholder: form.placeholder,
  hint: form.hint,
  source: isList(form.dataType) ? (form.source as any) : 'STATIC',
}));
const isFormValid = computed(() =>
  form.label.trim().length > 0 && (!isList(form.dataType) || form.source !== 'STATIC' || parsedOptions.value.length > 0)
);

async function handleSave() {
  if (!isFormValid.value || saving.value) return;
  saving.value = true;
  try {
    const base = {
      label: form.label.trim(),
      dataType: form.dataType,
      isRequired: form.isRequired,
      options: isList(form.dataType) && form.source === 'STATIC' ? parsedOptions.value : [],
      viewOrder: Number(form.viewOrder) || 0,
      defaultValue: form.defaultValue.trim(),
      placeholder: form.placeholder.trim(),
      hint: form.hint.trim(),
      source: isList(form.dataType) ? form.source : 'STATIC',
      copyToWarranty: form.copyToWarranty,
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

    <div class="min-h-0 flex-1 overflow-y-auto">
      <AppSkeleton v-if="loading && !fields.length" variant="cards" :rows="3" />
      <div v-else-if="!fields.length" class="at-panel flex flex-col items-center gap-2 !p-8 text-center text-sm text-gray-500">
        <Icon name="lucide:list-plus" class="h-8 w-8 opacity-50" />{{ t('menu.orderFieldsEmpty') || 'No fields yet' }}
      </div>
      <!-- A field is shown the way the order form will show it: real control, read-only. -->
      <div v-else class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div
          v-for="f in fields"
          :key="f.id"
          class="at-panel group flex cursor-pointer flex-col gap-3 !p-4 transition hover:-translate-y-0.5"
          :class="f.isActive ? '' : 'opacity-60'"
          role="button"
          tabindex="0"
          @click="openEdit(f)"
          @keydown.enter="openEdit(f)"
        >
          <div class="flex items-start gap-2.5">
            <span class="icon-tile !h-9 !w-9 flex-shrink-0"><Icon :name="typeIcon(f.dataType)" class="h-4 w-4" /></span>
            <div class="min-w-0 flex-1">
              <div class="truncate font-semibold text-gray-900 dark:text-white">{{ f.label }}</div>
              <div class="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                <span>{{ typeLabel(f.dataType) }}</span>
                <span v-if="f.isRequired" class="at-chip !px-1.5 !py-0 !text-[11px]">{{ t('menu.orderFieldRequired') || 'Required' }}</span>
                <span v-if="!f.isActive" class="at-chip !px-1.5 !py-0 !text-[11px]">{{ t('menu.docTemplateInactive') || 'Inactive' }}</span>
              </div>
            </div>
            <div class="flex flex-shrink-0 items-center opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100" @click.stop>
              <button type="button" class="cp-icon" :aria-label="t('common.delete')" @click="handleDelete(f)"><Icon name="lucide:trash-2" class="h-4 w-4 text-red-500" /></button>
            </div>
          </div>
          <div v-if="f.dataType !== 'HEADING'" class="pointer-events-none" aria-hidden="true">
            <OrderFieldInput :field="f" :model-value="f.defaultValue || ''" disabled />
          </div>
        </div>
      </div>
    </div>

    <UModal class="at-modal" v-model="isModalOpen" :ui="{ ...atModalUi, width: 'sm:max-w-md' }">
      <UCard :ui="atCardUiFit">
        <template #header>
          <h3 class="text-lg font-semibold">
            {{ editing ? (t('menu.orderFieldEdit') || 'Edit field') : (t('menu.orderFieldNew') || 'New field') }}
          </h3>
        </template>

        <div class="space-y-4">
          <!-- Live preview: the field exactly as the order form will show it. -->
          <div class="rounded-2xl bg-gray-50 p-4 dark:bg-gray-800/40">
            <div class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{{ t('menu.orderFieldPreview') || 'Preview' }}</div>
            <div class="pointer-events-none" aria-hidden="true">
              <OrderFieldInput v-if="form.dataType === 'HEADING'" :field="previewField" model-value="" />
              <UFormGroup v-else :label="form.label.trim() || (t('menu.orderFieldLabel') || 'Name')" :required="form.isRequired" :help="form.hint || undefined">
                <OrderFieldInput :field="previewField" :model-value="form.defaultValue" disabled />
              </UFormGroup>
            </div>
          </div>
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
          <UFormGroup v-if="isList(form.dataType)" :label="t('menu.orderFieldSource')">
            <div class="overflow-x-auto"><div class="at-seg">
              <button v-for="o in sourceOptions" :key="o.value" type="button" class="at-seg__btn" :class="form.source === o.value ? 'at-seg__btn--on' : ''" @click="form.source = o.value">{{ o.label }}</button>
            </div></div>
          </UFormGroup>
          <UFormGroup
            v-if="isList(form.dataType) && form.source === 'STATIC'"
            :label="t('menu.orderFieldOptions') || 'Options'"
            :help="t('menu.orderFieldOptionsHint') || 'One option per line'"
            required
          >
            <UTextarea v-model="form.optionsText" :rows="4" :ui="{ rounded: 'rounded-xl' }" />
          </UFormGroup>
          <template v-if="form.dataType !== 'HEADING'">
            <UFormGroup :label="t('menu.orderFieldDefault')">
              <UInput v-model="form.defaultValue" :ui="{ rounded: 'rounded-xl' }" />
            </UFormGroup>
            <div class="grid grid-cols-2 gap-4">
              <UFormGroup :label="t('menu.orderFieldPlaceholder')"><UInput v-model="form.placeholder" :ui="{ rounded: 'rounded-xl' }" /></UFormGroup>
              <UFormGroup :label="t('menu.orderFieldHint')"><UInput v-model="form.hint" :ui="{ rounded: 'rounded-xl' }" /></UFormGroup>
            </div>
          </template>
          <div class="grid grid-cols-2 gap-4">
            <UFormGroup :label="t('menu.orderFieldOrder') || 'Order'">
              <UInput v-model="form.viewOrder" type="number" min="0" :ui="{ rounded: 'rounded-xl' }" />
            </UFormGroup>
            <div class="flex flex-col justify-end gap-3 pb-1">
              <label v-if="form.dataType !== 'HEADING'" class="flex items-center gap-2 text-sm">
                <UToggle v-model="form.isRequired" />
                {{ t('menu.orderFieldRequired') || 'Required' }}
              </label>
              <label v-if="form.dataType !== 'HEADING'" class="flex items-center gap-2 text-sm">
                <UToggle v-model="form.copyToWarranty" />
                {{ t('menu.orderFieldCopyWarranty') }}
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
