<script lang="ts" setup>
import { atModalUi, atCardUi } from '@/utils/atraceUi';
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
    class="at-modal"
    :model-value="state.open"
    :ui="{ ...atModalUi, width: 'sm:max-w-sm' }"
    @update:model-value="(v: boolean) => { if (!v) handleCancel(); }"
  >
    <UCard :ui="{ ...atCardUi, divide: '', body: { padding: 'p-7' } }">
      <div class="flex items-start gap-4">
        <span
          class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full"
          :class="colorStyles[state.color]?.iconBg || colorStyles.red.iconBg"
        >
          <Icon :name="state.icon" class="h-5 w-5" :class="colorStyles[state.color]?.iconColor || colorStyles.red.iconColor" />
        </span>
        <div class="min-w-0 pt-1">
          <h3 v-if="state.title" class="text-lg font-extrabold tracking-tight text-gray-900 dark:text-white mb-1">{{ state.title }}</h3>
          <p class="text-sm leading-relaxed text-gray-600 dark:text-gray-300">{{ state.message }}</p>
        </div>
      </div>
      <div class="flex justify-end gap-2 mt-7">
        <button type="button" class="at-btn" @click="handleCancel">
          {{ state.cancelLabel || t('app.cancel') || 'Cancel' }}
        </button>
        <button
          type="button"
          class="at-btn"
          :class="state.color === 'red' ? 'at-btn--danger' : 'at-btn--primary'"
          @click="handleConfirm"
        >
          {{ state.confirmLabel || t('app.confirm') || 'Confirm' }}
        </button>
      </div>
    </UCard>
  </UModal>
</template>
