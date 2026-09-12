<template>
  <Modal
    :model-value="isOpen"
    :header="t('app.downgradeBlockedTitle') || 'Нельзя понизить тариф'"
    @update:model-value="close"
  >
    <template #header>
      <div class="flex items-center gap-2">
        <Icon name="lucide:shield-alert" class="h-5 w-5 text-amber-500" />
        <span>{{ t('app.downgradeBlockedTitle') || 'Нельзя понизить тариф' }}</span>
      </div>
    </template>

    <div class="space-y-4">
      <p class="text-gray-700 dark:text-gray-300">
        {{ t('app.downgradeBlockedBody') || 'На новом тарифе лимиты ниже, чем вы уже используете. Уменьшите использование или выберите тариф с лимитами не ниже текущих:' }}
      </p>

      <ul class="space-y-2">
        <li
          v-for="row in regressions"
          :key="row.key"
          class="flex items-center justify-between gap-3 rounded-lg bg-amber-50 px-3 py-2 dark:bg-amber-950/30"
        >
          <span class="text-sm font-medium text-gray-800 dark:text-gray-200">
            {{ t(featureLabelKey(row.key)) || row.key }}
          </span>
          <span class="flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold">
            <span class="text-gray-500 dark:text-gray-400">{{ row.from }}</span>
            <Icon name="lucide:arrow-right" class="h-3.5 w-3.5 text-amber-500" />
            <span class="text-amber-600 dark:text-amber-400">{{ row.to }}</span>
          </span>
        </li>
      </ul>
    </div>

    <template #footer>
      <UButton :label="t('app.downgradeBlockedOk') || 'Понятно'" color="primary" @click="close" />
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { useI18n } from '@/composables/useI18n';
import { useDowngradeBlockedModal, featureLabelKey } from '@/composables/useDowngradeBlockedModal';

const { t } = useI18n();
const { isOpen, regressions, close } = useDowngradeBlockedModal();
</script>
