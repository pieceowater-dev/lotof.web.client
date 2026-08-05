<script lang="ts" setup>
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

const isModalOpen = ref(false);
const editing = ref<AutomationRule | null>(null);
const saving = ref(false);

function openCreate() {
  editing.value = null;
  isModalOpen.value = true;
}
function openEdit(rule: AutomationRule) {
  editing.value = rule;
  isModalOpen.value = true;
}

function targetStatusOf(rule: AutomationRule): string {
  try {
    return JSON.parse(rule.actionConfig || '{}').target_status || '';
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
    isModalOpen.value = false;
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
  <USlideover v-model="isOpen">
    <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800', body: { base: 'flex-1 overflow-y-auto' } }" class="flex flex-col h-full">
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold">{{ t('tasks.automations') || 'Automations' }}</h3>
          <UButton icon="lucide:x" size="sm" color="gray" variant="ghost" @click="isOpen = false" />
        </div>
      </template>

      <div class="space-y-2">
        <p class="text-xs text-gray-400">
          {{ t('tasks.automationsHint') || 'Automatically update the linked Menu order when an issue reaches a final column.' }}
        </p>

        <UButton icon="lucide:plus" size="sm" color="primary" variant="soft" block @click="openCreate">
          {{ t('tasks.addAutomationRule') || 'Add automation' }}
        </UButton>

        <div v-if="loading" class="text-center py-6 text-sm text-gray-400">{{ t('app.loading') || 'Loading...' }}</div>
        <div v-else-if="!rules.length" class="text-center py-6 text-sm text-gray-400">{{ t('tasks.noAutomationRules') || 'No automations yet' }}</div>

        <div
          v-for="rule in rules"
          :key="rule.id"
          class="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-800 p-3"
          :class="!rule.isActive && 'opacity-50'"
        >
          <UIcon name="lucide:zap" class="w-4 h-4 flex-shrink-0 text-gray-400" />
          <div class="min-w-0 flex-1 text-sm">
            <div class="truncate">
              {{ triggerLabelOf(rule) }} → {{ t('tasks.automationOrderStatus') || 'order' }} {{ targetStatusOf(rule) }}
            </div>
            <div v-if="!rule.isActive" class="text-xs text-gray-400">{{ t('tasks.automationInactive') || 'Inactive' }}</div>
          </div>
          <UButton icon="lucide:pencil" size="2xs" color="gray" variant="ghost" @click="openEdit(rule)" />
          <UButton icon="lucide:trash-2" size="2xs" color="red" variant="ghost" @click="handleDelete(rule)" />
        </div>
      </div>
    </UCard>
  </USlideover>

  <AutomationRuleModal
    v-model="isModalOpen"
    :rule="editing"
    :saving="saving"
    :trigger-options="triggerOptions"
    @submit="handleSubmit"
  />
</template>
