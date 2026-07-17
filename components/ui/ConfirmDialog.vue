<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useConfirm } from '@/composables/useConfirm';

const { t } = useI18n();
const { state, handleConfirm, handleCancel } = useConfirm();

const colorStyles: Record<string, { iconBg: string; iconColor: string }> = {
  red: { iconBg: 'bg-red-100 dark:bg-red-900/40', iconColor: 'text-red-600 dark:text-red-300' },
  primary: { iconBg: 'bg-primary-100 dark:bg-primary-900/40', iconColor: 'text-primary-600 dark:text-primary-300' },
  amber: { iconBg: 'bg-amber-100 dark:bg-amber-900/40', iconColor: 'text-amber-600 dark:text-amber-300' },
};
</script>

<template>
  <UModal
    :model-value="state.open"
    :ui="{ width: 'sm:max-w-sm' }"
    @update:model-value="(v: boolean) => { if (!v) handleCancel(); }"
  >
    <UCard :ui="{ ring: '', divide: '' }">
      <div class="flex items-start gap-3">
        <span
          class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
          :class="colorStyles[state.color]?.iconBg || colorStyles.red.iconBg"
        >
          <Icon :name="state.icon" class="h-5 w-5" :class="colorStyles[state.color]?.iconColor || colorStyles.red.iconColor" />
        </span>
        <div class="min-w-0 pt-0.5">
          <h3 v-if="state.title" class="text-base font-semibold mb-1">{{ state.title }}</h3>
          <p class="text-sm text-gray-600 dark:text-gray-300">{{ state.message }}</p>
        </div>
      </div>
      <div class="flex justify-end gap-2 mt-5">
        <UButton color="gray" variant="ghost" @click="handleCancel">
          {{ state.cancelLabel || t('app.cancel') || 'Cancel' }}
        </UButton>
        <UButton :color="state.color" @click="handleConfirm">
          {{ state.confirmLabel || t('app.confirm') || 'Confirm' }}
        </UButton>
      </div>
    </UCard>
  </UModal>
</template>
