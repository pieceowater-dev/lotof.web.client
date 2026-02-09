<script setup lang="ts">
import { defineProps, defineEmits, ref, watch, nextTick } from 'vue';

const props = defineProps<{
  modelValue: boolean,  // v-model binding state
  header?: string | object,
  content?: string | object,
  footerButtons?: { label: string, color?: string, variant?: 'link' | 'solid' | 'outline' | 'soft' | 'ghost', onClick?: () => void }[],
  disableAutofocus?: boolean
}>();

const emit = defineEmits(['update:modelValue']);

const initialFocusEl = ref<HTMLElement | null>(null);

watch(() => props.modelValue, async (open) => {
  if (!open || !props.disableAutofocus) return;
  await nextTick();
  try {
    (document.activeElement as HTMLElement | null)?.blur?.();
  } catch {}
  initialFocusEl.value?.focus();
});
</script>

<template>
  <UModal :model-value="props.modelValue" @update:model-value="emit('update:modelValue', $event)">
    <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
      <div ref="initialFocusEl" tabindex="-1" class="sr-only" />
      <template #header>
        <slot name="header">{{ props.header }}</slot>
      </template>

      <slot>{{ props.content }}</slot>

      <template #footer>
        <div class="flex justify-end gap-2">
          <slot name="footer">
            <UButton v-for="(btn, index) in props.footerButtons" :key="index" :label="btn.label"
              :color="(btn.color || (btn.variant === 'link' ? 'gray' : 'primary')) as any"
              :variant="btn.variant || 'solid'"
              @click="btn.onClick ? btn.onClick() : emit('update:modelValue', false)" />
          </slot>
        </div>
      </template>
    </UCard>
  </UModal>
</template>