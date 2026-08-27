<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useTasksToken } from '@/composables/useTasksToken';
import { useConfirm } from '@/composables/useConfirm';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import { getApiBaseUrl } from '@/utils/api-base';
import { sanitizePhoneInput, isPhoneInputValid } from '@/utils/phone';
import { renderMarkdownSafe } from '@/utils/renderMarkdown';
import { maskProfanity } from '@/utils/profanityFilter';
import { taskShortCode, priorityIcon, priorityColorClass, columnColorClass, blockingRequiredStatuses } from '@/utils/taskDisplay';
import BranchLocationPicker from '@/components/menu/BranchLocationPicker.vue';
import type { TaskItem } from '@/api/tasks/task/list';
import type { TaskType } from '@/api/tasks/tasktype/list';
import type { TaskMember } from '@/api/tasks/task/members';
import type { TaskActivity } from '@/api/tasks/activity/list';
import type { Cycle } from '@/api/tasks/cycle/list';

interface StatusRow { key: string; label: string; isTerminal: boolean; isRequired?: boolean; color?: string | null }

const { t } = useI18n();
const { confirm } = useConfirm();

const props = defineProps<{
  modelValue: boolean;
  task: TaskItem | null;
  boardStatuses: StatusRow[];
  taskTypes: TaskType[];
  memberOptions: { label: string; value: string }[];
  nsSlug: string;
  boardSlug?: string;
  hasPendingUpdate?: boolean;
  cyclesEnabled?: boolean;
  cycles?: Cycle[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'changed', task: TaskItem): void;
  (e: 'deleted', id: string): void;
  (e: 'apply-pending-update'): void;
}>();

const isOpen = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

async function getToken(): Promise<string> {
  const { current } = useTasksToken();
  const token = current();
  if (!token) throw new Error('No tasks token');
  return token;
}

const shortCode = computed(() => taskShortCode(props.boardSlug, props.task?.taskNumber));
const statusInfo = (key?: string | null) => props.boardStatuses.find((s) => s.key === key);
const memberLabel = (userId?: string | null) => props.memberOptions.find((m) => m.value === userId)?.label || userId || '';
const currentTaskType = computed(() => props.taskTypes.find((tt) => tt.id === props.task?.taskTypeId));

// A thin colored strip along the top of the card gives an at-a-glance read
// on urgency before anyone reads a word of the title (same idea as Linear's
// colored issue-list accents).
const PRIORITY_ACCENTS: Record<number, string> = {
  0: 'bg-gray-300 dark:bg-gray-700',
  1: 'bg-blue-400 dark:bg-blue-600',
  2: 'bg-amber-400 dark:bg-amber-600',
  3: 'bg-red-500 dark:bg-red-600',
};
const priorityAccentClass = computed(() => PRIORITY_ACCENTS[props.task?.priority ?? 0] || PRIORITY_ACCENTS[0]);

// Every field below auto-saves on change/blur -- there is no separate "edit
// mode": viewing and editing are the same screen (previously a pencil icon
// opened a whole different modal for this, which is exactly what felt
// disjointed to use).
const saving = ref(false);
async function saveField(patch: Record<string, any>) {
  if (!props.task) return;
  saving.value = true;
  try {
    const token = await getToken();
    const { tasksUpdateTask } = await import('@/api/tasks/task/update');
    const updated = await tasksUpdateTask(token, props.nsSlug, {
      id: props.task.id,
      taskTypeId: props.task.taskTypeId,
      title: props.task.title,
      description: props.task.description || undefined,
      priority: props.task.priority,
      clientNameSnapshot: props.task.clientNameSnapshot || undefined,
      clientPhoneSnapshot: props.task.clientPhoneSnapshot || undefined,
      dueAt: props.task.dueAt || undefined,
      estimateValue: props.task.estimateValue ?? undefined,
      ...patch,
    });
    emit('changed', updated);
  } catch (e) {
    logError('[TaskDetailSlideover] save failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to save', color: 'red' });
  } finally {
    saving.value = false;
  }
}

// --- Title (click to edit) ---
const editingTitle = ref(false);
const titleDraft = ref('');
function startTitleEdit() {
  titleDraft.value = props.task?.title || '';
  editingTitle.value = true;
}
function commitTitle() {
  editingTitle.value = false;
  const value = titleDraft.value.trim();
  if (!value || value === props.task?.title) return;
  saveField({ title: value });
}

// --- Description (click to edit, markdown preview otherwise) ---
const editingDescription = ref(false);
const descriptionDraft = ref('');
const renderedDescription = computed(() => renderMarkdownSafe(maskProfanity(props.task?.description || '')));
function startDescriptionEdit() {
  descriptionDraft.value = props.task?.description || '';
  editingDescription.value = true;
}
function commitDescription() {
  editingDescription.value = false;
  if (descriptionDraft.value === (props.task?.description || '')) return;
  saveField({ description: descriptionDraft.value.trim() || undefined });
}

