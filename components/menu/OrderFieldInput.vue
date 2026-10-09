<script lang="ts" setup>
import type { MenuOrderField } from '@/api/menu/orderfield/list';

// One input for one custom order field, rendered by the field's data type.
// Every value is a string at the boundary (see utils/orderCustomFields.ts):
// booleans are 'true' / '' and numbers/dates stay as the raw input text.
const props = defineProps<{
  field: MenuOrderField;
  modelValue: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>();

const value = computed({
  get: () => props.modelValue ?? '',
  set: (v: string) => emit('update:modelValue', v ?? ''),
});

const checked = computed({
  get: () => props.modelValue === 'true',
  set: (v: boolean) => emit('update:modelValue', v ? 'true' : ''),
});

const selectOptions = computed(() => props.field.options.map((o) => ({ label: o, value: o })));
</script>

<template>
  <UToggle v-if="field.dataType === 'BOOLEAN'" v-model="checked" :disabled="disabled" />
  <USelectMenu
    v-else-if="field.dataType === 'SELECT'"
    v-model="value"
    :options="selectOptions"
    value-attribute="value"
    option-attribute="label"
    :disabled="disabled"
    :ui="{ rounded: 'rounded-xl' }"
    :popper="{ strategy: 'fixed' }"
  />
  <UInput
    v-else-if="field.dataType === 'NUMBER'"
    v-model="value"
    type="number"
    inputmode="decimal"
    :disabled="disabled"
    :ui="{ rounded: 'rounded-xl' }"
  />
  <UInput
    v-else-if="field.dataType === 'DATE'"
    v-model="value"
    type="date"
    :disabled="disabled"
    :ui="{ rounded: 'rounded-xl' }"
  />
  <UInput v-else v-model="value" :disabled="disabled" :ui="{ rounded: 'rounded-xl' }" />
</template>
