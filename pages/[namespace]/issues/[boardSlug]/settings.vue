<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useConfirm } from '@/composables/useConfirm';
import { useTasksToken } from '@/composables/useTasksToken';
import { useTasksStaffRole } from '@/composables/useTasksStaffRole';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import { getApiBasePath } from '@/utils/api-base';
import { COLUMN_COLOR_PRESETS } from '@/utils/taskDisplay';
import TaskTypeModal from '@/components/tasks/TaskTypeModal.vue';
import AutomationRulesManager from '@/components/tasks/AutomationRulesManager.vue';
import type { TaskBoard } from '@/api/tasks/board/list';
import type { TaskType } from '@/api/tasks/tasktype/list';

interface StatusRow { key: string; label: string; isTerminal: boolean; isRequired: boolean; color: string; mapsTo: string }

// Menu's actual order-status enum (order.ent.go orderStatusLabels) -- a
// status here must match one of these exactly, or UpdateOrderStatus rejects
// it with "unknown order status" (case-sensitive, no normalization). Labels
// reuse Menu's own translations (pages/menu/index.vue's statusLabel) so the
// two apps describe the same status the same way.
const ORDER_STATUS_OPTIONS = computed(() => [
  { value: '', label: '—' },
  { value: 'NEW', label: t('menu.statusNew') || 'New' },
  { value: 'ACCEPTED', label: t('menu.statusAccepted') || 'Accepted' },
  { value: 'IN_PREPARATION', label: t('menu.statusInPreparation') || 'Preparing' },
  { value: 'READY', label: t('menu.statusReady') || 'Ready' },
  { value: 'DELIVERING', label: t('menu.statusDelivering') || 'On the way' },
  { value: 'COMPLETED', label: t('menu.statusCompleted') || 'Completed' },
  { value: 'CANCELLED', label: t('menu.statusCancelled') || 'Cancelled' },
]);

const { t } = useI18n();
const { confirm } = useConfirm();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const boardSlug = computed(() => route.params.boardSlug as string);
const { token: hubToken } = useAuth();

// Defense in depth: the "Board settings" link itself is already hidden for
// assignee/viewer, but a direct URL visit would otherwise land on a page
// whose every action the backend rejects anyway (@issuesAuth(roles: [OWNER,
// MANAGER])). Bounce back rather than show a screen that can't do anything.
const { role: staffRole, isOwnerOrManager } = useTasksStaffRole();
watch(staffRole, (r) => {
  if (r && !isOwnerOrManager.value) {
    navigateTo(`/${nsSlug.value}/issues/${boardSlug.value}`);
  }
}, { immediate: true });

async function getToken(): Promise<string> {
  const { current } = useTasksToken();
  const token = current();
  if (!token) throw new Error('No tasks token');
  return token;
}

const board = ref<TaskBoard | null>(null);
const loading = ref(false);
const saving = ref(false);

// Menu integration (plan §6.1/§6.2) — gates both the automations manager
// and which terminal-status "maps_to" values a rule can trigger on.
const menuIntegrationEnabled = computed(() => {
  try {
    return !!(board.value?.integrationFlags ? JSON.parse(board.value.integrationFlags).menu : false);
  } catch {
    return false;
  }
});
const automationTriggerOptions = computed<{ value: string; label: string }[]>(() => {
  try {
    const arr = board.value?.statuses ? JSON.parse(board.value.statuses) : [];
    if (!Array.isArray(arr)) return [];
    // Any column can drive an automation now, not just terminal ones -- e.g.
    // "left the first column" (entered the second) maps to DELIVERING so a
    // courier picking up a task marks the linked order as on the way, while
    // reaching a terminal column still maps to COMPLETED.
    return arr
      .filter((s: any) => s.maps_to)
      .map((s: any) => ({ value: s.maps_to, label: s.label || s.key }));
  } catch {
    return [];
  }
});
const isAutomationsOpen = ref(false);