// --- Priority ---
const priorityOptions = computed(() => [
  { label: t('tasks.priorityLow') || 'Low', value: 0 },
  { label: t('tasks.priorityMedium') || 'Medium', value: 1 },
  { label: t('tasks.priorityHigh') || 'High', value: 2 },
  { label: t('tasks.priorityUrgent') || 'Urgent', value: 3 },
]);
function handlePriorityChange(p: number) {
  if (p === props.task?.priority) return;
  saveField({ priority: p });
}

// --- Issue type ---
function handleTaskTypeChange(id: string) {
  if (id === props.task?.taskTypeId) return;
  saveField({ taskTypeId: id });
}

// --- Due date ---
const dueAtDraft = ref('');
watch(() => props.task?.dueAt, (v) => { dueAtDraft.value = v ? v.slice(0, 16) : ''; }, { immediate: true });
function commitDueAt() {
  const iso = dueAtDraft.value ? new Date(dueAtDraft.value).toISOString() : undefined;
  if (iso === props.task?.dueAt) return;
  saveField({ dueAt: iso });
}

// --- Estimate (story points / hours -- only shown when the current issue
// type is configured for one of those) ---
const estimateLabel = computed(() => {
  if (currentTaskType.value?.estimationType === 'hours') return t('tasks.estimationHours') || 'Hours';
  if (currentTaskType.value?.estimationType === 'story_points') return t('tasks.estimationStoryPoints') || 'Story points';
  return '';
});
const estimateDraft = ref<number | undefined>(undefined);
watch(() => props.task?.estimateValue, (v) => { estimateDraft.value = v ?? undefined; }, { immediate: true });
function commitEstimate() {
  if ((estimateDraft.value ?? undefined) === (props.task?.estimateValue ?? undefined)) return;
  saveField({ estimateValue: estimateDraft.value ?? undefined });
}

// --- Contact (name / phone with mask+validation / address) ---
const clientNameDraft = ref('');
const clientPhoneDraft = ref('');
watch(() => props.task, (tsk) => {
  clientNameDraft.value = tsk?.clientNameSnapshot || '';
  clientPhoneDraft.value = tsk?.clientPhoneSnapshot || '';
}, { immediate: true });
const phoneLooksInvalid = computed(() => !!clientPhoneDraft.value.trim() && !isPhoneInputValid(clientPhoneDraft.value.trim()));
function onPhoneInput(e: Event) {
  const target = e.target as HTMLInputElement;
  const sanitized = sanitizePhoneInput(target.value);
  if (target.value !== sanitized) target.value = sanitized;
  clientPhoneDraft.value = sanitized;
}
function commitClientName() {
  if (clientNameDraft.value === (props.task?.clientNameSnapshot || '')) return;
  saveField({ clientNameSnapshot: clientNameDraft.value.trim() || undefined });
}
function commitClientPhone() {
  if (phoneLooksInvalid.value) return;
  if (clientPhoneDraft.value === (props.task?.clientPhoneSnapshot || '')) return;
  saveField({ clientPhoneSnapshot: clientPhoneDraft.value.trim() || undefined });
}

const addressDraft = ref('');
watch(() => props.task?.textAddress, (v) => { addressDraft.value = v || ''; }, { immediate: true });
async function commitAddress() {
  if (!props.task || addressDraft.value === (props.task.textAddress || '')) return;
  try {
    const token = await getToken();
    const { tasksUpdateTaskLocation } = await import('@/api/tasks/task/update');
    const updated = await tasksUpdateTaskLocation(token, props.nsSlug, {
      taskId: props.task.id,
      textAddress: addressDraft.value.trim() || undefined,
      lat: props.task.lat ?? undefined,
      lng: props.task.lng ?? undefined,
    });
    emit('changed', updated);
  } catch (e) {
    logError('[TaskDetailSlideover] address save failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to save address', color: 'red' });
  }
}

// Map pin -- editable on demand rather than always-on, since most tasks
// never need it touched after creation.
const editingLocation = ref(false);
async function updateLocationPin(lat: number, lng: number) {
  if (!props.task) return;
  try {
    const token = await getToken();
    const { tasksUpdateTaskLocation } = await import('@/api/tasks/task/update');
    const updated = await tasksUpdateTaskLocation(token, props.nsSlug, {
      taskId: props.task.id,
      textAddress: props.task.textAddress ?? undefined,
      lat,
      lng,
    });
    emit('changed', updated);
  } catch (e) {
    logError('[TaskDetailSlideover] location pin save failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to save location', color: 'red' });
  }
}

