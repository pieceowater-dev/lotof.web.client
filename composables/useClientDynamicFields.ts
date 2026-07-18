// Client-page dynamic fields: draft state, load/save logic. Consumed by ContactDynamicFields.vue.
import { computed, ref, type Ref } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { logError } from '@/utils/logger';
import {
  listDynamicFieldsWithValues,
  setDynamicFieldValue,
  deleteDynamicFieldValue,
  type DynamicField,
  type DynamicFieldValue,
} from '@/api/contacts/dynamicFields';

export type DynamicFieldDraftValue = string | number | boolean | string[];

export interface UseClientDynamicFieldsDeps {
  contactsAppToken: Ref<string>;
  selectedNS: Ref<string | undefined>;
  clientId: Ref<string | undefined>;
  clientType: Ref<'INDIVIDUAL' | 'LEGAL' | undefined>;
}

export function useClientDynamicFields(deps: UseClientDynamicFieldsDeps) {
  const { t } = useI18n();
  const toast = useToast();

  const dynamicFields = ref<DynamicField[]>([]);
  const dynamicFieldValues = ref<Record<string, DynamicFieldValue>>({});
  const dynamicFieldDrafts = ref<Record<string, DynamicFieldDraftValue>>({});
  const dynamicFieldsLoading = ref(false);
  const dynamicFieldsError = ref<string | null>(null);
  const dynamicFieldsSaving = ref(false);

  const dynamicFieldNameById = computed<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const field of dynamicFields.value) {
      if (field.id && field.label) {
        map[field.id] = field.label;
      }
    }
    return map;
  });

  function applyDynamicFieldValueToDraft(field: DynamicField, value?: DynamicFieldValue) {
    if (!value) {
      if (field.dataType === 'BOOLEAN') {
        dynamicFieldDrafts.value[field.id] = false;
        return;
      }
      if (field.dataType === 'MULTI_SELECT') {
        dynamicFieldDrafts.value[field.id] = [];
        return;
      }
      dynamicFieldDrafts.value[field.id] = '';
      return;
    }

    if (field.dataType === 'NUMBER') {
      dynamicFieldDrafts.value[field.id] = value.valueNumber ?? '';
      return;
    }
    if (field.dataType === 'BOOLEAN') {
      dynamicFieldDrafts.value[field.id] = !!value.valueBool;
      return;
    }
    if (field.dataType === 'DATE') {
      dynamicFieldDrafts.value[field.id] = value.valueDate || '';
      return;
    }

    if (field.dataType === 'MULTI_SELECT') {
      if (value.valueJson) {
        try {
          const parsed = JSON.parse(value.valueJson);
          dynamicFieldDrafts.value[field.id] = Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
        } catch {
          dynamicFieldDrafts.value[field.id] = [];
        }
        return;
      }
      dynamicFieldDrafts.value[field.id] = [];
      return;
    }

    dynamicFieldDrafts.value[field.id] = value.valueString || '';
  }

  function isDynamicFieldsEmptyStateError(error: unknown): boolean {
    const message = String((error as any)?.message || error || '').toLowerCase();
    const mentionsDynamicField = message.includes('dynamic field') || message.includes('dynamicfield');
    return (message.includes('not found') && mentionsDynamicField)
      || (message.includes('no rows') && mentionsDynamicField)
      || (message.includes('no data') && mentionsDynamicField)
      || message.includes('no dynamic fields')
      || message.includes('no dynamic field values');
  }

  function resetDynamicFields() {
    dynamicFields.value = [];
    dynamicFieldValues.value = {};
    dynamicFieldDrafts.value = {};
  }

  async function loadDynamicFieldsForClient(contactsToken: string, namespace: string, entityId: string) {
    dynamicFieldsLoading.value = true;
    dynamicFieldsError.value = null;

    try {
      const { dynamicFields: fieldsResp, dynamicFieldValues: valuesResp } =
        await listDynamicFieldsWithValues(contactsToken, namespace, entityId, { includeDeleted: false });

      const rawFields = fieldsResp?.rows || [];
      const isIndividual = deps.clientType.value === 'INDIVIDUAL';

      const filteredFields = rawFields
        .filter((field) => {
          if (field.clientTypeScope === 'ALL') return true;
          if (field.clientTypeScope === 'INDIVIDUAL') return isIndividual;
          if (field.clientTypeScope === 'LEGAL') return !isIndividual;
          return true;
        })
        .slice()
        .sort((a, b) => a.viewOrder - b.viewOrder);

      dynamicFields.value = filteredFields;

      if (filteredFields.length === 0) {
        dynamicFieldValues.value = {};
        dynamicFieldDrafts.value = {};
        return;
      }

      const valueRows = valuesResp?.rows || [];
      const nextValues: Record<string, DynamicFieldValue> = {};
      for (const value of valueRows) {
        nextValues[value.fieldId] = value;
      }
      dynamicFieldValues.value = nextValues;

      const nextDrafts: Record<string, DynamicFieldDraftValue> = {};
      for (const field of filteredFields) {
        const existingValue = nextValues[field.id];
        if (!existingValue) {
          if (field.dataType === 'BOOLEAN') {
            nextDrafts[field.id] = false;
          } else if (field.dataType === 'MULTI_SELECT') {
            nextDrafts[field.id] = [];
          } else {
            nextDrafts[field.id] = '';
          }
          continue;
        }

        if (field.dataType === 'NUMBER') {
          nextDrafts[field.id] = existingValue.valueNumber ?? '';
        } else if (field.dataType === 'BOOLEAN') {
          nextDrafts[field.id] = !!existingValue.valueBool;
        } else if (field.dataType === 'DATE') {
          nextDrafts[field.id] = existingValue.valueDate || '';
        } else if (field.dataType === 'MULTI_SELECT') {
          if (existingValue.valueJson) {
            try {
              const parsed = JSON.parse(existingValue.valueJson);
              nextDrafts[field.id] = Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
            } catch {
              nextDrafts[field.id] = [];
            }
          } else {
            nextDrafts[field.id] = [];
          }
        } else {
          nextDrafts[field.id] = existingValue.valueString || '';
        }
      }
      dynamicFieldDrafts.value = nextDrafts;
    } catch (error) {
      if (isDynamicFieldsEmptyStateError(error)) {
        resetDynamicFields();
        dynamicFieldsError.value = null;
        return;
      }

      logError('Failed to load dynamic fields for client:', error);
      dynamicFieldsError.value = t('common.errorDetails.loadFailed') || 'Failed to load data';
    } finally {
      dynamicFieldsLoading.value = false;
    }
  }

  function hasDynamicFieldInputValue(field: DynamicField): boolean {
    const rawValue = dynamicFieldDrafts.value[field.id];

    if (field.dataType === 'MULTI_SELECT') {
      return Array.isArray(rawValue) && rawValue.length > 0;
    }

    if (field.dataType === 'BOOLEAN') {
      return typeof rawValue === 'boolean';
    }

    if (field.dataType === 'NUMBER') {
      if (rawValue === '' || rawValue === null || rawValue === undefined) return false;
      const parsed = Number(rawValue);
      return Number.isFinite(parsed);
    }

    const text = String(rawValue ?? '').trim();
    return text.length > 0;
  }

  async function saveDynamicFields() {
    if (!deps.contactsAppToken.value || !deps.selectedNS.value || !deps.clientId.value) return;

    try {
      dynamicFieldsSaving.value = true;

      for (const field of dynamicFields.value) {
        const rawValue = dynamicFieldDrafts.value[field.id];
        const existing = dynamicFieldValues.value[field.id];
        const hasValue = hasDynamicFieldInputValue(field);

        if (!hasValue) {
          if (existing) {
            await deleteDynamicFieldValue(deps.contactsAppToken.value, deps.selectedNS.value, existing.id);
            delete dynamicFieldValues.value[field.id];
          }
          applyDynamicFieldValueToDraft(field, undefined);
          continue;
        }

        const input: {
          fieldId: string;
          entityId: string;
          valueString?: string;
          valueNumber?: number;
          valueBool?: boolean;
          valueDate?: string;
          valueJson?: string;
        } = {
          fieldId: field.id,
          entityId: deps.clientId.value,
        };

        if (field.dataType === 'NUMBER') {
          input.valueNumber = Number(rawValue);
        } else if (field.dataType === 'BOOLEAN') {
          input.valueBool = !!rawValue;
        } else if (field.dataType === 'DATE') {
          input.valueDate = String(rawValue || '');
        } else if (field.dataType === 'MULTI_SELECT') {
          input.valueJson = JSON.stringify(Array.isArray(rawValue) ? rawValue : []);
        } else {
          input.valueString = String(rawValue || '');
        }

        const result = await setDynamicFieldValue(deps.contactsAppToken.value, deps.selectedNS.value, input);
        dynamicFieldValues.value[field.id] = result.setDynamicFieldValue;
        applyDynamicFieldValueToDraft(field, result.setDynamicFieldValue);
      }

      toast.add({ title: t('common.success') || 'Success', description: t('common.save') || 'Saved', color: 'emerald' });
    } catch (error) {
      logError('Failed to save dynamic field value:', error);
      toast.add({ title: t('common.error') || 'Error', description: t('contacts.updateError') || 'Update failed', color: 'red' });
    } finally {
      dynamicFieldsSaving.value = false;
    }
  }

  return {
    dynamicFields,
    dynamicFieldValues,
    dynamicFieldDrafts,
    dynamicFieldsLoading,
    dynamicFieldsError,
    dynamicFieldsSaving,
    dynamicFieldNameById,
    applyDynamicFieldValueToDraft,
    isDynamicFieldsEmptyStateError,
    loadDynamicFieldsForClient,
    hasDynamicFieldInputValue,
    saveDynamicFields,
    resetDynamicFields,
  };
}
