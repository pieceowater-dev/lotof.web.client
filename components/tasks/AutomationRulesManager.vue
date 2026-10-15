<script lang="ts" setup>
import { atModalUi, atCardUiFit } from '@/utils/atraceUi';
import { useI18n } from '@/composables/useI18n';
import { useTasksToken } from '@/composables/useTasksToken';
import { useConfirm } from '@/composables/useConfirm';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import AutomationRuleModal from '@/components/tasks/AutomationRuleModal.vue';
import type { AutomationRule } from '@/api/tasks/automation/list';

const { t } = useI18n();
const { confirm } = useConfirm();

const props = defineProps<{
  modelValue: boolean;
  boardId: string;
  nsSlug: string;
  // [{value, label}] built from the board's terminal statuses' maps_to
  // values (plan §9.8) — never the raw status key.
  triggerOptions: { value: string; label: string }[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
}>();

const isOpen = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const rules = ref<AutomationRule[]>([]);
const loading = ref(false);

async function getToken(): Promise<string> {
  const { current } = useTasksToken();
  const token = current();
  if (!token) throw new Error('No tasks token');
  return token;
}

async function load() {
  loading.value = true;
  try {
    const token = await getToken();
    const { tasksAutomationRulesList } = await import('@/api/tasks/automation/list');
    const res = await tasksAutomationRulesList(token, props.nsSlug, props.boardId);
    rules.value = res.rules;
  } catch (e) {
    logError('[AutomationRulesManager] load failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to load automations', color: 'red' });
  } finally {
    loading.value = false;
  }
}

watch(() => [props.modelValue, props.boardId], () => {
  if (props.modelValue && props.boardId) load();
});

// One overlay, two views: the list, and the form for a new / edited rule. (They
// used to be two stacked overlays, and a click inside the form counted as an
// "outside" click for the one beneath it, which closed it.)
const view = ref<'list' | 'form'>('list');
const editing = ref<AutomationRule | null>(null);
const saving = ref(false);
watch(isOpen, (v) => { if (v) view.value = 'list'; });

function openCreate() {
  editing.value = null;
  view.value = 'form';
}
function openEdit(rule: AutomationRule) {
  editing.value = rule;
  view.value = 'form';
}

const ORDER_STATUS_LABEL: Record<string, string> = {
  ACCEPTED: 'menu.statusAccepted', IN_PREPARATION: 'menu.statusInPreparation', READY: 'menu.statusReady',
  DELIVERING: 'menu.statusDelivering', COMPLETED: 'menu.statusCompleted', CANCELLED: 'menu.statusCancelled',
};
function targetStatusOf(rule: AutomationRule): string {
  try {
    const key = JSON.parse(rule.actionConfig || '{}').target_status || '';
    return ORDER_STATUS_LABEL[key] ? t(ORDER_STATUS_LABEL[key]) : key;
  } catch {
    return '';
  }
}

function triggerLabelOf(rule: AutomationRule): string {
  if (!rule.triggerStatus) return t('tasks.automationAnyTerminal') || 'Any final column';
  return props.triggerOptions.find((o) => o.value === rule.triggerStatus)?.label || rule.triggerStatus;
}

async function handleSubmit(payload: Record<string, any>) {
  saving.value = true;
  try {
    const token = await getToken();
    if (editing.value) {
      const { tasksUpdateAutomationRule } = await import('@/api/tasks/automation/update');
      const updated = await tasksUpdateAutomationRule(token, props.nsSlug, { id: editing.value.id, ...payload } as any);
      const idx = rules.value.findIndex((r) => r.id === updated.id);
      if (idx !== -1) rules.value[idx] = updated;
      useToast().add({ title: t('tasks.automationUpdated') || 'Automation updated', color: 'primary' });
    } else {
      const { tasksCreateAutomationRule } = await import('@/api/tasks/automation/create');
      const created = await tasksCreateAutomationRule(token, props.nsSlug, { boardId: props.boardId, ...payload } as any);
      rules.value = [...rules.value, created];
      useToast().add({ title: t('tasks.automationCreated') || 'Automation created', color: 'primary' });
    }
    view.value = 'list';
  } catch (e) {
    logError('[AutomationRulesManager] save failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to save automation', color: 'red' });
  } finally {
    saving.value = false;
  }
}