const updatingStatus = ref(false);
const isStatusPickerOpen = ref(false);
async function handleStatusChange(s: StatusRow) {
  if (!props.task) return;
  isStatusPickerOpen.value = false;
  if (s.key === props.task.status) return;
  const missing = blockingRequiredStatuses(s, props.boardStatuses, props.task.visitedStatuses);
  if (missing.length) {
    useToast().add({
      title: t('tasks.requiredStatusBlocked', { status: missing.map((m) => m.label).join(', ') }) || `Must pass through: ${missing.map((m) => m.label).join(', ')}`,
      color: 'amber',
    });
    return;
  }
  updatingStatus.value = true;
  try {
    const token = await getToken();
    const { tasksUpdateTaskStatus } = await import('@/api/tasks/task/update');
    const updated = await tasksUpdateTaskStatus(token, props.nsSlug, { taskId: props.task.id, status: s.key, isTerminal: s.isTerminal });
    emit('changed', updated);
  } catch (e) {
    logError('[TaskDetailSlideover] status change failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to update status', color: 'red' });
  } finally {
    updatingStatus.value = false;
  }
}

const updatingAssignee = ref(false);
async function handleAssigneeChange(userId: string) {
  if (!props.task) return;
  updatingAssignee.value = true;
  try {
    const token = await getToken();
    const { tasksAssignTask } = await import('@/api/tasks/task/update');
    const updated = await tasksAssignTask(token, props.nsSlug, { taskId: props.task.id, assigneeUserId: userId || null });
    emit('changed', updated);
  } catch (e) {
    logError('[TaskDetailSlideover] assign failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to assign issue', color: 'red' });
  } finally {
    updatingAssignee.value = false;
  }
}

// Sprint (cycle) -- only offer open sprints as new destinations, but still
// show the task's current sprint by name even if it has since been closed.
const cycleSelectOptions = computed(() => {
  const open = (props.cycles || []).filter((c) => !c.isClosed);
  const options = [{ label: t('tasks.backlog') || 'Backlog', value: '' }, ...open.map((c) => ({ label: c.name, value: c.id }))];
  const currentId = props.task?.cycleId;
  if (currentId && !options.some((o) => o.value === currentId)) {
    const closed = (props.cycles || []).find((c) => c.id === currentId);
    if (closed) options.push({ label: `${closed.name} (${t('tasks.sprintClosed') || 'closed'})`, value: closed.id });
  }
  return options;
});
const updatingCycle = ref(false);
async function handleCycleChange(cycleId: string) {
  if (!props.task || cycleId === (props.task.cycleId || '')) return;
  updatingCycle.value = true;
  try {
    const token = await getToken();
    const { tasksUpdateTaskCycle } = await import('@/api/tasks/task/update');
    const updated = await tasksUpdateTaskCycle(token, props.nsSlug, props.task.id, cycleId || null);
    emit('changed', updated);
  } catch (e) {
    logError('[TaskDetailSlideover] cycle change failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to move issue', color: 'red' });
  } finally {
    updatingCycle.value = false;
  }
}

// Members (task_members) — additional watchers/reviewers beyond the single
// primary assignee field.
const members = ref<TaskMember[]>([]);
const loadingMembers = ref(false);
async function loadMembers() {
  if (!props.task) return;
  loadingMembers.value = true;
  try {
    const token = await getToken();
    const { tasksTaskMembersList } = await import('@/api/tasks/task/members');
    members.value = await tasksTaskMembersList(token, props.nsSlug, props.task.id);
  } catch (e) {
    logError('[TaskDetailSlideover] loadMembers failed', e);
  } finally {
    loadingMembers.value = false;
  }
}
const newMemberUserId = ref('');
async function addMember() {
  if (!props.task || !newMemberUserId.value) return;
  try {
    const token = await getToken();
    const { tasksAddTaskMember } = await import('@/api/tasks/task/members');
    const member = await tasksAddTaskMember(token, props.nsSlug, { taskId: props.task.id, userId: newMemberUserId.value, role: 'WATCHER' });
    members.value = [...members.value, member];
    newMemberUserId.value = '';
  } catch (e) {
    logError('[TaskDetailSlideover] addMember failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to add member', color: 'red' });
  }
}
async function removeMember(id: string) {
  try {
    const token = await getToken();
    const { tasksRemoveTaskMember } = await import('@/api/tasks/task/members');
    await tasksRemoveTaskMember(token, props.nsSlug, id);
    members.value = members.value.filter((m) => m.id !== id);
  } catch (e) {
    logError('[TaskDetailSlideover] removeMember failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to remove member', color: 'red' });
  }
}

// Activity timeline (read-only audit log).
const activities = ref<TaskActivity[]>([]);
const loadingActivity = ref(false);
async function loadActivity() {
  if (!props.task) return;
  loadingActivity.value = true;
  try {
    const token = await getToken();
    const { tasksTaskActivityList } = await import('@/api/tasks/activity/list');
    const res = await tasksTaskActivityList(token, props.nsSlug, props.task.id);
    activities.value = res.activities;
  } catch (e) {
    logError('[TaskDetailSlideover] loadActivity failed', e);
  } finally {
    loadingActivity.value = false;
  }
}

