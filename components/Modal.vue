<script setup lang="ts">
import { defineProps, defineEmits } from 'vue';

const props = defineProps<{
  modelValue: boolean,  // Используем v-model
  header?: string | object,
  content?: string | object,
  footerButtons?: { label: string, variant?: 'link' | 'solid' | 'outline' | 'soft' | 'ghost', onClick?: () => void }[]
}>();

const emit = defineEmits(['update:modelValue']);
</script>

<template>
  <UModal :model-value="props.modelValue" @update:model-value="emit('update:modelValue', $event)">
    <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
      <template #header>
        <slot name="header">{{ props.header }}</slot>
      </template>

      <slot>{{ props.content }}</slot>

      <template #footer>
        <div class="flex justify-end gap-2">
          <slot name="footer">
            <UButton v-for="(btn, index) in props.footerButtons" :key="index" :label="btn.label"
              :variant="btn.variant || 'solid'"
              @click="btn.onClick ? btn.onClick() : emit('update:modelValue', false)" />
          </slot>
        </div>
      </template>
    </UCard>
  </UModal>
</template>