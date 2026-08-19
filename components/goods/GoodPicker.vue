<script lang="ts" setup>
// Wraps the "pick a good from the catalog" USelectMenu that used to be
// hand-rolled at 8+ call sites across the warehouse module.
import type { GoodsGood } from '@/api/goods/good';

const props = withDefaults(
  defineProps<{
    modelValue: string;
    goods: GoodsGood[];
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    placeholder?: string;
  }>(),
  { size: 'sm', placeholder: undefined },
);

const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>();

const options = computed(() => props.goods.map((g) => ({ label: g.name, value: g.id })));
</script>

<template>
  <USelectMenu
    :model-value="modelValue"
    :options="options"
    value-attribute="value"
    option-attribute="label"
    :size="size"
    :placeholder="placeholder"
    searchable
    :popper="{ strategy: 'fixed' }"
    @update:model-value="(v: string) => emit('update:modelValue', v)"
  />
</template>
