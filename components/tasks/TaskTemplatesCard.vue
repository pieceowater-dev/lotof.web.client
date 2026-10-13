<script lang="ts" setup>
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import { parseTaskTemplates, type TaskTemplate } from '@/utils/taskTemplates';
import type { TaskBoard } from '@/api/tasks/board/list';
import type { TaskType } from '@/api/tasks/tasktype/list';

// Templates of the board: "Quote the price", "Call back" … one click creates a
// ready task. Up to 20 per board.
const props = defineProps<{ board: TaskBoard; taskTypes: TaskType[]; nsSlug: string; getToken: () => Promise<string> }>();
const emit = defineEmits<{ (e: 'saved', board: TaskBoard): void }>();
const { t } = useI18n();
const toast = useToast();

const rows = ref<TaskTemplate[]>([]);
const saving = ref(false);
watch(() => props.board.taskTemplates, (raw) => { rows.value = parseTaskTemplates(raw); }, { immediate: true });

const PRIORITIES = [0, 1, 2, 3];
function add() {
  if (rows.value.length >= 20) return;
  rows.value.push({ id: '', name: '', title: '', description: '', priority: 1, due_in_hours: 0, task_type_id: '' });
}
const remove = (i: number) => rows.value.splice(i, 1);
const canSave = computed(() => !saving.value && rows.value.every((r) => r.name.trim()));

async function save() {
  saving.value = true;
  try {
    const { tasksUpdateBoard } = await import('@/api/tasks/board/update');
    const updated = await tasksUpdateBoard(await props.getToken(), props.nsSlug, { id: props.board.id, taskTemplates: JSON.stringify(rows.value) });
    emit('saved', updated);
    toast.add({ title: t('tasks.templatesSaved'), color: 'primary' });
  } catch (e) {
    logError('[tasks/templates] save failed', e);
    toast.add({ title: getErrorMessage(e, t) || t('common.error'), color: 'red' });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between gap-2">
      <div>
        <h4 class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400"><UIcon name="lucide:file-plus-2" class="h-3.5 w-3.5" />{{ t('tasks.templates') }}</h4>
        <p class="mt-1 text-xs text-gray-400">{{ t('tasks.templatesHint') }}</p>
      </div>
      <button type="button" class="at-btn !px-3 !py-1.5" :disabled="rows.length >= 20" @click="add"><Icon name="lucide:plus" class="h-4 w-4" />{{ t('tasks.templateAdd') }}</button>
    </div>

    <div v-for="(r, i) in rows" :key="i" class="space-y-2 rounded-xl border border-gray-200 p-3 dark:border-gray-800">
      <div class="flex gap-2">
        <UInput v-model="r.name" maxlength="80" class="flex-1" size="sm" :placeholder="t('tasks.templateName')" :ui="{ rounded: 'rounded-xl' }" />
        <button type="button" class="at-btn !px-2.5 !py-1.5" :aria-label="t('common.delete')" @click="remove(i)"><Icon name="lucide:trash-2" class="h-4 w-4" /></button>
      </div>
      <UInput v-model="r.title" maxlength="160" size="sm" :placeholder="t('tasks.templateTitle')" :ui="{ rounded: 'rounded-xl' }" />
      <UTextarea v-model="r.description" :rows="2" autoresize maxlength="2000" :placeholder="t('tasks.templateDescription')" />
      <div class="flex flex-wrap items-center gap-3 text-xs text-gray-500">
        <span class="flex items-center gap-1.5">{{ t('tasks.templatePriority') }}
          <button v-for="p in PRIORITIES" :key="p" type="button" class="pill-filter !px-2.5 !py-0.5" :class="r.priority === p ? 'pill-filter--active' : ''" @click="r.priority = p">{{ p }}</button>
        </span>
        <span class="flex items-center gap-1.5">{{ t('tasks.templateDueIn') }}
          <UInput v-model.number="r.due_in_hours" type="number" min="0" max="8760" size="xs" class="w-20" />
          {{ t('tasks.hoursShort') }}
        </span>
      </div>
      <div v-if="taskTypes.length > 1" class="flex flex-wrap items-center gap-1.5">
        <span class="text-xs text-gray-500">{{ t('tasks.templateType') }}</span>
        <button type="button" class="pill-filter !py-0.5" :class="!r.task_type_id ? 'pill-filter--active' : ''" @click="r.task_type_id = ''">{{ t('tasks.templateTypeDefault') }}</button>
        <button v-for="tt in taskTypes" :key="tt.id" type="button" class="pill-filter !py-0.5" :class="r.task_type_id === tt.id ? 'pill-filter--active' : ''" @click="r.task_type_id = tt.id">{{ tt.name }}</button>
      </div>
    </div>
    <div v-if="rows.length" class="flex justify-end">
      <button type="button" class="at-btn at-btn--primary" :disabled="!canSave" @click="save">{{ t('common.save') }}</button>
    </div>
  </div>
</template>
