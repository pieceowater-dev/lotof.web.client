<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import type { AutomationRule } from '@/api/tasks/automation/list';

const { t } = useI18n();

interface TriggerOption { value: string; label: string }

const props = defineProps<{
  modelValue: boolean;
  rule?: AutomationRule | null;
  saving?: boolean;
  triggerOptions: TriggerOption[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'submit', payload: Record<string, any>): void;
}>();

const isOpen = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const ORDER_STATUS_OPTIONS = ['ACCEPTED', 'IN_PREPARATION', 'READY', 'DELIVERING', 'COMPLETED', 'CANCELLED'];

// USelectMenu doesn't reliably show a selected option's label when the bound
// value is an empty string, so "any final column" uses a non-empty sentinel
// internally and is translated back to "" only when building the payload.
const ANY_TERMINAL = '__any__';

const form = reactive({
  triggerStatus: ANY_TERMINAL as string,
  targetStatus: 'COMPLETED',
  isActive: true,
});

watch(() => [props.modelValue, props.rule], () => {
  if (!props.modelValue) return;
  const r = props.rule;
  form.triggerStatus = r?.triggerStatus || ANY_TERMINAL;
  form.isActive = r ? r.isActive : true;
  try {
    const cfg = r?.actionConfig ? JSON.parse(r.actionConfig) : {};
    form.targetStatus = cfg.target_status || 'COMPLETED';
  } catch {
    form.targetStatus = 'COMPLETED';
  }
}, { immediate: true });

function handleClose() {
  isOpen.value = false;
}

function handleSubmit() {
  emit('submit', {
    triggerType: 'TASK_STATUS_CHANGED',
    triggerStatus: form.triggerStatus === ANY_TERMINAL ? '' : form.triggerStatus,
    actionType: 'UPDATE_ORDER_STATUS',
    actionConfig: JSON.stringify({ target_status: form.targetStatus }),
    isActive: form.isActive,
  });
}
</script>

<template>
  <UModal v-model="isOpen" @close="handleClose">
    <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
      <template #header>
        <h3 class="text-lg font-semibold">
          {{ rule ? (t('tasks.editAutomationRule') || 'Edit automation') : (t('tasks.addAutomationRule') || 'Add automation') }}
        </h3>
      </template>

      <div class="space-y-4">
        <UFormGroup :label="t('tasks.automationTrigger') || 'When an issue reaches'">
          <USelectMenu
            v-model="form.triggerStatus"
            :options="[{ label: t('tasks.automationAnyTerminal') || 'Any final column', value: ANY_TERMINAL }, ...triggerOptions]"
            value-attribute="value"
            option-attribute="label"
            :popper="{ strategy: 'fixed' }"
          />
        </UFormGroup>

        <UFormGroup :label="t('tasks.automationAction') || 'Then'" :hint="t('tasks.automationActionHint') || 'Only this action is supported today'">
          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-500">{{ t('tasks.automationUpdateMenuOrder') || 'Update the linked Menu order status to' }}</span>
            <USelectMenu
              v-model="form.targetStatus"
              :options="ORDER_STATUS_OPTIONS"
              class="w-40"
              :popper="{ strategy: 'fixed' }"
            />
          </div>
        </UFormGroup>

        <div class="flex items-center gap-2">
          <UToggle v-model="form.isActive" />
          <span class="text-sm">{{ t('tasks.isActive') || 'Active' }}</span>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="gray" variant="ghost" :label="t('app.cancel')" @click="handleClose" />
          <UButton
            color="primary"
            :label="saving ? (t('app.loading') || 'Loading...') : (t('app.save') || 'Save')"
            :loading="saving"
            :disabled="saving"
            @click="handleSubmit"
          />
        </div>
      </template>
    </UCard>
  </UModal>
</template>
