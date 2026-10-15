<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import type { AutomationRule } from '@/api/tasks/automation/list';

const { t } = useI18n();

interface TriggerOption { value: string; label: string }

const props = defineProps<{
  rule?: AutomationRule | null;
  saving?: boolean;
  triggerOptions: TriggerOption[];
}>();

const emit = defineEmits<{
  (e: 'cancel'): void;
  (e: 'submit', payload: Record<string, any>): void;
}>();

// Order statuses a rule can set, shown with the same names the orders screens use.
const ORDER_STATUS_OPTIONS = computed(() => [
  { value: 'ACCEPTED', label: t('menu.statusAccepted') },
  { value: 'IN_PREPARATION', label: t('menu.statusInPreparation') },
  { value: 'READY', label: t('menu.statusReady') },
  { value: 'DELIVERING', label: t('menu.statusDelivering') },
  { value: 'COMPLETED', label: t('menu.statusCompleted') },
  { value: 'CANCELLED', label: t('menu.statusCancelled') },
]);

// USelectMenu doesn't reliably show a selected option's label when the bound
// value is an empty string, so "any final column" uses a non-empty sentinel
// internally and is translated back to "" only when building the payload.
const ANY_TERMINAL = '__any__';

const form = reactive({
  triggerStatus: ANY_TERMINAL as string,
  targetStatus: 'COMPLETED',
  isActive: true,
});

watch(() => props.rule, () => {
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
  <form class="space-y-5" @submit.prevent="handleSubmit">
    <UFormGroup :label="t('tasks.automationTrigger') || 'When an issue reaches'">
      <USelectMenu
        v-model="form.triggerStatus"
        :options="[{ label: t('tasks.automationAnyTerminal') || 'Any final column', value: ANY_TERMINAL }, ...triggerOptions]"
        value-attribute="value"
        option-attribute="label"
        :popper="{ strategy: 'fixed' }"
      />
    </UFormGroup>

    <UFormGroup :label="t('tasks.automationUpdateMenuOrder') || 'Set the linked order status to'" :hint="t('tasks.automationActionHint') || 'Only this action is supported today'">
      <USelectMenu
        v-model="form.targetStatus"
        :options="ORDER_STATUS_OPTIONS"
        value-attribute="value"
        option-attribute="label"
        :popper="{ strategy: 'fixed' }"
      />
    </UFormGroup>

    <label class="flex cursor-pointer items-center gap-3">
      <UToggle v-model="form.isActive" />
      <span class="text-sm font-medium">{{ t('tasks.isActive') || 'Active' }}</span>
    </label>

    <div class="flex justify-end gap-2 pt-1">
      <button type="button" class="at-btn" @click="emit('cancel')">{{ t('app.cancel') }}</button>
      <button type="submit" class="at-btn at-btn--primary" :disabled="saving">
        <Icon v-if="saving" name="lucide:loader-2" class="h-4 w-4 animate-spin" />{{ t('app.save') || 'Save' }}
      </button>
    </div>
  </form>
</template>
