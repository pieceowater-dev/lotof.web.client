<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();

const props = defineProps<{
  modelValue: boolean;
  cycleName?: string;
  initialCarryOver: 'backlog' | 'next';
  saving?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'submit', carryOver: 'backlog' | 'next'): void;
}>();

const isOpen = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const carryOver = ref<'backlog' | 'next'>(props.initialCarryOver);
watch(() => props.modelValue, (open) => {
  if (open) carryOver.value = props.initialCarryOver;
});

function handleClose() {
  isOpen.value = false;
}
function handleSubmit() {
  emit('submit', carryOver.value);
}
</script>

<template>
  <UModal v-model="isOpen" @close="handleClose">
    <UCard :ui="{ ring: '' }">
      <template #header>
        <h3 class="text-lg font-semibold flex items-center gap-2">
          <UIcon name="lucide:flag" class="w-5 h-5 text-gray-400" />
          {{ t('tasks.closeSprintTitle') || 'Close sprint' }}
        </h3>
        <p v-if="cycleName" class="text-sm text-gray-500 mt-0.5">{{ cycleName }}</p>
      </template>

      <div class="space-y-3">
        <p class="text-sm text-gray-600 dark:text-gray-300">
          {{ t('tasks.closeSprintHint') || 'Any still-open issues in this sprint will be moved.' }}
        </p>
        <UFormGroup :label="t('tasks.cycleCarryOver') || 'Move unfinished issues to'">
          <USelectMenu
            v-model="carryOver"
            :options="[
              { label: t('tasks.cycleCarryOverBacklog') || 'Backlog', value: 'backlog' },
              { label: t('tasks.cycleCarryOverNext') || 'Next sprint', value: 'next' },
            ]"
            value-attribute="value"
            option-attribute="label"
            :popper="{ strategy: 'fixed' }"
          />
        </UFormGroup>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="gray" variant="ghost" :label="t('app.cancel')" @click="handleClose" />
          <UButton
            color="primary"
            icon="lucide:flag"
            :label="saving ? (t('app.loading') || 'Loading...') : (t('tasks.closeSprint') || 'Close sprint')"
            :loading="saving"
            @click="handleSubmit"
          />
        </div>
      </template>
    </UCard>
  </UModal>
</template>
