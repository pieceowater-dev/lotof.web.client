<script lang="ts" setup>
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import { subtaskProgress } from '@/utils/subtasks';
import type { TaskItem } from '@/api/tasks/task/list';

// Subtasks of a task: a short checklist with progress. Closing every subtask
// does not close the parent, and closing the parent does not touch them.
const props = defineProps<{
  parent: TaskItem;
  nsSlug: string;
  getToken: () => Promise<string>;
  doneStatus: string | null; // a terminal status to move a finished subtask to
  openStatus: string | null; // the status a reopened subtask goes back to
  terminalKeys: string[];
}>();
const { t } = useI18n();
const toast = useToast();

const subtasks = ref<TaskItem[]>([]);
const loading = ref(false);
const title = ref('');
const adding = ref(false);

const progress = computed(() => subtaskProgress(subtasks.value, props.terminalKeys));
const isDone = (tk: TaskItem) => props.terminalKeys.includes(tk.status);

async function load() {
  if (!props.parent?.id) return;
  loading.value = true;
  try {
    const { tasksBundle } = await import('@/api/tasks/task/list');
    subtasks.value = (await tasksBundle(await props.getToken(), props.nsSlug, { parentId: props.parent.id }, { length: 'ONE_HUNDRED' })).tasks
      .slice().sort((a, b) => a.sortOrder - b.sortOrder);
  } catch (e) {
    logError('[tasks/subtasks] load failed', e);
  } finally {
    loading.value = false;
  }
}
watch(() => props.parent?.id, load, { immediate: true });

async function add() {
  const text = title.value.trim();
  if (!text || adding.value) return;
  adding.value = true;
  try {
    const { tasksCreateTask } = await import('@/api/tasks/task/create');
    const created = await tasksCreateTask(await props.getToken(), props.nsSlug, {
      boardId: props.parent.boardId, taskTypeId: props.parent.taskTypeId, title: text, parentId: props.parent.id,
      assigneeUserId: props.parent.assigneeUserId || undefined,
    });
    subtasks.value.push(created);
    title.value = '';
  } catch (e) {
    toast.add({ title: getErrorMessage(e, t) || t('common.error'), color: 'red' });
  } finally {
    adding.value = false;
  }
}

async function toggle(tk: TaskItem) {
  const target = isDone(tk) ? props.openStatus : props.doneStatus;
  if (!target) return;
  try {
    const { tasksUpdateTaskStatus } = await import('@/api/tasks/task/update');
    const updated = await tasksUpdateTaskStatus(await props.getToken(), props.nsSlug, {
      taskId: tk.id, status: target, isTerminal: props.terminalKeys.includes(target),
    });
    const i = subtasks.value.findIndex((x) => x.id === tk.id);
    if (i >= 0) subtasks.value[i] = updated;
  } catch (e) {
    toast.add({ title: getErrorMessage(e, t) || t('common.error'), color: 'red' });
  }
}
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-center justify-between gap-2">
      <h4 class="text-xs font-semibold uppercase tracking-wide text-gray-500">{{ t('tasks.subtasks') }}</h4>
      <span v-if="progress.total" class="text-xs tabular-nums text-gray-500">{{ t('tasks.subtasksProgress', { done: progress.done, total: progress.total }) }}</span>
    </div>
    <div v-if="progress.total" class="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
      <div class="h-full rounded-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all" :style="{ width: `${progress.percent}%` }" />
    </div>
    <ul v-if="subtasks.length" class="divide-y divide-gray-100 rounded-xl border border-gray-200 text-sm dark:divide-gray-800 dark:border-gray-800">
      <li v-for="tk in subtasks" :key="tk.id" class="flex items-center gap-2.5 px-3 py-2">
        <button type="button" class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border" :class="isDone(tk) ? 'border-transparent bg-gradient-to-br from-blue-600 to-emerald-500 text-white' : 'border-gray-300 dark:border-gray-600'" :aria-label="isDone(tk) ? t('tasks.subtaskReopen') : t('tasks.subtaskDone')" @click="toggle(tk)">
          <Icon v-if="isDone(tk)" name="lucide:check" class="h-3.5 w-3.5" />
        </button>
        <span class="min-w-0 flex-1 truncate" :class="isDone(tk) ? 'text-gray-400 line-through' : ''">{{ tk.title }}</span>
      </li>
    </ul>
    <div class="flex gap-2">
      <UInput v-model="title" class="flex-1" size="sm" maxlength="160" :placeholder="t('tasks.subtaskPlaceholder')" :ui="{ rounded: 'rounded-xl' }" @keyup.enter="add" />
      <button type="button" class="at-btn !px-3 !py-1.5" :disabled="!title.trim() || adding" @click="add"><Icon name="lucide:plus" class="h-4 w-4" />{{ t('tasks.subtaskAdd') }}</button>
    </div>
  </div>
</template>