async function handleDelete(rule: AutomationRule) {
  if (!(await confirm({ message: t('tasks.confirmDeleteAutomation') || 'Delete this automation?' }))) return;
  try {
    const token = await getToken();
    const { tasksDeleteAutomationRule } = await import('@/api/tasks/automation/delete');
    await tasksDeleteAutomationRule(token, props.nsSlug, rule.id);
    rules.value = rules.value.filter((r) => r.id !== rule.id);
    useToast().add({ title: t('tasks.automationDeleted') || 'Automation deleted', color: 'primary' });
  } catch (e) {
    logError('[AutomationRulesManager] delete failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to delete automation', color: 'red' });
  }
}
</script>

<template>
  <UModal v-model="isOpen" class="at-modal" :ui="atModalUi">
    <UCard :ui="atCardUiFit">
      <template #header>
        <div class="flex items-center gap-2">
          <button v-if="view === 'form'" type="button" class="at-btn !p-2" :aria-label="t('common.back')" @click="view = 'list'"><UIcon name="lucide:arrow-left" class="h-4 w-4" /></button>
          <h3 class="flex-1 text-lg font-extrabold tracking-tight">
            {{ view === 'form' ? (editing ? (t('tasks.editAutomationRule') || 'Edit automation') : (t('tasks.addAutomationRule') || 'Add automation')) : (t('tasks.automations') || 'Automations') }}
          </h3>
          <button type="button" class="at-btn !p-2" :aria-label="t('common.close')" @click="isOpen = false"><UIcon name="lucide:x" class="h-4 w-4" /></button>
        </div>
      </template>

      <AutomationRuleModal
        v-if="view === 'form'"
        :rule="editing"
        :saving="saving"
        :trigger-options="triggerOptions"
        @cancel="view = 'list'"
        @submit="handleSubmit"
      />

      <div v-else class="space-y-3">
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ t('tasks.automationsHint') || 'Automatically update the linked Menu order when an issue reaches a final column.' }}
        </p>

        <div v-if="loading" class="py-6 text-center text-sm text-gray-400">{{ t('app.loading') || 'Loading...' }}</div>
        <div v-else-if="!rules.length" class="py-6 text-center text-sm text-gray-400">{{ t('tasks.noAutomationRules') || 'No automations yet' }}</div>

        <div
          v-for="rule in rules"
          :key="rule.id"
          class="at-row flex items-center gap-3"
          :class="!rule.isActive && 'opacity-50'"
        >
          <UIcon name="lucide:zap" class="h-4 w-4 flex-shrink-0 text-gray-400" />
          <div class="min-w-0 flex-1 text-sm">
            <div class="font-medium">{{ triggerLabelOf(rule) }}</div>
            <div class="text-xs text-gray-500">→ {{ t('tasks.automationOrderStatus') || 'order' }}: {{ targetStatusOf(rule) }}</div>
            <div v-if="!rule.isActive" class="text-xs text-gray-400">{{ t('tasks.automationInactive') || 'Inactive' }}</div>
          </div>
          <button type="button" class="cp-icon" :aria-label="t('common.edit')" @click="openEdit(rule)"><UIcon name="lucide:pencil" class="h-4 w-4" /></button>
          <button type="button" class="cp-icon" :aria-label="t('common.delete')" @click="handleDelete(rule)"><UIcon name="lucide:trash-2" class="h-4 w-4 text-red-500" /></button>
        </div>

        <button type="button" class="at-btn at-btn--primary w-full justify-center" @click="openCreate">
          <UIcon name="lucide:plus" class="h-4 w-4" />{{ t('tasks.addAutomationRule') || 'Add automation' }}
        </button>
      </div>
    </UCard>
  </UModal>
</template>