// Namespace members -- needed for the "escalate to" picker on each issue
// type's SLA settings.
const memberOptions = ref<{ label: string; value: string }[]>([]);
async function loadMembers() {
  try {
    if (!hubToken.value) return;
    const token = await getToken();
    const { loadIssuesStaffMemberOptions } = await import('@/utils/issuesMembers');
    memberOptions.value = await loadIssuesStaffMemberOptions(hubToken.value, token, nsSlug.value);
  } catch (e) {
    logError('[issues/board-settings] loadMembers failed', e);
  }
}

// Issue types -- shown as a plain inline list on the "types" tab rather
// than behind an extra "manage" modal, since this tab has nothing else to
// share space with.
const taskTypes = ref<TaskType[]>([]);
async function loadTaskTypes() {
  if (!board.value) return;
  try {
    const token = await getToken();
    const { tasksTaskTypesList } = await import('@/api/tasks/tasktype/list');
    const res = await tasksTaskTypesList(token, nsSlug.value, board.value.id);
    taskTypes.value = res.taskTypes;
  } catch (e) {
    logError('[issues/board-settings] loadTaskTypes failed', e);
  }
}
const isTaskTypeModalOpen = ref(false);
const editingTaskType = ref<TaskType | null>(null);
const savingTaskType = ref(false);
function openCreateTaskType() {
  editingTaskType.value = null;
  isTaskTypeModalOpen.value = true;
}
function openEditTaskType(tt: TaskType) {
  editingTaskType.value = tt;
  isTaskTypeModalOpen.value = true;
}
async function handleTaskTypeSubmit(payload: Record<string, any>) {
  if (!board.value) return;
  savingTaskType.value = true;
  try {
    const token = await getToken();
    if (editingTaskType.value) {
      const { tasksUpdateTaskType } = await import('@/api/tasks/tasktype/update');
      const updated = await tasksUpdateTaskType(token, nsSlug.value, { id: editingTaskType.value.id, ...payload });
      const idx = taskTypes.value.findIndex((tt) => tt.id === updated.id);
      if (idx !== -1) taskTypes.value[idx] = updated;
      useToast().add({ title: t('tasks.taskTypeUpdated') || 'Issue type updated', color: 'primary' });
    } else {
      const { tasksCreateTaskType } = await import('@/api/tasks/tasktype/create');
      const created = await tasksCreateTaskType(token, nsSlug.value, { boardId: board.value.id, ...payload } as any);
      taskTypes.value = [...taskTypes.value, created];
      useToast().add({ title: t('tasks.taskTypeCreated') || 'Issue type created', color: 'primary' });
    }
    isTaskTypeModalOpen.value = false;
  } catch (e) {
    logError('[issues/board-settings] task type save failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to save issue type', color: 'red' });
  } finally {
    savingTaskType.value = false;
  }
}
async function handleDeleteTaskType(tt: TaskType) {
  if (taskTypes.value.length <= 1) {
    useToast().add({ title: t('tasks.cannotDeleteLastTaskType') || 'A board needs at least one issue type', color: 'amber' });
    return;
  }
  if (!(await confirm({ message: t('tasks.confirmDeleteTaskType') || 'Delete this issue type?' }))) return;
  try {
    const token = await getToken();
    const { tasksDeleteTaskType } = await import('@/api/tasks/tasktype/delete');
    await tasksDeleteTaskType(token, nsSlug.value, tt.id);
    taskTypes.value = taskTypes.value.filter((x) => x.id !== tt.id);
    useToast().add({ title: t('tasks.taskTypeDeleted') || 'Issue type deleted', color: 'primary' });
  } catch (e) {
    logError('[issues/board-settings] task type delete failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to delete issue type', color: 'red' });
  }
}

function goBack() {
  navigateTo(`/${nsSlug.value}/issues/${boardSlug.value}`);
}

const form = reactive({
  name: '',
  isActive: true,
  geoMap: false,
  zenMode: false,
  menuIntegration: false,
  cycles: false,
  cycleCarryOver: 'backlog' as 'backlog' | 'next',
});