const activityLabel = (a: TaskActivity) => ({
  STATUS_CHANGE: t('tasks.activityStatusChange') || 'Status changed',
  ASSIGN: t('tasks.activityAssign') || 'Assignee changed',
  LOCATION_SET: t('tasks.activityLocationSet') || 'Location updated',
  COMMENT: t('tasks.activityComment') || 'Comment',
  PROBLEM_REPORTED: t('tasks.activityProblem') || 'Problem reported',
  CREATE: t('tasks.activityCreate') || 'Issue created',
  UPDATE: t('tasks.activityUpdate') || 'Issue updated',
  CLIENT_SNAPSHOT_UPDATED: t('tasks.activityClientSnapshotUpdated') || 'Contact info refreshed',
  DELIVERY_PHOTO_ADDED: t('tasks.activityDeliveryPhotoAdded') || 'Delivery photo added',
  AUTOMATION_TRIGGERED: t('tasks.activityAutomationTriggered') || 'Automation triggered',
  SLA_BREACHED: t('tasks.activitySlaBreached') || 'SLA breached',
}[a.action] || a.action);

const ACTIVITY_ICONS: Record<string, string> = {
  STATUS_CHANGE: 'lucide:arrow-right-left',
  ASSIGN: 'lucide:user',
  LOCATION_SET: 'lucide:map-pin',
  COMMENT: 'lucide:message-square',
  PROBLEM_REPORTED: 'lucide:alert-triangle',
  CREATE: 'lucide:sparkles',
  UPDATE: 'lucide:pencil',
  CLIENT_SNAPSHOT_UPDATED: 'lucide:refresh-cw',
  DELIVERY_PHOTO_ADDED: 'lucide:camera',
  AUTOMATION_TRIGGERED: 'lucide:zap',
  SLA_BREACHED: 'lucide:alarm-clock',
};
const ACTIVITY_COLORS: Record<string, string> = {
  STATUS_CHANGE: 'bg-blue-400',
  ASSIGN: 'bg-violet-400',
  LOCATION_SET: 'bg-teal-400',
  COMMENT: 'bg-gray-400',
  PROBLEM_REPORTED: 'bg-red-400',
  CREATE: 'bg-primary-400',
  UPDATE: 'bg-gray-400',
  CLIENT_SNAPSHOT_UPDATED: 'bg-cyan-400',
  DELIVERY_PHOTO_ADDED: 'bg-amber-400',
  AUTOMATION_TRIGGERED: 'bg-indigo-400',
  SLA_BREACHED: 'bg-red-500',
};
function activityIcon(a: TaskActivity): string {
  return ACTIVITY_ICONS[a.action] || 'lucide:dot';
}
function activityColor(a: TaskActivity): string {
  return ACTIVITY_COLORS[a.action] || 'bg-gray-400';
}

// Activity rows only say *that* something changed by default -- pull the
// actual before/after values out of the jsonb snapshots the backend already
// records (see task.repo.go's WriteLog calls) so the log reads like
// "Status changed: To Do → In Progress" instead of just "Status changed".
function parseState(json?: string | null): any {
  if (!json) return null;
  try { return JSON.parse(json); } catch { return null; }
}
function statusLabelFor(key?: string | null): string {
  if (!key) return '';
  return props.boardStatuses.find((s) => s.key === key)?.label || key;
}
function assigneeLabelFor(userId?: string | null): string {
  return userId ? memberLabel(userId) : (t('tasks.unassigned') || 'Unassigned');
}
function activityDetail(a: TaskActivity): string {
  if (a.action === 'STATUS_CHANGE') {
    const before = parseState(a.beforeState)?.status;
    const after = parseState(a.afterState)?.status;
    if (before && after) return `${statusLabelFor(before)} → ${statusLabelFor(after)}`;
  }
  if (a.action === 'ASSIGN') {
    const beforeState = parseState(a.beforeState);
    const afterState = parseState(a.afterState);
    if (beforeState && afterState) return `${assigneeLabelFor(beforeState.assignee_user_id)} → ${assigneeLabelFor(afterState.assignee_user_id)}`;
  }
  return '';
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

watch(() => [props.modelValue, props.task?.id], () => {
  editingTitle.value = false;
  editingDescription.value = false;
  if (!props.modelValue || !props.task) return;
  loadMembers();
  loadActivity();
});

const refreshingSnapshot = ref(false);
async function handleRefreshSnapshot() {
  if (!props.task) return;
  refreshingSnapshot.value = true;
  try {
    const token = await getToken();
    const { tasksRefreshClientSnapshot } = await import('@/api/tasks/task/update');
    const updated = await tasksRefreshClientSnapshot(token, props.nsSlug, props.task.id);
    emit('changed', updated);
  } catch (e) {
    logError('[TaskDetailSlideover] refresh snapshot failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to refresh from Contacts', color: 'red' });
  } finally {
    refreshingSnapshot.value = false;
  }
}

