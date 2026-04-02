<script setup lang="ts">
import { computed } from 'vue';
import type { DynamicFieldDataType } from '@/api/contacts/dynamicFields';

type PreviewValue = string | number | boolean | string[];

interface Props {
  dataType: DynamicFieldDataType;
  modelValue: PreviewValue;
  options: Array<{ label: string; value: string }>;
  disabled?: boolean;
  stringPlaceholder?: string;
  numberPlaceholder?: string;
  selectPlaceholder?: string;
  yesLabel?: string;
  noLabel?: string;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  stringPlaceholder: 'Текстовое значение',
  numberPlaceholder: '0',
  selectPlaceholder: 'Выберите вариант',
  yesLabel: 'Да',
  noLabel: 'Нет',
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: PreviewValue): void;
}>();

const inputValue = computed<string | number>({
  get: () => (typeof props.modelValue === 'string' || typeof props.modelValue === 'number' ? props.modelValue : ''),
  set: (value) => emit('update:modelValue', value),
});

const toggleValue = computed<boolean>({
  get: () => (typeof props.modelValue === 'boolean' ? props.modelValue : false),
  set: (value) => emit('update:modelValue', value),
});

const selectValue = computed<string | undefined>({
  get: () => (typeof props.modelValue === 'string' ? props.modelValue : undefined),
  set: (value) => emit('update:modelValue', value || ''),
});

const multiSelectValue = computed<string[]>({
  get: () => (Array.isArray(props.modelValue) ? props.modelValue.map((item) => String(item)) : []),
  set: (value) => emit('update:modelValue', value),
});
</script>

<template>
  <UInput
    v-if="dataType === 'STRING'"
    v-model="inputValue"
    :placeholder="stringPlaceholder"
    :disabled="disabled"
  />

  <UInput
    v-else-if="dataType === 'NUMBER'"
    v-model.number="inputValue"
    type="number"
    :placeholder="numberPlaceholder"
    :disabled="disabled"
  />

  <div
    v-else-if="dataType === 'BOOLEAN'"
    class="flex items-center gap-2"
  >
    <UToggle
      v-model="toggleValue"
      :disabled="disabled"
    />
    <span class="text-sm text-slate-600 dark:text-slate-300">{{ toggleValue ? yesLabel : noLabel }}</span>
  </div>

  <UInput
    v-else-if="dataType === 'DATE'"
    v-model="inputValue"
    type="date"
    :disabled="disabled"
  />

  <USelectMenu
    v-else-if="dataType === 'SELECT'"
    v-model="selectValue"
    :options="options"
    value-attribute="value"
    option-attribute="label"
    :disabled="disabled || options.length === 0"
    :placeholder="selectPlaceholder"
  />

  <USelectMenu
    v-else-if="dataType === 'MULTI_SELECT'"
    v-model="multiSelectValue"
    :options="options"
    value-attribute="value"
    option-attribute="label"
    multiple
    :disabled="disabled || options.length === 0"
    placeholder="Выберите варианты"
  />
</template>