const statuses = ref<StatusRow[]>([]);
const webhookSecret = ref('');
const regeneratingWebhook = ref(false);

const webhookUrl = computed(() => {
  if (!board.value || typeof window === 'undefined') return '';
  return `${window.location.origin}${getApiBasePath('tasks')}/webhook/${nsSlug.value}/boards/${board.value.id}/tasks`;
});

async function copyToClipboard(value: string, toastKey: string, fallback: string) {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    useToast().add({ title: t(toastKey) || fallback, color: 'primary' });
  } catch (e) {
    logError('[issues/board-settings] copy failed', e);
  }
}

async function regenerateWebhookSecret() {
  if (!board.value) return;
  if (!(await confirm({ message: t('tasks.webhookRegenerateConfirm') || 'Regenerate the webhook secret? The old one will stop working immediately.' }))) return;
  regeneratingWebhook.value = true;
  try {
    const token = await getToken();
    const { tasksRegenerateBoardWebhookSecret } = await import('@/api/tasks/board/regenerateWebhookSecret');
    const updated = await tasksRegenerateBoardWebhookSecret(token, nsSlug.value, board.value.id);
    webhookSecret.value = updated.webhookSecret;
    board.value = updated;
    useToast().add({ title: t('tasks.webhookRegenerated') || 'Webhook secret regenerated', color: 'primary' });
  } catch (e) {
    logError('[issues/board-settings] regenerate webhook secret failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to regenerate webhook secret', color: 'red' });
  } finally {
    regeneratingWebhook.value = false;
  }
}

// Feature-detection (plan §6.0): only offer to turn on an integration for a
// domain that's actually installed in this namespace — no point exposing a
// toggle for Menu if the tenant never installed it. Reuses the same Hub
// check the home dashboard uses to grey out "coming soon" apps.
const menuAppInstalled = ref(false);
async function loadInstalledApps() {
  if (!hubToken.value || !nsSlug.value) return;
  try {
    const { hubAreAppsInNamespace } = await import('@/api/hub/namespaces/isAppInNamespace');
    const installed = await hubAreAppsInNamespace(hubToken.value, nsSlug.value, ['pieceowater.menu']);
    menuAppInstalled.value = !!installed['pieceowater.menu'];
  } catch {
    menuAppInstalled.value = false;
  }
}

function parseFlags(json?: string): Record<string, boolean> {
  try { return json ? JSON.parse(json) : {}; } catch { return {}; }
}
function parseStatuses(json?: string): StatusRow[] {
  try {
    const arr = json ? JSON.parse(json) : [];
    return arr.map((s: any) => {
      // 'delivered' was a hardcoded, never-configurable default that never
      // actually matched Menu's order-status enum (it wants "COMPLETED",
      // uppercase) -- silently upgrade it rather than leave a permanently
      // broken automation target sitting in old boards.
      let mapsTo = String(s.maps_to || '');
      if (mapsTo === 'delivered') mapsTo = 'COMPLETED';
      return { key: String(s.key || ''), label: String(s.label || s.key || ''), isTerminal: !!s.is_terminal, isRequired: !!s.required, color: String(s.color || ''), mapsTo };
    });
  } catch {
    return [];
  }
}

function populateForm(b: TaskBoard) {
  form.name = b.name;
  form.isActive = b.isActive;
  const flags = parseFlags(b.featureFlags);
  form.geoMap = !!flags.geo_map;
  form.zenMode = !!flags.zen_mode;
  form.cycles = !!flags.cycles;
  form.cycleCarryOver = (flags as any).cycle_carry_over === 'next' ? 'next' : 'backlog';
  const integrations = parseFlags(b.integrationFlags);
  form.menuIntegration = !!integrations.menu;
  statuses.value = parseStatuses(b.statuses);
  webhookSecret.value = b.webhookSecret || '';
}