// deliveryPhotoUrl is stored as a relative "/media/issues/..." path — resolve
// it against the tasks API origin, same as menuUploadImage does for Menu.
const deliveryPhotoFullUrl = computed(() => {
  if (!props.task?.deliveryPhotoUrl) return '';
  return `${getApiBaseUrl('tasks')}${props.task.deliveryPhotoUrl}`;
});

async function handleDelete() {
  if (!props.task) return;
  if (!(await confirm({ message: t('tasks.confirmDeleteTask') || 'Delete this issue?' }))) return;
  try {
    const token = await getToken();
    const { tasksDeleteTask } = await import('@/api/tasks/task/delete');
    await tasksDeleteTask(token, props.nsSlug, props.task.id);
    emit('deleted', props.task.id);
    isOpen.value = false;
  } catch (e) {
    logError('[TaskDetailSlideover] delete failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to delete issue', color: 'red' });
  }
}
</script>

<template>
  <USlideover v-model="isOpen" :ui="{ width: 'w-screen max-w-full sm:max-w-2xl lg:max-w-4xl' }">
    <UCard v-if="task" :ui="{ ring: '', divide: '', rounded: 'rounded-none', shadow: 'shadow-none', body: { base: 'flex-1 overflow-hidden flex flex-col lg:flex-row min-h-0', padding: 'p-0' }, header: { padding: 'px-0 py-0 sm:px-0 sm:py-0' } }" class="flex flex-col h-full overflow-hidden">
      <template #header>
        <div class="h-1" :class="priorityAccentClass" />
        <div class="flex items-start justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <div class="flex items-start gap-3 min-w-0 flex-1">
            <span
              class="flex h-9 w-9 items-center justify-center rounded-full flex-shrink-0 mt-0.5"
              :style="{ backgroundColor: currentTaskType?.color || '#9ca3af' }"
            >
              <UIcon :name="currentTaskType?.icon || 'lucide:shapes'" class="w-4 h-4 text-white" />
            </span>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5 text-xs text-gray-400 mb-0.5">
                <span class="font-mono">{{ shortCode }}</span>
              </div>
              <div class="flex items-center gap-1.5 group">
                <input
                  v-if="editingTitle"
                  v-model="titleDraft"
                  autofocus
                  class="text-lg font-semibold bg-transparent border-b border-primary-400 focus:outline-none w-full"
                  @blur="commitTitle"
                  @keyup.enter="($event.target as HTMLInputElement).blur()"
                  @keyup.esc="editingTitle = false"
                />
                <template v-else>
                  <h3 class="text-lg font-semibold leading-snug cursor-text hover:bg-gray-50 dark:hover:bg-gray-800 rounded px-1 -mx-1 truncate" @click="startTitleEdit">{{ maskProfanity(task.title) }}</h3>
                  <button type="button" class="text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 flex-shrink-0" :title="t('app.edit') || 'Edit'" @click="startTitleEdit">
                    <UIcon name="lucide:pencil" class="w-3.5 h-3.5" />
                  </button>
                </template>
              </div>
              <div class="flex items-center gap-2 flex-wrap mt-1.5">
                <UPopover v-model:open="isStatusPickerOpen" :popper="{ placement: 'bottom-start', strategy: 'fixed' }">
                  <button
                    type="button"
                    class="flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors"
                    :class="columnColorClass(statusInfo(task.status)?.color)"
                    :disabled="updatingStatus"
                  >
                    <span class="truncate max-w-[120px]">{{ statusInfo(task.status)?.label || task.status }}</span>
                    <UIcon :name="updatingStatus ? 'lucide:loader-2' : 'lucide:chevron-down'" :class="['w-3 h-3 flex-shrink-0', updatingStatus && 'animate-spin']" />
                  </button>
                  <template #panel>
                    <div class="p-1 w-48">
                      <button
                        v-for="s in boardStatuses"
                        :key="s.key"
                        type="button"
                        class="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-colors mb-0.5 last:mb-0"
                        :class="[columnColorClass(s.color), s.key === task!.status && 'ring-1 ring-inset ring-gray-400 dark:ring-gray-500']"
                        @click="handleStatusChange(s)"
                      >
                        <span class="truncate">{{ s.label }}</span>
                        <UIcon v-if="s.key === task!.status" name="lucide:check" class="w-3.5 h-3.5 ml-auto flex-shrink-0" />
                      </button>
                    </div>
                  </template>
                </UPopover>
                <span class="flex items-center gap-1 text-xs text-gray-400"><UIcon :name="priorityIcon(task.priority)" :class="['w-3.5 h-3.5', priorityColorClass(task.priority)]" /></span>
                <span v-if="task.assigneeUserId" class="truncate max-w-[140px] text-xs text-gray-400">{{ memberLabel(task.assigneeUserId) }}</span>
                <span v-else class="italic text-xs text-gray-400">{{ t('tasks.unassigned') || 'Unassigned' }}</span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-1 flex-shrink-0">
            <UIcon v-if="saving" name="lucide:loader-2" class="w-3.5 h-3.5 animate-spin text-gray-400" />
            <UButton icon="lucide:trash-2" size="2xs" color="red" variant="ghost" @click="handleDelete" />
            <UButton icon="lucide:x" size="sm" color="gray" variant="ghost" @click="isOpen = false" />
          </div>
        </div>
      </template>

      <div class="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6">
      <div v-if="hasPendingUpdate" class="flex items-center justify-between gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-800 dark:text-amber-300 mb-4">
        <span class="flex items-center gap-1.5"><UIcon name="lucide:refresh-cw" class="w-3.5 h-3.5" />{{ t('tasks.updatedElsewhere') || 'Someone updated this task' }}</span>
        <UButton size="2xs" color="amber" variant="solid" @click="emit('apply-pending-update')">{{ t('tasks.refreshTask') || 'Update' }}</UButton>
      </div>

      <div class="divide-y divide-gray-100 dark:divide-gray-800">
      <div class="pb-4">
        <h4 class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
          <UIcon name="lucide:align-left" class="w-3.5 h-3.5" />
          {{ t('tasks.description') || 'Description' }}
          <span class="ml-auto text-[10px] normal-case text-gray-300 dark:text-gray-600 font-normal">{{ t('tasks.markdownSupported') || 'Markdown supported' }}</span>
        </h4>
        <UTextarea
          v-if="editingDescription"
          v-model="descriptionDraft"
          :rows="4"
          autofocus
          autoresize
          resize
          @blur="commitDescription"
        />
        <div
          v-else-if="task.description"
          class="md-content text-sm cursor-text hover:bg-gray-50 dark:hover:bg-gray-800 rounded px-1 -mx-1 py-0.5"
          v-html="renderedDescription"
          @click="startDescriptionEdit"
        />
        <p v-else class="text-sm text-gray-400 italic cursor-text hover:bg-gray-50 dark:hover:bg-gray-800 rounded px-1 -mx-1 py-0.5" @click="startDescriptionEdit">
          {{ t('tasks.addDescription') || 'Add a description...' }}
        </p>
      </div>

      <div class="py-4">
        <h4 class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
          <UIcon name="lucide:list-checks" class="w-3.5 h-3.5" />
          {{ t('tasks.sectionDetails') || 'Details' }}
        </h4>
        <div class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <div class="text-[11px] text-gray-400 mb-1">{{ t('tasks.taskType') || 'Issue type' }}</div>
              <USelectMenu
                :model-value="task.taskTypeId"
                :options="taskTypes.map((tt) => ({ label: tt.name, value: tt.id, icon: tt.icon }))"
                value-attribute="value"
                option-attribute="label"
                :popper="{ strategy: 'fixed' }"
                @update:model-value="handleTaskTypeChange"
              >
                <template #label>
                  <UIcon :name="currentTaskType?.icon || 'lucide:shapes'" class="w-4 h-4" />
                  <span>{{ currentTaskType?.name }}</span>
                </template>
                <template #option="{ option }">
                  <UIcon :name="option.icon || 'lucide:shapes'" class="w-4 h-4" />
                  <span>{{ option.label }}</span>
                </template>
              </USelectMenu>
            </div>
            <div>
              <div class="text-[11px] text-gray-400 mb-1">{{ t('tasks.priority') || 'Priority' }}</div>
              <USelectMenu
                :model-value="task.priority"
                :options="priorityOptions"
                value-attribute="value"
                option-attribute="label"
                :popper="{ strategy: 'fixed' }"
                @update:model-value="handlePriorityChange"
              >
                <template #label>
                  <UIcon :name="priorityIcon(task.priority)" :class="['w-4 h-4', priorityColorClass(task.priority)]" />
                  <span>{{ priorityOptions.find((p) => p.value === task!.priority)?.label }}</span>
                </template>
              </USelectMenu>
            </div>
          </div>
          <div :class="estimateLabel ? 'grid grid-cols-2 gap-3' : ''">
            <div>
              <div class="text-[11px] text-gray-400 mb-1">{{ t('tasks.dueAt') || 'Due date' }}</div>
              <UInput v-model="dueAtDraft" type="datetime-local" @blur="commitDueAt" />
            </div>
            <div v-if="estimateLabel">
              <div class="text-[11px] text-gray-400 mb-1">{{ t('tasks.estimateValue') || 'Estimate' }} ({{ estimateLabel }})</div>
              <UInput v-model.number="estimateDraft" type="number" min="0" step="0.5" @blur="commitEstimate" />
            </div>
          </div>
          <div :class="cyclesEnabled ? 'grid grid-cols-2 gap-3' : ''">
            <div>
              <div class="text-[11px] text-gray-400 mb-1">{{ t('tasks.assignee') || 'Assignee' }}</div>
              <div class="flex items-center gap-1.5">
                <USelectMenu
                  :model-value="task.assigneeUserId || ''"
                  :options="[{ label: t('tasks.unassigned') || 'Unassigned', value: '' }, ...memberOptions]"
                  value-attribute="value"
                  option-attribute="label"
                  searchable
                  class="flex-1"
                  :popper="{ strategy: 'fixed' }"
                  :loading="updatingAssignee"
                  @update:model-value="handleAssigneeChange"
                />
                <UButton v-if="task.assigneeUserId" icon="lucide:x" size="2xs" color="gray" variant="ghost" :title="t('tasks.unassigned') || 'Unassigned'" @click="handleAssigneeChange('')" />
              </div>
            </div>
            <div v-if="cyclesEnabled">
              <div class="text-[11px] text-gray-400 mb-1">{{ t('tasks.sprint') || 'Sprint' }}</div>
              <USelectMenu
                :model-value="task.cycleId || ''"
                :options="cycleSelectOptions"
                value-attribute="value"
                option-attribute="label"
                :popper="{ strategy: 'fixed' }"
                :loading="updatingCycle"
                @update:model-value="handleCycleChange"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="py-4">
        <h4 class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
          <UIcon name="lucide:map-pin" class="w-3.5 h-3.5" />
          {{ t('tasks.mapPin') || 'Map pin' }}
          <button type="button" class="ml-auto text-[11px] normal-case font-medium text-primary-600 dark:text-primary-400" @click="editingLocation = !editingLocation">
            {{ editingLocation ? (t('app.done') || 'Done') : (t('tasks.editLocation') || 'Edit pin') }}
          </button>
        </h4>
        <ClientOnly v-if="editingLocation">
          <BranchLocationPicker :lat="task.lat" :lng="task.lng" @update="updateLocationPin" />
        </ClientOnly>
        <NuxtLink
          v-else-if="task.lat && task.lng"
          :to="`/${nsSlug}/issues/${boardSlug}/map?task=${shortCode}`"
          class="text-sm text-primary-600 dark:text-primary-400 flex items-center gap-1.5"
          @click="isOpen = false"
        >
          <UIcon name="lucide:map" class="w-3.5 h-3.5" />{{ t('tasks.viewOnMap') || 'View pin on map' }}
        </NuxtLink>
        <p v-else class="text-sm text-gray-400 italic">{{ t('tasks.noMapPin') || 'No pin set' }}</p>
      </div>

      <div class="py-4">
        <h4 class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
          <UIcon name="lucide:contact" class="w-3.5 h-3.5" />
          {{ t('tasks.client') || 'Contact' }}
          <UButton
            v-if="task.clientId"
            icon="lucide:refresh-cw"
            size="2xs"
            color="gray"
            variant="ghost"
            class="ml-auto"
            :loading="refreshingSnapshot"
            @click="handleRefreshSnapshot"
          >
            {{ t('tasks.refreshFromContacts') || 'Refresh' }}
          </UButton>
        </h4>
        <div class="space-y-2">
          <div class="flex items-center gap-1.5">
            <UInput v-model="clientNameDraft" size="sm" class="flex-1" :placeholder="t('tasks.clientName') || 'Contact name'" @blur="commitClientName" />
            <UBadge v-if="task.clientIsVipSnapshot" color="yellow" variant="soft" size="xs">{{ t('tasks.vip') || 'VIP' }}</UBadge>
          </div>
          <UInput
            :model-value="clientPhoneDraft"
            type="tel"
            size="sm"
            :placeholder="t('tasks.clientPhone') || 'Contact phone'"
            @input="onPhoneInput"
            @blur="commitClientPhone"
          />
          <p v-if="phoneLooksInvalid" class="text-xs text-red-500">{{ t('contacts.invalidPhone') || 'Invalid phone format' }}</p>
          <div>
            <label class="text-[11px] text-gray-400 mb-1 block">{{ t('tasks.address') || 'Contact address' }}</label>
            <UInput v-model="addressDraft" size="sm" :placeholder="t('tasks.addressPlaceholder') || 'Free-text address'" @blur="commitAddress" />
          </div>
        </div>
      </div>

      <div v-if="task.deliveryPhotoUrl" class="py-4">
        <h4 class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
          <UIcon name="lucide:camera" class="w-3.5 h-3.5" />
          {{ t('tasks.deliveryPhoto') || 'Delivery photo' }}
        </h4>
        <a :href="deliveryPhotoFullUrl" target="_blank">
          <img :src="deliveryPhotoFullUrl" class="rounded-lg max-h-48 object-cover" :alt="t('tasks.deliveryPhoto') || 'Delivery photo'" />
        </a>
      </div>

      <div class="pt-4">
        <h4 class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
          <UIcon name="lucide:eye" class="w-3.5 h-3.5" />
          {{ t('tasks.members') || 'Watchers' }}
        </h4>
        <div class="space-y-1.5">
          <div v-for="m in members" :key="m.id" class="flex items-center justify-between text-sm">
            <span>{{ memberLabel(m.userId) }} <span class="text-gray-400">· {{ m.role }}</span></span>
            <UButton icon="lucide:x" size="2xs" color="gray" variant="ghost" @click="removeMember(m.id)" />
          </div>
          <div class="flex items-center gap-2">
            <USelectMenu
              v-model="newMemberUserId"
              :options="memberOptions"
              value-attribute="value"
              option-attribute="label"
              searchable
              class="flex-1"
              :popper="{ strategy: 'fixed' }"
            />
            <UButton v-if="newMemberUserId" icon="lucide:x" size="xs" color="gray" variant="ghost" @click="newMemberUserId = ''" />
            <UButton icon="lucide:plus" size="xs" color="gray" variant="soft" :disabled="!newMemberUserId" @click="addMember" />
          </div>
        </div>
      </div>
      </div>
      </div>

      <!-- Activity lives in its own persistent side panel on wide screens
           (rather than one more card at the bottom of a long scroll) so it's
           always visible while working through the fields on the left --
           falls back to stacking below on narrow/mobile viewports. -->
      <div class="lg:w-72 flex-shrink-0 border-t lg:border-t-0 lg:border-l border-gray-100 dark:border-gray-800 overflow-y-auto p-4 sm:p-6">
        <h4 class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
          <UIcon name="lucide:history" class="w-3.5 h-3.5" />
          {{ t('tasks.activity') || 'Activity' }}
        </h4>
        <div v-if="loadingActivity" class="text-xs text-gray-400">{{ t('app.loading') || 'Loading...' }}</div>
        <div v-else-if="!activities.length" class="text-xs text-gray-400">{{ t('tasks.noActivity') || 'No activity yet' }}</div>
        <ul v-else>
          <li v-for="(a, idx) in activities" :key="a.id" class="relative pl-6" :class="idx !== activities.length - 1 ? 'pb-4' : ''">
            <span v-if="idx !== activities.length - 1" class="absolute left-[8px] top-4 bottom-0 w-px bg-gray-200 dark:bg-gray-800" />
            <span class="absolute left-0 top-0.5 flex h-4 w-4 items-center justify-center rounded-full flex-shrink-0" :class="activityColor(a)">
              <UIcon :name="activityIcon(a)" class="w-2.5 h-2.5 text-white" />
            </span>
            <div class="text-xs font-medium text-gray-700 dark:text-gray-300">{{ activityLabel(a) }}</div>
            <div v-if="activityDetail(a)" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ activityDetail(a) }}</div>
            <p v-if="a.comment" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 italic">{{ maskProfanity(a.comment) }}</p>
            <p class="text-[10px] text-gray-400 mt-0.5">{{ formatDate(a.createdAt) }}</p>
          </li>
        </ul>
      </div>
    </UCard>
  </USlideover>
