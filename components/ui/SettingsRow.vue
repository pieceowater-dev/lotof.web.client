<template>
  <label class="flex cursor-pointer items-center gap-4 py-3.5 first:pt-0 last:pb-0" :class="disabled ? 'cursor-not-allowed opacity-50' : ''">
    <span class="min-w-0 flex-1">
      <span class="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
        <UIcon v-if="icon" :name="icon" class="h-4 w-4 flex-shrink-0 text-gray-400" />
        <span>{{ title }}</span>
      </span>
      <span v-if="description" class="mt-0.5 block text-xs leading-5 text-gray-500 dark:text-gray-400">{{ description }}</span>
      <slot />
    </span>
    <UToggle :model-value="modelValue" :disabled="disabled" class="flex-shrink-0" @update:model-value="(v: boolean) => emit('update:modelValue', v)" />
  </label>
</template>

<script setup lang="ts">
// A single on/off setting: what it does on the left, the switch on the right (never the switch on
// the left of a paragraph). Stack several inside a `divide-y` wrapper.
defineProps<{
  title: string;
  description?: string;
  icon?: string;
  modelValue: boolean;
  disabled?: boolean;
}>();
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>();
</script>