async function load() {
  loading.value = true;
  try {
    const token = await getToken();
    const { tasksBoardsList } = await import('@/api/tasks/board/list');
    const res = await tasksBoardsList(token, nsSlug.value);
    board.value = res.boards.find((b) => b.slug === boardSlug.value) || null;
    if (!board.value) {
      // Stale link (e.g. the board was renamed since, which regenerates its
      // slug) -- land somewhere real instead of an empty page.
      navigateTo(`/${nsSlug.value}/issues`);
      return;
    }
    populateForm(board.value);
    loadInstalledApps();
    loadTaskTypes();
    loadMembers();
  } catch (e) {
    logError('[issues/board-settings] load failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to load board', color: 'red' });
  } finally {
    loading.value = false;
  }
}

function addStatus() {
  statuses.value = [...statuses.value, { key: '', label: '', isTerminal: false, isRequired: false, color: '', mapsTo: '' }];
}
function insertStatusAfter(idx: number) {
  const arr = [...statuses.value];
  arr.splice(idx + 1, 0, { key: '', label: '', isTerminal: false, isRequired: false, color: '', mapsTo: '' });
  statuses.value = arr;
}
async function removeStatus(idx: number) {
  if (!(await confirm({ message: t('tasks.confirmDeleteColumn') || 'Delete this column? Issues in it will need to be moved manually.' }))) return;
  statuses.value = statuses.value.filter((_, i) => i !== idx);
}
function moveStatus(idx: number, dir: -1 | 1) {
  const target = idx + dir;
  if (target < 0 || target >= statuses.value.length) return;
  const arr = [...statuses.value];
  [arr[idx], arr[target]] = [arr[target], arr[idx]];
  statuses.value = arr;
}
function slugifyKey(label: string): string {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'status';
}

const isFormValid = computed(() => {
  return form.name.trim().length > 0 && statuses.value.length > 0 && statuses.value.every((s) => s.label.trim().length > 0);
});

type TabKey = 'general' | 'columns' | 'integrations';
const tabs = computed(() => [
  { key: 'general' as TabKey, label: t('tasks.sectionGeneral') || 'General', icon: 'lucide:layout-panel-top' },
  { key: 'columns' as TabKey, label: t('tasks.statuses') || 'Kanban columns', icon: 'lucide:columns-3' },
  { key: 'integrations' as TabKey, label: t('tasks.integrations') || 'Integrations', icon: 'lucide:plug-zap' },
]);
const activeTab = ref<TabKey>((route.query.tab as TabKey) || 'general');
watch(activeTab, (tab) => {
  navigateTo({ query: { ...route.query, tab } }, { replace: true });
});

