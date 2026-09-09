<script lang="ts" setup>
// A small fixed palette of colour swatches — never a raw colour wheel.
// Tenants pick from curated on-brand hues so nothing eye-searing lands on
// a public page. Used for master / service dot colours across lota Plans.
import { PLANS_BRAND_COLORS } from '@/utils/color';

const props = withDefaults(defineProps<{
  modelValue?: string | null;
  palette?: string[];
  size?: 'sm' | 'md';
}>(), { modelValue: '', palette: () => PLANS_BRAND_COLORS, size: 'md' });

const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>();

const isActive = (c: string) => (props.modelValue || '').toLowerCase() === c.toLowerCase();
</script>

<template>
  <div class="flex flex-wrap gap-1.5">
    <button
      v-for="c in palette" :key="c" type="button"
      class="rounded-lg transition-transform hover:scale-110 border-2"
      :class="[
        size === 'sm' ? 'w-6 h-6' : 'w-7 h-7',
        isActive(c) ? 'border-gray-900 dark:border-white scale-110' : 'border-black/10 dark:border-white/15',
      ]"
      :style="{ background: c }"
      :aria-label="c"
      @click="emit('update:modelValue', c)"
    />
  </div>
</template>