</template>

<style scoped>
.md-content :deep(p) { margin-bottom: 0.5em; white-space: pre-wrap; }
.md-content :deep(ul) { list-style: disc; padding-left: 1.25em; margin-bottom: 0.5em; }
.md-content :deep(ol) { list-style: decimal; padding-left: 1.25em; margin-bottom: 0.5em; }
.md-content :deep(a) { color: rgb(var(--color-primary-500)); text-decoration: underline; }
.md-content :deep(code) { background: rgba(128, 128, 128, 0.15); padding: 0.1em 0.3em; border-radius: 0.25em; font-size: 0.9em; }
.md-content :deep(pre) { background: rgba(128, 128, 128, 0.15); padding: 0.5em 0.75em; border-radius: 0.375em; overflow-x: auto; margin-bottom: 0.5em; }
.md-content :deep(pre code) { background: none; padding: 0; }
.md-content :deep(strong) { font-weight: 600; }
.md-content :deep(blockquote) { border-left: 3px solid rgba(128, 128, 128, 0.35); padding-left: 0.75em; color: rgb(107 114 128); margin-bottom: 0.5em; }
.md-content :deep(hr) { border: none; border-top: 1px solid rgba(128, 128, 128, 0.25); margin: 0.75em 0; }
.md-content :deep(h1) { font-size: 1.5em; font-weight: 700; margin: 0.6em 0 0.4em; line-height: 1.25; }
.md-content :deep(h2) { font-size: 1.3em; font-weight: 700; margin: 0.6em 0 0.4em; line-height: 1.3; }
.md-content :deep(h3) { font-size: 1.15em; font-weight: 600; margin: 0.5em 0 0.35em; line-height: 1.3; }
.md-content :deep(h4),
.md-content :deep(h5),
.md-content :deep(h6) { font-size: 1em; font-weight: 600; margin: 0.5em 0 0.3em; }
.md-content :deep(h1:first-child),
.md-content :deep(h2:first-child),
.md-content :deep(h3:first-child) { margin-top: 0; }
</style>
