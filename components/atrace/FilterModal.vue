<script setup lang="ts">
import { useI18n } from '@/composables/useI18n';
const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>();
const open = computed({ get: () => props.modelValue, set: (v: boolean) => emit('update:modelValue', v) });
const { t } = useI18n();
</script>

<template>
  <UModal v-model="open">
    <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">{{ t('app.atraceFilter') }}</h3>
          <UButton color="gray" variant="ghost" icon="lucide:x" class="-my-1" @click="open = false" />
        </div>
      </template>

      <Placeholder class="h-64" />

      <template #footer>
        <div class="flex justify-between gap-2">
          <UButton icon="lucide:check" size="sm" color="primary" variant="solid">{{ t('common.apply') }}</UButton>
          <UButton icon="lucide:x" size="sm" color="primary" variant="outline">{{ t('common.cancel') }}</UButton>
        </div>
      </template>
    </UCard>
  </UModal>
</template>
