<script lang="ts" setup>
// Swatch presets + native picker + hex input, matching the "Colors" section
// feel of components/menu/settings/BrandSection.vue but with quick presets.
withDefaults(defineProps<{ modelValue?: string | null; presets?: string[] }>(), {
  modelValue: '',
  presets: () => [
    '#4f46e5', '#2563eb', '#0891b2', '#059669', '#16a34a',
    '#ca8a04', '#ea580c', '#dc2626', '#db2777', '#7c3aed',
    '#0f172a', '#475569',
  ],
});
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>();

function set(v: string) {
  emit('update:modelValue', v);
}
</script>

<template>
  <div class="space-y-2">
    <div class="flex flex-wrap gap-1.5">
      <button
        v-for="c in presets"
        :key="c"
        type="button"
        class="w-7 h-7 rounded-lg border transition-transform hover:scale-110"
        :class="modelValue?.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-offset-1 ring-gray-900 dark:ring-white border-transparent' : 'border-black/10 dark:border-white/10'"
        :style="{ background: c }"
        :aria-label="c"
        @click="set(c)"
      />
    </div>
    <div class="flex items-center gap-2">
      <input
        :value="modelValue || '#4f46e5'"
        type="color"
        class="h-9 w-10 rounded-lg border border-gray-200 dark:border-gray-800 cursor-pointer bg-transparent flex-shrink-0"
        @input="set(($event.target as HTMLInputElement).value)"
      >
      <UInput
        :model-value="modelValue || ''"
        placeholder="#4f46e5"
        size="lg"
        class="flex-1"
        @update:model-value="set($event)"
      />
    </div>
  </div>
</template>