async function handleSave() {
  if (!board.value || !isFormValid.value) return;
  const usedKeys = new Set<string>();
  const serializedStatuses = statuses.value.map((s) => {
    let key = s.key.trim() || slugifyKey(s.label);
    while (usedKeys.has(key)) key += '_2';
    usedKeys.add(key);
    return { key, label: s.label.trim(), is_terminal: s.isTerminal, required: s.isRequired, maps_to: s.mapsTo || '', color: s.color || '' };
  });
  saving.value = true;
  try {
    const token = await getToken();
    const { tasksUpdateBoard } = await import('@/api/tasks/board/update');
    board.value = await tasksUpdateBoard(token, nsSlug.value, {
      id: board.value.id,
      name: form.name.trim(),
      isActive: form.isActive,
      // Issue-closing confirmation was removed entirely (the only mode that
      // ever worked was a client-only photo gate in Zen, and it's gone too)
      // -- always send "none" since the column is unconditionally
      // overwritten on every board update regardless of what's passed.
      deliveryConfirmationMode: 'none',
      featureFlags: JSON.stringify({ geo_map: form.geoMap, zen_mode: form.zenMode, cycles: form.cycles, cycle_carry_over: form.cycleCarryOver }),
      integrationFlags: JSON.stringify({ menu: form.menuIntegration && menuAppInstalled.value }),
      statuses: JSON.stringify(serializedStatuses),
    });
    useToast().add({ title: t('tasks.boardUpdated') || 'Board updated', color: 'primary' });
    // The slug may have just changed (renaming regenerates it) -- route by
    // the fresh value from the response, not the now-possibly-stale param.
    navigateTo(`/${nsSlug.value}/issues/${board.value.slug}`);
  } catch (e) {
    logError('[issues/board-settings] save failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to save board', color: 'red' });
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="h-full flex flex-col p-4 pb-safe-or-4 min-h-0">
    <div class="flex flex-col md:flex-row md:justify-between md:items-center mb-5 flex-shrink-0 gap-3">
      <div class="text-left min-w-0">
        <h1 class="text-2xl font-semibold truncate">{{ t('tasks.boardSettings') || 'Board settings' }}</h1>
        <span class="text-sm text-gray-600 dark:text-gray-400 truncate">{{ board?.name }}</span>
      </div>
      <div class="flex items-center gap-2 self-start flex-shrink-0">
        <UButton icon="lucide:arrow-left" size="xs" color="gray" variant="soft" @click="goBack">
          {{ t('app.back') || 'Back' }}
        </UButton>
        <UButton color="primary" size="xs" icon="lucide:check" :loading="saving" :disabled="!isFormValid || saving" @click="handleSave">
          {{ t('app.save') || 'Save' }}
        </UButton>
      </div>
    </div>

    <div v-if="loading" class="flex-1 flex items-center justify-center text-gray-400">
      <UIcon name="lucide:loader-2" class="w-6 h-6 animate-spin" />
    </div>

    <template v-else>
      <div class="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-gray-200 dark:border-gray-800 mb-4 flex-shrink-0">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px"
          :class="activeTab === tab.key
            ? 'border-primary-500 text-primary-600 dark:text-primary-400'
            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'"
          @click="activeTab = tab.key"
        >
          <UIcon :name="tab.icon" class="w-4 h-4" />
          {{ tab.label }}
        </button>
      </div>

      <div class="flex-1 min-h-0 overflow-y-auto">
        <div class="max-w-2xl w-full space-y-4 pb-8">
          <template v-if="activeTab === 'general'">
            <UCard :ui="{ ring: '', body: { padding: 'p-4 sm:p-5' } }">
              <h4 class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
                <UIcon name="lucide:layout-panel-top" class="w-3.5 h-3.5" />
                {{ t('tasks.sectionGeneral') || 'General' }}
              </h4>
              <div class="space-y-3">
                <UFormGroup :label="t('tasks.boardName') || 'Name'" required>
                  <UInput v-model="form.name" size="lg" :placeholder="t('tasks.boardNamePlaceholder') || 'Delivery, Marketing, IT...'" />
                </UFormGroup>
                <label class="flex items-center gap-2 text-sm w-fit cursor-pointer">
                  <UToggle v-model="form.isActive" />
                  {{ t('tasks.isActive') || 'Active' }}
                </label>
              </div>
            </UCard>

            <UCard :ui="{ ring: '', body: { padding: 'p-4 sm:p-5' } }">
              <div class="flex items-start justify-between gap-3 mb-1">
                <h4 class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <UIcon name="lucide:tags" class="w-3.5 h-3.5" />
                  {{ t('tasks.taskTypes') || 'Issue types' }}
                </h4>
                <UButton icon="lucide:plus" size="2xs" color="gray" variant="soft" @click="openCreateTaskType">
                  {{ t('tasks.addTaskType') || 'Add issue type' }}
                </UButton>
              </div>
              <p class="text-xs text-gray-400 mb-3">{{ t('tasks.taskTypesHint') || 'Categories for issues on this board, each with its own icon, color and optional SLA.' }}</p>

              <p v-if="!taskTypes.length" class="text-sm text-gray-400 text-center py-6">{{ t('tasks.noTaskTypes') || 'No issue types yet' }}</p>
              <div v-else class="space-y-2">
                <div
                  v-for="tt in taskTypes"
                  :key="tt.id"
                  class="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-800 p-2.5"
                >
                  <span class="flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0" :style="{ backgroundColor: tt.color || '#9ca3af' }">
                    <UIcon :name="tt.icon || 'lucide:shapes'" class="w-4 h-4 text-white" />
                  </span>
                  <div class="min-w-0 flex-1">
                    <div class="font-medium text-sm truncate">{{ tt.name }}</div>
                    <div class="text-xs text-gray-400 flex items-center gap-2">
                      <span v-if="tt.requiresLocation" class="inline-flex items-center gap-1"><UIcon name="lucide:map-pin" class="w-3 h-3" />{{ t('tasks.requiresLocationShort') || 'Location' }}</span>
                      <span v-if="tt.slaMinutes" class="inline-flex items-center gap-1"><UIcon name="lucide:timer" class="w-3 h-3" />{{ tt.slaMinutes }} {{ t('tasks.minutesShort') || 'min' }}</span>
                    </div>
                  </div>
                  <UButton icon="lucide:pencil" size="2xs" color="gray" variant="ghost" @click="openEditTaskType(tt)" />
                  <UButton icon="lucide:trash-2" size="2xs" color="red" variant="ghost" :disabled="taskTypes.length <= 1" :title="taskTypes.length <= 1 ? (t('tasks.cannotDeleteLastTaskType') || 'A board needs at least one issue type') : undefined" @click="handleDeleteTaskType(tt)" />
                </div>
              </div>
            </UCard>

            <h4 class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 pt-1">
              <UIcon name="lucide:puzzle" class="w-3.5 h-3.5" />
              {{ t('tasks.featureFlags') || 'Modules' }}
            </h4>

            <UCard :ui="{ ring: '', body: { padding: 'p-4 sm:p-5' } }">
              <label class="flex items-start gap-3 cursor-pointer">
                <UToggle v-model="form.geoMap" size="sm" class="mt-0.5" />
                <span>
                  <span class="flex items-center gap-1.5 text-sm font-medium"><UIcon name="lucide:map-pin" class="w-4 h-4 text-gray-400" />{{ t('tasks.flagGeoMap') || 'Map & location' }}</span>
                  <span class="block text-xs text-gray-400 mt-0.5">{{ t('tasks.flagGeoMapDesc') || 'Shows an address and map-pin field when creating an issue, so its location is captured up front.' }}</span>
                </span>
              </label>
            </UCard>

            <UCard :ui="{ ring: '', body: { padding: 'p-4 sm:p-5' } }">
              <label class="flex items-start gap-3 cursor-pointer">
                <UToggle v-model="form.zenMode" size="sm" class="mt-0.5" />
                <span>
                  <span class="flex items-center gap-1.5 text-sm font-medium"><UIcon name="lucide:smartphone" class="w-4 h-4 text-gray-400" />{{ t('tasks.flagZenMode') || 'Zen Mode (courier PWA)' }}</span>
                  <span class="block text-xs text-gray-400 mt-0.5">{{ t('tasks.flagZenModeDesc') || 'Includes this board\'s issues in the installable "My issues" mobile view for whoever is assigned to them.' }}</span>
                </span>
              </label>
            </UCard>

            <UCard :ui="{ ring: '', body: { padding: 'p-4 sm:p-5' } }">
              <label class="flex items-start gap-3 cursor-pointer">
                <UToggle v-model="form.cycles" size="sm" class="mt-0.5" />
                <span>
                  <span class="flex items-center gap-1.5 text-sm font-medium"><UIcon name="lucide:repeat" class="w-4 h-4 text-gray-400" />{{ t('tasks.flagCycles') || 'Sprints' }}</span>
                  <span class="block text-xs text-gray-400 mt-0.5">{{ t('tasks.flagCyclesDesc') || 'Group issues into time-boxed sprints on the board, with a backlog for unassigned issues.' }}</span>
                </span>
              </label>
            </UCard>
          </template>

          <UCard v-else-if="activeTab === 'columns'" :ui="{ ring: '', body: { padding: 'p-4 sm:p-5' } }">
            <h4 class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">
              <UIcon name="lucide:columns-3" class="w-3.5 h-3.5" />
              {{ t('tasks.statuses') || 'Kanban columns' }}
            </h4>
            <p class="text-xs text-gray-400 mb-3">{{ t('tasks.statusesHint') || 'Mark the final column as terminal so closed issues are tracked correctly' }}</p>
            <div class="space-y-2">
              <div v-for="(s, idx) in statuses" :key="idx" class="flex items-center gap-2 rounded-lg border border-gray-100 dark:border-gray-800 p-2 overflow-x-auto">
                <div class="flex flex-col flex-shrink-0">
                  <UButton icon="lucide:chevron-up" size="2xs" color="gray" variant="ghost" :disabled="idx === 0" :title="t('tasks.moveColumnUp') || 'Move left'" @click="moveStatus(idx, -1)" />
                  <UButton icon="lucide:chevron-down" size="2xs" color="gray" variant="ghost" :disabled="idx === statuses.length - 1" :title="t('tasks.moveColumnDown') || 'Move right'" @click="moveStatus(idx, 1)" />
                </div>
                <div class="flex items-center gap-1 flex-shrink-0">
                  <button
                    v-for="preset in COLUMN_COLOR_PRESETS"
                    :key="preset.name"
                    type="button"
                    class="h-5 w-5 rounded-full flex-shrink-0 ring-offset-1 ring-offset-white dark:ring-offset-gray-900"
                    :class="[preset.dotClass, s.color === preset.value && 'ring-2 ring-primary-500']"
                    :title="preset.name"
                    @click="s.color = preset.value"
                  />
                </div>
                <UInput v-model="s.label" size="sm" class="flex-1 min-w-[140px]" :placeholder="t('tasks.statusLabelPlaceholder') || 'Column name'" />
                <label class="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 select-none cursor-pointer">
                  <UCheckbox v-model="s.isTerminal" />
                  {{ t('tasks.statusTerminal') || 'Terminal' }}
                </label>
                <label v-if="!s.isTerminal" class="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 select-none cursor-pointer" :title="t('tasks.statusRequiredHint') || 'Issues must pass through this column before they can be closed'">
                  <UCheckbox v-model="s.isRequired" />
                  {{ t('tasks.statusRequired') || 'Required' }}
                </label>
                <USelectMenu
                  v-if="menuIntegrationEnabled"
                  v-model="s.mapsTo"
                  :options="ORDER_STATUS_OPTIONS"
                  value-attribute="value"
                  option-attribute="label"
                  size="sm"
                  class="w-36 flex-shrink-0"
                  :popper="{ strategy: 'fixed' }"
                  :title="t('tasks.statusMapsToHint') || 'When an issue enters this column, set the linked Menu order to this status'"
                >
                  <template #label>
                    <span class="truncate">{{ ORDER_STATUS_OPTIONS.find((o) => o.value === s.mapsTo)?.label || (t('tasks.statusMapsTo') || 'Order status') }}</span>
                  </template>
                </USelectMenu>
                <UButton icon="lucide:plus" size="2xs" color="gray" variant="ghost" class="flex-shrink-0" :title="t('tasks.insertColumnAfter') || 'Insert column here'" @click="insertStatusAfter(idx)" />
                <UButton icon="lucide:x" size="2xs" color="gray" variant="ghost" class="flex-shrink-0" :disabled="statuses.length <= 1" @click="removeStatus(idx)" />
              </div>
              <UButton icon="lucide:plus" size="xs" color="gray" variant="soft" @click="addStatus">
                {{ t('tasks.addStatus') || 'Add column' }}
              </UButton>
            </div>
          </UCard>

          <template v-else-if="activeTab === 'integrations'">
            <UCard :ui="{ ring: '', body: { padding: 'p-4 sm:p-5' } }">
              <label class="flex items-start gap-3 cursor-pointer" :class="!menuAppInstalled && 'opacity-50'">
                <UToggle v-model="form.menuIntegration" size="sm" class="mt-0.5" :disabled="!menuAppInstalled" />
                <span>
                  <span class="flex items-center gap-1.5 text-sm font-medium"><UIcon name="lucide:shopping-cart" class="w-4 h-4 text-gray-400" />{{ t('tasks.flagMenuIntegrationTitle') || 'Orders integration' }}</span>
                  <span class="block text-xs text-gray-400 mt-0.5">{{ t('tasks.flagMenuIntegration') || 'Create an issue automatically from ready Menu orders' }}</span>
                </span>
              </label>
              <p v-if="!menuAppInstalled" class="text-xs text-gray-400 mt-2">
                {{ t('tasks.menuNotInstalled') || 'lota Orders is not installed in this namespace' }}
              </p>
            </UCard>

            <UCard v-if="menuIntegrationEnabled" :ui="{ ring: '', body: { padding: 'p-4 sm:p-5' } }">
              <div class="flex items-start justify-between gap-3">
                <span>
                  <span class="flex items-center gap-1.5 text-sm font-medium"><UIcon name="lucide:zap" class="w-4 h-4 text-gray-400" />{{ t('tasks.automations') || 'Automations' }}</span>
                  <span class="block text-xs text-gray-400 mt-0.5">{{ t('tasks.automationsHint') || 'Automatically update the linked Menu order when an issue reaches a final column.' }}</span>
                </span>
                <UButton icon="lucide:zap" size="2xs" color="gray" variant="soft" class="flex-shrink-0" @click="isAutomationsOpen = true">
                  {{ t('tasks.manageAutomations') || 'Manage' }}
                </UButton>
              </div>
            </UCard>

            <UCard :ui="{ ring: '', body: { padding: 'p-4 sm:p-5' } }">
              <h4 class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">
                <UIcon name="lucide:webhook" class="w-3.5 h-3.5" />
                {{ t('tasks.webhookApi') || 'Webhook API' }}
              </h4>
              <p class="text-xs text-gray-400 mb-3">{{ t('tasks.webhookApiHint') || 'Create issues on this board from external systems using an HMAC-signed request' }}</p>
              <div class="space-y-2">
                <div class="flex items-center gap-2">
                  <UInput :model-value="webhookUrl" readonly size="sm" class="flex-1 font-mono text-xs" />
                  <UButton icon="lucide:copy" size="2xs" color="gray" variant="ghost" @click="copyToClipboard(webhookUrl, 'tasks.webhookCopied', 'Copied to clipboard')" />
                </div>
                <div class="flex items-center gap-2">
                  <UInput :model-value="webhookSecret" readonly size="sm" type="password" class="flex-1 font-mono text-xs" />
                  <UButton icon="lucide:copy" size="2xs" color="gray" variant="ghost" @click="copyToClipboard(webhookSecret, 'tasks.webhookCopied', 'Copied to clipboard')" />
                  <UButton
                    icon="lucide:refresh-cw"
                    size="2xs"
                    color="gray"
                    variant="soft"
                    :loading="regeneratingWebhook"
                    @click="regenerateWebhookSecret"
                  >
                    {{ t('tasks.webhookRegenerate') || 'Regenerate' }}
                  </UButton>
                </div>
              </div>
            </UCard>
          </template>
        </div>
      </div>
    </template>

    <TaskTypeModal
      v-model="isTaskTypeModalOpen"
      :task-type="editingTaskType"
      :member-options="memberOptions"
      :saving="savingTaskType"
      @submit="handleTaskTypeSubmit"
    />
    <AutomationRulesManager
      v-if="board"
      v-model="isAutomationsOpen"
      :board-id="board.id"
      :ns-slug="nsSlug"
      :trigger-options="automationTriggerOptions"
    />
  </div>
</template>
