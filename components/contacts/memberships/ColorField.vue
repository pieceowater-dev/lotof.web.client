<script lang="ts" setup>
// A fixed palette of colour swatches — never a raw colour wheel or free hex
// entry, so tenant-picked colours on the public membership page stay
// tasteful. Thin wrapper over the shared ui/ColorSwatch.
import ColorSwatch from '@/components/ui/ColorSwatch.vue';
import { BRAND_COLORS } from '@/utils/color';

withDefaults(defineProps<{ modelValue?: string | null; presets?: string[] }>(), {
  modelValue: '',
  presets: () => BRAND_COLORS,
});
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>();
</script>

<template>
  <ColorSwatch
    :model-value="modelValue"
    :palette="presets"
    @update:model-value="(v) => emit('update:modelValue', v)"
  />
</template>
