<script lang="ts" setup>
import type { MenuOrderField } from '@/api/menu/orderfield/list';
import { parseMulti, serializeMulti } from '@/utils/orderCustomFields';

// One input for one custom order field, rendered by the field's data type.
// Every value is a string at the boundary (see utils/orderCustomFields.ts):
// booleans are 'true' / '', multi-choice is a JSON array, numbers/dates stay
// as the raw input text. Lists sourced from staff or branches arrive through
// `sourceOptions` (names; the name is what gets stored).
const props = defineProps<{
  field: MenuOrderField;
  modelValue: string;
  disabled?: boolean;
  sourceOptions?: { staff?: string[]; branches?: string[] };
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

const names = computed(() => {
  if (props.field.source === 'STAFF') return props.sourceOptions?.staff ?? [];
  if (props.field.source === 'BRANCHES') return props.sourceOptions?.branches ?? [];
  return props.field.options;
});
const selectOptions = computed(() => {
  const list = [...names.value];
  // keep a stored value selectable even when it left the list
  if (props.field.dataType === 'SELECT' && value.value && !list.includes(value.value)) list.unshift(value.value);
  return list.map((o) => ({ label: o, value: o }));
});

const picked = computed(() => parseMulti(props.modelValue));
function toggle(o: string) {
  const cur = picked.value;
  emit('update:modelValue', serializeMulti(cur.includes(o) ? cur.filter((x) => x !== o) : [...cur, o]));
}
</script>

<template>
  <div v-if="field.dataType === 'HEADING'" class="pt-1 text-sm font-semibold text-slate-700 dark:text-slate-200">{{ field.label }}</div>
  <UToggle v-else-if="field.dataType === 'BOOLEAN'" v-model="checked" :disabled="disabled" />
  <USelectMenu
    v-else-if="field.dataType === 'SELECT'"
    v-model="value"
    :options="selectOptions"
    value-attribute="value"
    option-attribute="label"
    :placeholder="field.placeholder || undefined"
    :disabled="disabled"
    :ui="{ rounded: 'rounded-xl' }"
    :popper="{ strategy: 'fixed' }"
  />
  <div v-else-if="field.dataType === 'MULTISELECT'" class="flex flex-wrap gap-1.5">
    <button
      v-for="o in selectOptions"
      :key="o.value"
      type="button"
      class="pill-filter"
      :class="picked.includes(o.value) ? 'pill-filter--active' : ''"
      :disabled="disabled"
      @click="toggle(o.value)"
    >{{ o.label }}</button>
  </div>
  <UTextarea v-else-if="field.dataType === 'TEXTAREA'" v-model="value" :rows="3" autoresize :placeholder="field.placeholder || undefined" :disabled="disabled" :ui="{ rounded: 'rounded-xl' }" />
  <UInput
    v-else-if="field.dataType === 'NUMBER'"
    v-model="value"
    type="number"
    inputmode="decimal"
    :placeholder="field.placeholder || undefined"
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
  <UInput
    v-else-if="field.dataType === 'DATETIME'"
    v-model="value"
    type="datetime-local"
    :disabled="disabled"
    :ui="{ rounded: 'rounded-xl' }"
  />
  <UInput v-else v-model="value" :placeholder="field.placeholder || undefined" :disabled="disabled" :ui="{ rounded: 'rounded-xl' }" />
</template>
