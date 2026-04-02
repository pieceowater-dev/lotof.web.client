<script setup lang="ts">
import { computed } from 'vue';
import type { DynamicField } from '@/api/contacts/dynamicFields';

type DraftValue = string | number | boolean | string[];

interface Props {
  field: DynamicField;
  modelValue: DraftValue;
  disabled?: boolean;
  yesLabel?: string;
  noLabel?: string;
  noneSelectedLabel?: string;
  selectOptionsLabel?: string;
  selectedCountSuffix?: string;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  yesLabel: 'Да',
  noLabel: 'Нет',
  noneSelectedLabel: 'Ничего не выбрано',
  selectOptionsLabel: 'Выберите варианты',
  selectedCountSuffix: 'выбрано',
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: DraftValue): void;
}>();

const options = computed(() => {
  const raw = Array.isArray(props.field.options) ? props.field.options : [];
  return raw.map((option) => ({ label: option, value: option }));
});

const booleanValue = computed<boolean>({
  get: () => (typeof props.modelValue === 'boolean' ? props.modelValue : false),
  set: (value) => emit('update:modelValue', value),
});

const inputValue = computed<string | number>({
  get: () => (typeof props.modelValue === 'string' || typeof props.modelValue === 'number' ? props.modelValue : ''),
  set: (value) => emit('update:modelValue', value),
});

const selectValue = computed<string>({
  get: () => (typeof props.modelValue === 'string' ? props.modelValue : ''),
  set: (value) => emit('update:modelValue', value),
});

const multiSelectValue = computed<string[]>({
  get: () => (Array.isArray(props.modelValue) ? props.modelValue.map((item) => String(item)) : []),
  set: (value) => emit('update:modelValue', value),
});

const multiSelectLabel = computed(() => {
  const count = multiSelectValue.value.length;
  if (count === 0) {
    return props.selectOptionsLabel;
  }
  return `${count} ${props.selectedCountSuffix}`;
});
</script>

<template>
  <div class="flex flex-col gap-3">
    <template v-if="field.dataType === 'BOOLEAN'">
      <div class="flex items-center justify-between rounded-md bg-gray-50 dark:bg-gray-900 px-3 py-2">
        <span class="text-sm text-gray-700 dark:text-gray-300">{{ booleanValue ? yesLabel : noLabel }}</span>
        <UToggle
          v-model="booleanValue"
          :disabled="disabled"
        />
      </div>
    </template>

    <template v-else-if="field.dataType === 'SELECT'">
      <USelectMenu
        v-model="selectValue"
        :options="options"
        value-attribute="value"
        option-attribute="label"
        :disabled="disabled"
      />
    </template>

    <template v-else-if="field.dataType === 'MULTI_SELECT'">
      <USelectMenu
        v-model="multiSelectValue"
        :options="options"
        value-attribute="value"
        option-attribute="label"
        :disabled="disabled"
        multiple
      >
        <template #label>
          {{ multiSelectLabel }}
        </template>
      </USelectMenu>

      <div
        v-if="multiSelectValue.length > 0"
        class="flex flex-wrap gap-1.5 pt-1"
      >
        <UBadge
          v-for="selectedValue in multiSelectValue"
          :key="`${field.id}-${selectedValue}`"
          color="primary"
          variant="soft"
          size="xs"
        >
          {{ selectedValue }}
        </UBadge>
      </div>

      <p
        v-else
        class="text-xs text-gray-500 dark:text-gray-400"
      >
        {{ noneSelectedLabel }}
      </p>
    </template>

    <template v-else>
      <UInput
        v-model="inputValue"
        class="w-full"
        :type="field.dataType === 'NUMBER' ? 'number' : field.dataType === 'DATE' ? 'date' : 'text'"
        :disabled="disabled"
      />
    </template>
  </div>
</template>
