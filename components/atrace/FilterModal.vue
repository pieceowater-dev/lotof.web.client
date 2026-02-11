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
          <UButton color="primary" variant="ghost" icon="lucide:x" class="-my-1" @click="open = false" />
        </div>
      </template>

      <div class="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
        <p>{{ t('app.atraceFilter') }}</p>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton icon="lucide:x" color="primary" variant="soft">{{ t('common.cancel') }}</UButton>
          <UButton icon="lucide:check" color="primary">{{ t('common.apply') }}</UButton>
        </div>
      </template>
    </UCard>
  </UModal>
</template>
