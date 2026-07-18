<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';

const props = defineProps<{
  modelValue: boolean;
  message: string;
  plansPath: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const { t } = useI18n();

const isOpen = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});
</script>

<template>
  <UModal
    v-model="isOpen"
    :ui="{ width: 'sm:max-w-md' }"
  >
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-base font-semibold text-gray-900 dark:text-white">
            {{ t('app.notification') || 'Notification' }}
          </h3>
          <UButton
            color="primary"
            variant="ghost"
            icon="lucide:x"
            class="-my-1"
            @click="isOpen = false"
          />
        </div>
      </template>
      <div class="text-sm text-gray-700 dark:text-gray-200">
        {{ message || (t('atrace.members.limitReached') || 'Limit reached. Please upgrade your plan.') }}
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton
            color="primary"
            variant="soft"
            @click="isOpen = false"
          >
            {{ t('common.cancel') }}
          </UButton>
          <UButton
            color="amber"
            icon="lucide:star"
            :to="plansPath"
          >
            {{ t('app.upgradePlan') || 'Upgrade Plan' }}
          </UButton>
        </div>
      </template>
    </UCard>
  </UModal>
</template>
