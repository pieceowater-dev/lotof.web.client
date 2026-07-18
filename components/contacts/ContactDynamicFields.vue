<script setup lang="ts">
import { useI18n } from '@/composables/useI18n';
import type { DynamicField } from '@/api/contacts/dynamicFields';
import DynamicFieldInput from '@/components/contacts/DynamicFieldInput.vue';

type DraftValue = string | number | boolean | string[];

interface Props {
  fields: DynamicField[];
  drafts: Record<string, DraftValue>;
  loading?: boolean;
  error?: string | null;
  saving?: boolean;
}

interface Emits {
  saveAll: [];
  updateDraft: [fieldId: string, value: DraftValue];
}

withDefaults(defineProps<Props>(), {
  loading: false,
  error: null,
  saving: false,
});

const emit = defineEmits<Emits>();
const { t } = useI18n();
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Дополнительные поля
          </h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            Значения динамических полей клиента
          </p>
        </div>
        <UButton
          color="primary"
          size="xs"
          :loading="saving"
          :disabled="loading"
          @click="() => emit('saveAll')"
        >
          Сохранить все
        </UButton>
      </div>
    </template>

    <div
      v-if="loading"
      class="py-6 text-center text-sm text-gray-500 dark:text-gray-400"
    >
      {{ t('common.loading') }}
    </div>

    <div
      v-else-if="error"
      class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200"
    >
      {{ error }}
    </div>

    <div
      v-else-if="fields.length === 0"
      class="py-6 text-center text-sm text-gray-500 dark:text-gray-400"
    >
      Поля не настроены
    </div>

    <div
      v-else
      class="space-y-3"
    >
      <div
        v-for="field in fields"
        :key="field.id"
        class="py-2"
      >
        <div class="mb-2 flex items-center justify-between gap-3">
          <div class="text-sm font-medium text-gray-900 dark:text-gray-100">
            {{ field.label }}
            <span
              v-if="field.isRequired"
              class="text-red-500"
            >*</span>
          </div>
        </div>

        <DynamicFieldInput
          :model-value="drafts[field.id]"
          :field="field"
          :disabled="saving"
          :yes-label="t('contacts.yes') || 'Да'"
          :no-label="t('contacts.no') || 'Нет'"
          :none-selected-label="t('contacts.noneSelected') || 'Ничего не выбрано'"
          :select-options-label="t('contacts.selectOptions') || 'Выберите варианты'"
          :selected-count-suffix="t('contacts.selectedCountSuffix') || 'выбрано'"
          @update:model-value="(value) => emit('updateDraft', field.id, value)"
        />
      </div>
    </div>
  </UCard>
</template>
