<script lang="ts" setup>
import AppSkeleton from '@/components/ui/AppSkeleton.vue';
import UserAvatar from '@/components/ui/UserAvatar.vue';
definePageMeta({ layout: 'workspace' });

import { useI18n } from '@/composables/useI18n';
import { useTasksToken } from '@/composables/useTasksToken';
import { useTasksStaffRole } from '@/composables/useTasksStaffRole';
import { useNamespace } from '@/composables/useNamespace';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import { dynamicLS } from '@/utils/storageKeys';
import { taskShortCode, priorityIcon, priorityColorClass, columnColorClass, blockingRequiredStatuses } from '@/utils/taskDisplay';
import { usePwaInstall } from '@/composables/usePwaInstall';
import { stripMarkdownPreview } from '@/utils/renderMarkdown';
import { maskProfanity } from '@/utils/profanityFilter';
import { useOnboarding } from '@/composables/useOnboarding';
import { issuesTour } from '@/config/tours';
import TaskModal from '@/components/tasks/TaskModal.vue';
import TaskDetailSlideover from '@/components/tasks/TaskDetailSlideover.vue';
import ReasonModal from '@/components/tasks/ReasonModal.vue';
import OpenOnPhoneModal from '@/components/tasks/OpenOnPhoneModal.vue';
import CycleModal from '@/components/tasks/CycleModal.vue';
import CloseCycleModal from '@/components/tasks/CloseCycleModal.vue';
import BurndownModal from '@/components/tasks/BurndownModal.vue';
import BoardFilters from '@/components/tasks/BoardFilters.vue';
// Shape of a @nuxt/ui dropdown entry (the module does not export a resolvable type path here).
interface DropdownItem { label: string; icon?: string; to?: string; class?: string; disabled?: boolean; slot?: string; click?: (...args: any[]) => void }
import type { TaskBoard } from '@/api/tasks/board/list';
import type { TaskType } from '@/api/tasks/tasktype/list';
import type { TaskItem } from '@/api/tasks/task/list';
import { parseTaskTemplates, templateDueAt, type TaskTemplate } from '@/utils/taskTemplates';
import type { Cycle } from '@/api/tasks/cycle/list';
import { usePageTitle } from '@/composables/usePageTitle';

interface StatusRow { key: string; label: string; isTerminal: boolean; isRequired: boolean; color: string; askReason: boolean }

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const boardSlug = computed(() => route.params.boardSlug as string);
const { isOwnerOrManager } = useTasksStaffRole();
const { user: currentUser, token: hubToken } = useAuth();
const { titleBySlug } = useNamespace();

async function getToken(): Promise<string> {
  const { current } = useTasksToken();
  const token = current();
  if (!token) throw new Error('No tasks token');
  return token;
}

const board = ref<TaskBoard | null>(null);
usePageTitle('issues', { subject: () => board.value?.name });
// The real DB id -- every gRPC/GraphQL call downstream still identifies the
// board by id, only the URL uses the human-friendly slug.
const boardId = computed(() => board.value?.id || '');
const boardStatuses = computed<StatusRow[]>(() => {
  try {
    const arr = board.value?.statuses ? JSON.parse(board.value.statuses) : [];
    return Array.isArray(arr) ? arr.map((s: any) => ({ key: s.key, label: s.label || s.key, isTerminal: !!s.is_terminal, isRequired: !!s.required, color: String(s.color || ''), askReason: !!s.ask_reason })) : [];
  } catch {
    return [];
  }
});

const geoMapEnabled = computed(() => {
  try {
    return !!(board.value?.featureFlags ? JSON.parse(board.value.featureFlags).geo_map : false);
  } catch {
    return false;
  }
});
const zenModeEnabled = computed(() => {
  try {
    return !!(board.value?.featureFlags ? JSON.parse(board.value.featureFlags).zen_mode : false);
  } catch {
    return false;
  }
});
const requireHandoffAccept = computed(() => {
  try {
    return !!(board.value?.featureFlags ? JSON.parse(board.value.featureFlags).handoff_accept : false);
  } catch {
    return false;
  }
});

const cyclesEnabled = computed(() => {
  try {
    return !!(board.value?.featureFlags ? JSON.parse(board.value.featureFlags).cycles : false);
  } catch {
    return false;
  }
});
const deliveryMoneyEnabled = computed(() => {
  try {
    return !!(board.value?.featureFlags ? JSON.parse(board.value.featureFlags).delivery_money : false);
  } catch {
    return false;
  }
});
const menuIntegrationEnabled = computed(() => {
  try {
    return !!(board.value?.integrationFlags ? JSON.parse(board.value.integrationFlags).menu : false);
  } catch {
    return false;
  }
});
const contactsIntegrationEnabled = computed(() => {
  try {
    return !!(board.value?.integrationFlags ? JSON.parse(board.value.integrationFlags).contacts : false);
  } catch {
    return false;
  }
});
// A board is "funnel-shaped" once any terminal column is marked won/lost --
// that's what turns on the deal-amount field and the funnel analytics view.
const funnelEnabled = computed(() => {
  try {
    const arr = board.value?.statuses ? JSON.parse(board.value.statuses) : [];
    return Array.isArray(arr) && arr.some((s: any) => s.outcome === 'won' || s.outcome === 'lost');
  } catch {
    return false;
  }
});

// Sprints: once the module is on, the sprint bar is just always part of the
// board (no separate "Sprints" mode to switch into) -- narrows tasks down to
// one sprint (or the backlog) at a time.
const cycles = ref<Cycle[]>([]);
const selectedCycleId = ref(''); // '' = Backlog
const openCycles = computed(() => cycles.value
  .filter((c) => !c.isClosed)
  .sort((a, b) => (a.startsAt || '9999').localeCompare(b.startsAt || '9999') || a.createdAt.localeCompare(b.createdAt)));
const selectedCycle = computed(() => cycles.value.find((c) => c.id === selectedCycleId.value) || null);
// Closed sprints drop out of the switcher entirely -- once closed there's
// nothing left to do with them here, only the board's default "everything"
// view still shows their carried-over/already-closed issues.
const cycleSelectOptions = computed(() => [
  { label: t('tasks.backlog') || 'Backlog', value: '' },
  ...openCycles.value.map((c) => ({ label: c.name, value: c.id })),
]);

function rememberedCycleId(): string {
  if (!process.client || !boardId.value) return '';
  try {
    return localStorage.getItem(dynamicLS.tasksSelectedCycleId(boardId.value)) || '';
  } catch {
    return '';
  }
}
watch(selectedCycleId, (id) => {
  if (!process.client || !boardId.value) return;
  try {
    localStorage.setItem(dynamicLS.tasksSelectedCycleId(boardId.value), id);
  } catch {
    // ignore
  }
});

async function loadCycles() {
  if (!boardId.value) return;
  try {
    const token = await getToken();
    const { tasksCyclesList } = await import('@/api/tasks/cycle/list');
    const res = await tasksCyclesList(token, nsSlug.value, boardId.value);
    cycles.value = res.cycles;
    if (selectedCycleId.value && !cycles.value.some((c) => c.id === selectedCycleId.value)) {
      selectedCycleId.value = '';
    }
    if (!selectedCycleId.value) {
      const remembered = rememberedCycleId();
      if (remembered && cycles.value.some((c) => c.id === remembered && !c.isClosed)) {
        selectedCycleId.value = remembered;
      }
    }
  } catch (e) {
    logError('[tasks/board] loadCycles failed', e);
  }
}
const sprintMenuItems = computed(() => {
  const groups: DropdownItem[][] = [[
    { label: t('tasks.backlog') || 'Backlog', click: () => { selectedCycleId.value = ''; } },
    ...openCycles.value.map((c) => ({ label: c.name, click: () => { selectedCycleId.value = c.id; } })),
  ]];
  const manage: DropdownItem[] = [{ label: t('tasks.newSprint') || 'New sprint', icon: 'lucide:plus', click: openCreateCycle }];
  if (selectedCycle.value) {
    manage.push({ label: t('tasks.editSprint') || 'Edit sprint', icon: 'lucide:pencil', click: openEditCycle });
    if (!selectedCycle.value.isClosed) manage.push({ label: t('tasks.closeSprint') || 'Close sprint', icon: 'lucide:flag-off', click: openCloseCycleDialog });
    manage.push({ label: t('tasks.burndown') || 'Burndown', icon: 'lucide:trending-down', click: () => { isBurndownModalOpen.value = true; } });
  }
  groups.push(manage);
  return groups;
});

const isCycleModalOpen = ref(false);
const editingCycle = ref<Cycle | null>(null);
const savingCycle = ref(false);
function openCreateCycle() {
  editingCycle.value = null;
  isCycleModalOpen.value = true;
}
function openEditCycle() {
  if (!selectedCycle.value) return;
  editingCycle.value = selectedCycle.value;
  isCycleModalOpen.value = true;
}
async function handleCycleSubmit(payload: { name: string; startsAt?: string; endsAt?: string }) {
  savingCycle.value = true;
  try {
    const token = await getToken();
    if (editingCycle.value) {
      const { tasksUpdateCycle } = await import('@/api/tasks/cycle/update');
      const updated = await tasksUpdateCycle(token, nsSlug.value, { id: editingCycle.value.id, ...payload });
      const idx = cycles.value.findIndex((c) => c.id === updated.id);
      if (idx !== -1) cycles.value[idx] = updated;
    } else {
      const { tasksCreateCycle } = await import('@/api/tasks/cycle/create');
      const created = await tasksCreateCycle(token, nsSlug.value, { boardId: boardId.value, ...payload });
      cycles.value = [...cycles.value, created];
      selectedCycleId.value = created.id;
    }
    isCycleModalOpen.value = false;
  } catch (e) {
    logError('[tasks/board] cycle save failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to save sprint', color: 'red' });
  } finally {
    savingCycle.value = false;
  }
}
// The carry-over rule is chosen fresh in the close-sprint dialog rather than
// buried in board settings -- it's a decision that only matters at the
// moment you're actually closing a sprint. Whatever's picked here is also
// saved back onto the board's flags so it's pre-selected as the default
// next time.
function parseFeatureFlags(): Record<string, any> {
  try {
    return board.value?.featureFlags ? JSON.parse(board.value.featureFlags) : {};
  } catch {
    return {};
  }
}
async function patchBoardFlags(patch: Record<string, any>) {
  if (!board.value) return;
  const token = await getToken();
  const { tasksUpdateBoard } = await import('@/api/tasks/board/update');
  board.value = await tasksUpdateBoard(token, nsSlug.value, {
    id: board.value.id,
    name: board.value.name,
    isActive: board.value.isActive,
    deliveryConfirmationMode: board.value.deliveryConfirmationMode,
    featureFlags: JSON.stringify({ ...parseFeatureFlags(), ...patch }),
  });
}

const isBurndownModalOpen = ref(false);
const isCloseCycleModalOpen = ref(false);
const closingCycle = ref(false);
const closeCycleCarryOverDefault = computed<'backlog' | 'next'>(() => (parseFeatureFlags().cycle_carry_over === 'next' ? 'next' : 'backlog'));
function openCloseCycleDialog() {
  if (!selectedCycle.value) return;
  isCloseCycleModalOpen.value = true;
}
async function handleCloseCycleConfirm(carryOver: 'backlog' | 'next') {
  if (!selectedCycle.value) return;
  closingCycle.value = true;
  try {
    await patchBoardFlags({ cycle_carry_over: carryOver });
    const token = await getToken();
    const { tasksCloseCycle } = await import('@/api/tasks/cycle/update');
    const closed = await tasksCloseCycle(token, nsSlug.value, selectedCycle.value.id);
    const idx = cycles.value.findIndex((c) => c.id === closed.id);
    if (idx !== -1) cycles.value[idx] = closed;
    selectedCycleId.value = '';
    isCloseCycleModalOpen.value = false;
    loadTasks({ silent: true });
  } catch (e) {
    logError('[tasks/board] cycle close failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to close sprint', color: 'red' });
  } finally {
    closingCycle.value = false;
  }
}

// Zen Mode is a phone-only PWA -- clicking the link from a desktop browser
// can't usefully "open" it, so offer a QR code to grab it on a phone
// instead of just navigating a desktop tab nowhere useful.
const { platform } = usePwaInstall();
const isOpenZenQrModalOpen = ref(false);
const zenModeUrl = computed(() => typeof window === 'undefined' ? '' : `${window.location.origin}/${nsSlug.value}/issues/zen`);
function openZen() {
  if (platform.value === 'desktop') {
    isOpenZenQrModalOpen.value = true;
  } else {
    window.open(`/${nsSlug.value}/issues/zen`, '_blank');
  }
}

async function loadBoard() {
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
    if (process.client) {
      localStorage.setItem(dynamicLS.tasksSelectedBoardSlug(nsSlug.value), board.value.slug);
    }
  } catch (e) {
    logError('[tasks/board] loadBoard failed', e);
  }
}

function firstLine(text?: string | null): string {
  if (!text) return '';
  const line = text.split('\n').find((l) => l.trim().length > 0)?.trim() || '';
  return maskProfanity(stripMarkdownPreview(line));
}
function formatDueDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  } catch {
    return iso;
  }
}

const taskTypes = ref<TaskType[]>([]);
async function loadTaskTypes() {
  if (!boardId.value) return;
  try {
    const token = await getToken();
    const { tasksTaskTypesList } = await import('@/api/tasks/tasktype/list');
    const res = await tasksTaskTypesList(token, nsSlug.value, boardId.value);
    taskTypes.value = res.taskTypes;
  } catch (e) {
    logError('[tasks/board] loadTaskTypes failed', e);
  }
}

// Namespace members who actually have an Issues role -- assigning a task to
// someone who's never been granted access here would just be a dead end.
const memberOptions = ref<{ label: string; value: string }[]>([]);
async function loadMembers() {
  try {
    if (!hubToken.value) return;
    const token = await getToken();
    const { loadIssuesStaffMemberOptions } = await import('@/utils/issuesMembers');
    memberOptions.value = await loadIssuesStaffMemberOptions(hubToken.value, token, nsSlug.value);
  } catch (e) {
    logError('[tasks/board] loadMembers failed', e);
  }
}

const tasks = ref<TaskItem[]>([]);
const statusCounts = ref<Record<string, number>>({});
const loading = ref(false);
const error = ref<string | null>(null);
const search = ref('');
const selectedTaskTypeIds = ref<string[]>([]);
const selectedAssignee = ref('');
// "My tasks" (assignee OR watcher) is a broader, one-click alternative to
// picking yourself in the assignee dropdown -- mutually exclusive with it,
// since combining both would just be confusing.
const myTasksOnly = ref(false);
watch(myTasksOnly, (v) => { if (v) selectedAssignee.value = ''; });
watch(selectedAssignee, (v) => { if (v) myTasksOnly.value = false; });

let searchDebounce: ReturnType<typeof setTimeout> | null = null;

async function loadTasks(opts: { silent?: boolean } = {}) {
  if (!boardId.value) return;
  if (!opts.silent) loading.value = true;
  error.value = null;
  try {
    const token = await getToken();
    const { tasksBundle } = await import('@/api/tasks/task/list');
    const res = await tasksBundle(token, nsSlug.value, {
      boardIds: [boardId.value],
      taskTypeIds: selectedTaskTypeIds.value.length ? selectedTaskTypeIds.value : undefined,
      assigneeUserId: selectedAssignee.value || undefined,
      participantUserId: myTasksOnly.value ? currentUser.value?.id : undefined,
      search: search.value.trim() || undefined,
      // Sprints off entirely: no cycle filtering at all. Sprints on: narrows
      // to the one selected sprint (or the backlog).
      cycleId: cyclesEnabled.value && selectedCycleId.value ? selectedCycleId.value : undefined,
      backlogOnly: cyclesEnabled.value && !selectedCycleId.value ? true : undefined,
    }, { length: 'ONE_HUNDRED' });
    tasks.value = res.tasks;
    statusCounts.value = res.statusCounts;
  } catch (e) {
    logError('[tasks/board] loadTasks failed', e);
    if (!opts.silent) error.value = getErrorMessage(e, t) || 'Failed to load issues';
  } finally {
    if (!opts.silent) loading.value = false;
  }
}

// Quick views over the loaded tasks (client-side, no extra requests).
type QuickView = '' | 'overdue' | 'noDue' | 'problem' | 'urgent' | 'newWeek';
const quickView = ref<QuickView>('');
const QUICK_VIEWS: { key: QuickView; label: string; icon: string }[] = [
  { key: 'overdue', label: 'tasks.viewOverdue', icon: 'lucide:alarm-clock' },
  { key: 'noDue', label: 'tasks.viewNoDue', icon: 'lucide:infinity' },
  { key: 'problem', label: 'tasks.viewProblem', icon: 'lucide:triangle-alert' },
  { key: 'urgent', label: 'tasks.viewUrgent', icon: 'lucide:chevrons-up' },
  { key: 'newWeek', label: 'tasks.viewNewWeek', icon: 'lucide:calendar-days' },
];
function matchesQuickView(task: TaskItem): boolean {
  if (!quickView.value) return true;
  const terminal = !!boardStatuses.value.find((s) => s.key === task.status)?.isTerminal;
  if (quickView.value === 'problem') return !!task.problemReportedAt && !terminal;
  if (quickView.value === 'newWeek') return Date.now() - new Date(task.createdAt).getTime() < 7 * 86400000;
  if (terminal) return false;
  if (quickView.value === 'urgent') return task.priority >= 3;
  if (quickView.value === 'noDue') return !task.dueAt;
  return (!!task.dueAt && new Date(task.dueAt).getTime() < Date.now()) || isTaskOverdue(task);
}
// Subtasks live inside their parent's card, they are not board cards of their own.
const visibleTasks = computed(() => tasks.value.filter((tk) => !tk.parentId && matchesQuickView(tk)));
// The server's per-status counts include subtasks; take the loaded ones out so the column badge matches the cards.
function columnCount(status: string): number {
  const subtasks = tasks.value.filter((tk) => tk.parentId && tk.status === status).length;
  return Math.max(0, (statusCounts.value[status] ?? 0) - subtasks);
}
// How many open tasks on this board are mine (assignee), shown on the "My tasks" button.
const myOpenCount = computed(() => {
  const me = currentUser.value?.id;
  if (!me) return 0;
  return tasks.value.filter((tk) => tk.assigneeUserId === me && !boardStatuses.value.find((s) => s.key === tk.status)?.isTerminal).length;
});

async function exportTasks() {
  const XLSX = await import('xlsx');
  const statusName = (key: string) => boardStatuses.value.find((s) => s.key === key)?.label || key;
  const typeName = (id: string) => taskTypes.value.find((tt) => tt.id === id)?.name || '';
  const who = (id?: string | null) => (id ? memberOptions.value.find((m) => m.value === id)?.label || '' : '');
  const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString() : '');
  const data = visibleTasks.value.map((tk) => ({
    '#': tk.taskNumber,
    [t('tasks.taskTitle') || 'Title']: tk.title,
    [t('tasks.status') || 'Status']: statusName(tk.status),
    [t('tasks.type') || 'Type']: typeName(tk.taskTypeId),
    [t('tasks.assignee') || 'Assignee']: who(tk.assigneeUserId),
    [t('tasks.dueAt') || 'Due']: fmt(tk.dueAt),
    [t('tasks.created') || 'Created']: fmt(tk.createdAt),
    [t('tasks.closed') || 'Closed']: fmt(tk.closedAt),
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'tasks');
  XLSX.writeFile(wb, `tasks-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

const tasksByColumn = computed(() => {
  const map: Record<string, TaskItem[]> = {};
  for (const s of boardStatuses.value) map[s.key] = [];
  for (const task of visibleTasks.value) {
    if (!map[task.status]) map[task.status] = [];
    map[task.status].push(task);
  }
  // Manual drag order within each column, not fetch/creation order -- lets a
  // dispatcher arrange issues into a route sequence.
  for (const key of Object.keys(map)) map[key].sort((a, b) => a.sortOrder - b.sortOrder);
  return map;
});

// SLA overdue is computed entirely client-side from taskType.slaMinutes vs.
// createdAt — no backend field, no cron (plan §10, item 9). `now` ticks so a
// card crosses into "overdue" without needing a reload.
const now = ref(Date.now());
let nowTimer: ReturnType<typeof setInterval> | null = null;
function isTaskOverdue(task: TaskItem): boolean {
  const status = boardStatuses.value.find((s) => s.key === task.status);
  if (status?.isTerminal) return false;
  const taskType = taskTypes.value.find((tt) => tt.id === task.taskTypeId);
  if (!taskType?.slaMinutes) return false;
  const deadline = new Date(task.createdAt).getTime() + taskType.slaMinutes * 60000;
  return now.value > deadline;
}

watch(search, () => {
  if (searchDebounce) clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => loadTasks(), 400);
});
watch([selectedTaskTypeIds, selectedAssignee, myTasksOnly], () => loadTasks());
watch(selectedCycleId, () => loadTasks());

// Live updates: a board-scoped GraphQL subscription (taskChanged) tells
// every connected browser exactly when a task on this board changed, so
// refetches fire on real activity instead of a fixed timer. loadTasks
// replaces the `tasks` array wholesale but never touches `selectedTask`
// directly, so a background refresh can't clobber text someone is mid-typing
// in the open detail slideover -- if the event is for the task currently
// open, the fresh copy is staged in `pendingTaskUpdate` and offered via a
// banner instead of being applied silently.
const pendingTaskUpdate = ref<TaskItem | null>(null);
let disposeTaskSubscription: (() => void) | null = null;
let taskChangedDebounce: ReturnType<typeof setTimeout> | null = null;
function onTaskChangedEvent(event: { taskId: string; changedBy?: string | null }) {
  if (taskChangedDebounce) clearTimeout(taskChangedDebounce);
  // Collapse bursts (e.g. several fields saved back to back) into one refetch.
  taskChangedDebounce = setTimeout(async () => {
    await loadTasks({ silent: true });
    if (isDetailOpen.value && selectedTask.value?.id === event.taskId && event.changedBy !== currentUser.value?.id) {
      pendingTaskUpdate.value = tasks.value.find((tsk) => tsk.id === event.taskId) || null;
    }
  }, 300);
}
async function startTaskSubscription() {
  if (!boardId.value) return;
  try {
    const token = await getToken();
    const { subscribeTaskChanged } = await import('@/api/tasks/subscriptions');
    disposeTaskSubscription = subscribeTaskChanged(token, nsSlug.value, boardId.value, onTaskChangedEvent, (e) => {
      logError('[tasks/board] task subscription error', e);
    });
  } catch (e) {
    logError('[tasks/board] startTaskSubscription failed', e);
  }
}

// Safety-net fallback poll, in case the WebSocket silently drops -- much
// slower than before since the subscription is now the primary mechanism.
let pollTimer: ReturnType<typeof setInterval> | null = null;
function pollTick() {
  if (document.hidden) return;
  loadTasks({ silent: true });
}

onMounted(async () => {
  loading.value = true;
  // loadBoard resolves boardId (from the route's slug) before anything that
  // depends on it can run.
  await Promise.all([loadBoard(), loadMembers()]);
  await Promise.all([loadTaskTypes(), loadTasks(), cyclesEnabled.value ? loadCycles() : Promise.resolve()]);
  loading.value = false;
  const initialTaskCode = route.query.task;
  if (typeof initialTaskCode === 'string') openTaskByCode(initialTaskCode);
  startTaskSubscription();
  pollTimer = setInterval(pollTick, 45000);
  nowTimer = setInterval(() => { now.value = Date.now(); }, 30000);
  if (process.client) {
    const { isCompleted, startTour } = useOnboarding();
    if (tasks.value.length === 0 && !isCompleted(issuesTour.id)) {
      setTimeout(() => startTour(issuesTour), 1000);
    }
  }
});
onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer);
  if (nowTimer) clearInterval(nowTimer);
  if (searchDebounce) clearTimeout(searchDebounce);
  if (taskChangedDebounce) clearTimeout(taskChangedDebounce);
  disposeTaskSubscription?.();
});

// Create task modal — editing an existing one happens inline in
// TaskDetailSlideover instead (see openDetail below), so this is
// create-only now.
const isTaskModalOpen = ref(false);
const savingTask = ref(false);
function openCreateTask() {
  isTaskModalOpen.value = true;
}
// New issues created while a specific sprint is selected land in that
// sprint; otherwise (Board view, or Backlog selected) they're unassigned.
const defaultCycleIdForNewTask = computed(() => (cyclesEnabled.value && selectedCycleId.value) || undefined);

async function handleTaskSubmit(payload: Record<string, any>) {
  savingTask.value = true;
  try {
    const token = await getToken();
    const { tasksCreateTask } = await import('@/api/tasks/task/create');
    const created = await tasksCreateTask(token, nsSlug.value, { boardId: boardId.value, cycleId: defaultCycleIdForNewTask.value, ...payload } as any);
    tasks.value = [...tasks.value, created];
    useAnalytics().track('issues_task_created', { source: 'modal' });
    isTaskModalOpen.value = false;
    loadTasks({ silent: true });
  } catch (e) {
    logError('[tasks/board] task save failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to save issue', color: 'red' });
  } finally {
    savingTask.value = false;
  }
}

// Quick-add: the first column's pinned button skips the full modal
// entirely -- a title is all that's needed, so an inline input right in
// the column (Trello-style) is faster than a round trip through a dialog.
// Uses the board's designated default issue type (or the first one) and
// drops the task straight into the first column's status.
const quickAddOpen = ref(false);
const quickAddTitle = ref('');
const quickAddSaving = ref(false);
function openQuickAdd() {
  quickAddTitle.value = '';
  quickAddOpen.value = true;
}
function cancelQuickAdd() {
  quickAddOpen.value = false;
  quickAddTitle.value = '';
}
// --- Create from a template: one click, the template fills title, text,
// priority and deadline ---
const taskTemplates = computed(() => parseTaskTemplates(board.value?.taskTemplates));
const templateMenuItems = computed(() => [taskTemplates.value.map((tpl) => ({ label: tpl.name, icon: 'lucide:file-plus-2', click: () => createFromTemplate(tpl) }))]);

// Secondary tools live behind one "more" menu so the header keeps a single primary action
// (DESIGN.md §U3.1, §U18): board views, Zen mode, export and "create from template".
const moreMenuItems = computed(() => {
  const base = `/${nsSlug.value}/issues/${boardSlug.value}`;
  const groups: DropdownItem[][] = [];
  const views: DropdownItem[] = [];
  if (geoMapEnabled.value) views.push({ label: t('tasks.mapView') || 'Map view', icon: 'lucide:map', to: `${base}/map` });
  if (isOwnerOrManager.value) {
    views.push({ label: t('tasks.reportOpen'), icon: 'lucide:clipboard-list', to: `${base}/report` });
    views.push({ label: t('tasks.funnelAnalyticsBtn') || 'Analytics', icon: 'lucide:chart-no-axes-column', to: `${base}/analytics` });
  }
  if (views.length) groups.push(views);
  const tools: DropdownItem[] = [];
  if (zenModeEnabled.value) tools.push({ label: t('tasks.openZenMode') || 'Zen Mode', icon: 'lucide:smartphone', click: openZen });
  if (isOwnerOrManager.value) tools.push({ label: t('common.export'), icon: 'lucide:file-spreadsheet', disabled: !visibleTasks.value.length, click: exportTasks });
  if (tools.length) groups.push(tools);
  if (taskTemplates.value.length) {
    groups.push([{ label: t('tasks.fromTemplate'), disabled: true, slot: 'heading' }, ...templateMenuItems.value[0]]);
  }
  return groups;
});

// Filters that are not already visible as chips; drives the "Filters · N" badge on phones.
const filterCount = computed(() => (selectedTaskTypeIds.value.length ? 1 : 0) + (selectedAssignee.value ? 1 : 0) + (myTasksOnly.value ? 1 : 0));
const isFiltersOpen = ref(false);
function resetFilters() {
  selectedTaskTypeIds.value = [];
  selectedAssignee.value = '';
  myTasksOnly.value = false;
}
async function createFromTemplate(tpl: TaskTemplate) {
  const taskTypeId = tpl.task_type_id || board.value?.defaultTaskTypeId || taskTypes.value[0]?.id;
  if (!taskTypeId) {
    useToast().add({ title: t('tasks.noTaskTypesYet') || 'Create an issue type first', color: 'red' });
    return;
  }
  try {
    const token = await getToken();
    const { tasksCreateTask } = await import('@/api/tasks/task/create');
    const created = await tasksCreateTask(token, nsSlug.value, {
      boardId: boardId.value, taskTypeId, title: tpl.title, description: tpl.description || undefined, priority: tpl.priority,
      status: boardStatuses.value[0]?.key, cycleId: defaultCycleIdForNewTask.value, dueAt: templateDueAt(tpl),
      assigneeUserId: currentUser.value?.id || undefined,
    });
    tasks.value = [...tasks.value, created];
    useToast().add({ title: t('tasks.templateCreated', { name: tpl.name }), color: 'primary' });
  } catch (e) {
    logError('[tasks/board] create from template failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to create issue', color: 'red' });
  }
}

async function submitQuickAdd() {
  // Guards against a double-create: pressing Enter can itself trigger the
  // input's blur handler before this async call finishes clearing the
  // title, which would otherwise fire a second, overlapping submit.
  if (quickAddSaving.value) return;
  const title = quickAddTitle.value.trim();
  if (!title) { cancelQuickAdd(); return; }
  const taskTypeId = board.value?.defaultTaskTypeId || taskTypes.value[0]?.id;
  if (!taskTypeId) {
    useToast().add({ title: t('tasks.noTaskTypesYet') || 'Create an issue type first', color: 'red' });
    return;
  }
  quickAddSaving.value = true;
  try {
    const token = await getToken();
    const { tasksCreateTask } = await import('@/api/tasks/task/create');
    const created = await tasksCreateTask(token, nsSlug.value, {
      boardId: boardId.value,
      taskTypeId,
      title,
      priority: 1,
      status: boardStatuses.value[0]?.key,
      cycleId: defaultCycleIdForNewTask.value,
      // Quick-add is a Trello-style "jot it down" flow -- defaulting the
      // assignee to whoever's creating it means it shows up on their own
      // "My tasks" filter immediately, rather than sitting unassigned until
      // someone remembers to claim it.
      assigneeUserId: currentUser.value?.id || undefined,
    });
    useAnalytics().track('issues_task_created', { source: 'quick_add' });
    tasks.value = [...tasks.value, created];
    quickAddTitle.value = '';
  } catch (e) {
    logError('[tasks/board] quick add failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to create issue', color: 'red' });
  } finally {
    quickAddSaving.value = false;
  }
}

// Task detail slideover -- the opened task's short code is mirrored into
// the URL (?task=CODE) via replace (not push, so the back button doesn't
// have to click through every task opened) so a specific issue can be
// bookmarked/shared and reopens automatically on load.
const isDetailOpen = ref(false);
const selectedTask = ref<TaskItem | null>(null);
function openDetail(task: TaskItem) {
  selectedTask.value = task;
  pendingTaskUpdate.value = null;
  isDetailOpen.value = true;
}
// Jump from a subtask to its parent (or back) without closing the panel.
function openRelatedTask(task: TaskItem) {
  selectedTask.value = task;
  pendingTaskUpdate.value = null;
  isDetailOpen.value = true;
  navigateTo({ query: { ...route.query, task: taskShortCode(boardSlug.value, task.taskNumber) } }, { replace: true });
}
function applyPendingTaskUpdate() {
  if (pendingTaskUpdate.value) selectedTask.value = pendingTaskUpdate.value;
  pendingTaskUpdate.value = null;
}
watch(isDetailOpen, (open) => {
  const query = { ...route.query };
  if (open && selectedTask.value) {
    query.task = taskShortCode(boardSlug.value, selectedTask.value.taskNumber);
  } else {
    delete query.task;
    pendingTaskUpdate.value = null;
  }
  navigateTo({ query }, { replace: true });
});
function handleTaskChanged(updated: TaskItem) {
  const idx = tasks.value.findIndex((tsk) => tsk.id === updated.id);
  if (idx !== -1) tasks.value[idx] = updated;
  selectedTask.value = updated;
  loadTasks({ silent: true });
}
function handleTaskDeleted(id: string) {
  tasks.value = tasks.value.filter((tsk) => tsk.id !== id);
  isDetailOpen.value = false;
}
function openTaskByCode(code: string) {
  const task = tasks.value.find((tsk) => taskShortCode(boardSlug.value, tsk.taskNumber) === code.toUpperCase());
  if (task) {
    selectedTask.value = task;
    isDetailOpen.value = true;
  }
}

function assigneeLabel(task: TaskItem): string {
  return memberOptions.value.find((m) => m.value === task.assigneeUserId)?.label || '';
}
function taskTypeIcon(task: TaskItem): string {
  return taskTypes.value.find((tt) => tt.id === task.taskTypeId)?.icon || 'lucide:shapes';
}

// --- Drag and drop: between columns (status) and within a column (manual
// order, via fractional indexing -- the dropped-on card's neighbors bracket
// the new value, so reordering never rewrites any other row). ---
const draggingTaskId = ref<string | null>(null);
const dragOverColumnKey = ref<string | null>(null);
function handleDragStart(task: TaskItem) {
  draggingTaskId.value = task.id;
}
function handleDragEnd() {
  draggingTaskId.value = null;
  dragOverColumnKey.value = null;
}

// A column that asks for a reason: park the drop, ask, then finish it.
const dropReasonOpen = ref(false);
const dropReasonBusy = ref(false);
const pendingDrop = ref<{ task: TaskItem; col: StatusRow; sortOrder: number } | null>(null);
async function confirmDropReason(v: { text: string }) {
  const d = pendingDrop.value;
  if (!d) return;
  dropReasonBusy.value = true;
  try {
    await applyDrop(d.task, d.col, d.sortOrder, v.text);
  } finally {
    dropReasonBusy.value = false;
    dropReasonOpen.value = false;
    pendingDrop.value = null;
  }
}

async function applyDrop(task: TaskItem, col: StatusRow, sortOrder: number, reason?: string) {
  const statusChanged = task.status !== col.key;
  if (statusChanged && col.askReason && reason === undefined) {
    pendingDrop.value = { task, col, sortOrder };
    dropReasonOpen.value = true;
    return;
  }
  if (statusChanged) {
    const missing = blockingRequiredStatuses(col, boardStatuses.value, task.visitedStatuses);
    if (missing.length) {
      useToast().add({
        title: t('tasks.requiredStatusBlocked', { status: missing.map((s) => s.label).join(', ') }) || `Must pass through: ${missing.map((s) => s.label).join(', ')}`,
        color: 'amber',
      });
      return;
    }
  }
  const previousStatus = task.status;
  const previousOrder = task.sortOrder;
  task.status = col.key; // optimistic
  task.sortOrder = sortOrder;
  try {
    const token = await getToken();
    if (statusChanged) {
      const { tasksUpdateTaskStatus } = await import('@/api/tasks/task/update');
      await tasksUpdateTaskStatus(token, nsSlug.value, { taskId: task.id, status: col.key, isTerminal: col.isTerminal, comment: reason || undefined });
    }
    const { tasksUpdateTaskOrder } = await import('@/api/tasks/task/update');
    const updated = await tasksUpdateTaskOrder(token, nsSlug.value, task.id, sortOrder);
    const idx = tasks.value.findIndex((tsk) => tsk.id === updated.id);
    if (idx !== -1) tasks.value[idx] = updated;
  } catch (e) {
    task.status = previousStatus;
    task.sortOrder = previousOrder;
    logError('[tasks/board] drag reorder failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to update status', color: 'red' });
  }
}

// Dropped on empty column space (not on a card) -- append to the end.
async function handleDrop(col: StatusRow) {
  const taskId = draggingTaskId.value;
  dragOverColumnKey.value = null;
  draggingTaskId.value = null;
  const task = tasks.value.find((tsk) => tsk.id === taskId);
  if (!task) return;
  const columnTasks = (tasksByColumn.value[col.key] || []).filter((tsk) => tsk.id !== task.id);
  if (task.status === col.key && !columnTasks.length) return; // nothing to do
  const lastOrder = columnTasks.length ? columnTasks[columnTasks.length - 1].sortOrder : 0;
  await applyDrop(task, col, lastOrder + 1000);
}

// Dropped directly on another card -- insert just before it.
const dragOverTaskId = ref<string | null>(null);
async function handleCardDrop(col: StatusRow, targetTask: TaskItem) {
  const taskId = draggingTaskId.value;
  dragOverColumnKey.value = null;
  dragOverTaskId.value = null;
  draggingTaskId.value = null;
  const task = tasks.value.find((tsk) => tsk.id === taskId);
  if (!task || task.id === targetTask.id) return;
  const columnTasks = (tasksByColumn.value[col.key] || []).filter((tsk) => tsk.id !== task.id);
  const targetIdx = columnTasks.findIndex((tsk) => tsk.id === targetTask.id);
  const prevTask = targetIdx > 0 ? columnTasks[targetIdx - 1] : null;
  const newSortOrder = prevTask ? (prevTask.sortOrder + targetTask.sortOrder) / 2 : targetTask.sortOrder - 1000;
  await applyDrop(task, col, newSortOrder);
}
</script>

<template>
  <div class="at-scope ct-scope h-full flex flex-col p-4 pb-safe-or-4 min-h-0">
    <!-- Header: where am I + the one primary action; everything else is behind the gear / "more" menu. -->
    <div class="flex items-center justify-between gap-2 mb-3 flex-shrink-0">
      <div class="flex items-center gap-2 min-w-0">
        <NuxtLink :to="`/${nsSlug}/issues?pick=1`" class="at-btn flex-shrink-0 !px-3" :aria-label="t('tasks.boards') || 'Boards'">
          <Icon name="lucide:layout-grid" class="w-4 h-4" />
          <span class="hidden sm:inline">{{ t('tasks.boards') || 'Boards' }}</span>
        </NuxtLink>
        <h1 class="text-xl sm:text-2xl font-semibold truncate" data-tour="issues-title">{{ board?.name || '...' }}</h1>
      </div>
      <div class="flex items-center gap-1.5 flex-shrink-0">
        <button type="button" class="at-btn at-btn--primary" data-tour="issues-create-btn" @click="openCreateTask">
          <Icon name="lucide:plus" class="w-4 h-4" />
          <span class="hidden sm:inline">{{ t('tasks.createTask') || 'Create issue' }}</span>
          <span class="hidden min-[440px]:inline sm:hidden">{{ t('app.create') || 'Create' }}</span>
          <span class="sr-only min-[440px]:hidden sm:sr-only">{{ t('tasks.createTask') || 'Create issue' }}</span>
        </button>
        <!-- Logistics is a daily dispatcher tool, so it is a visible button, not a menu entry. -->
        <NuxtLink
          v-if="isOwnerOrManager"
          :to="`/${nsSlug}/issues/${boardSlug}/logistics`"
          class="at-btn !px-2.5 xl:!px-3.5"
          :aria-label="t('tasks.logisticsTitle')"
          :title="t('tasks.logisticsTitle')"
        >
          <Icon name="lucide:route" class="w-4 h-4" />
          <span class="hidden xl:inline">{{ t('tasks.logisticsTitle') }}</span>
        </NuxtLink>
        <NuxtLink
          v-if="isOwnerOrManager"
          :to="`/${nsSlug}/issues/${boardSlug}/settings`"
          class="at-btn !px-2.5"
          data-tour="issues-settings-btn"
          :aria-label="t('tasks.configure') || 'Configure'"
          :title="t('tasks.configure') || 'Configure'"
        >
          <Icon name="lucide:settings" class="w-4 h-4" />
        </NuxtLink>
        <UDropdown v-if="moreMenuItems.length" :items="moreMenuItems" :popper="{ placement: 'bottom-end', strategy: 'fixed' }">
          <button type="button" class="at-btn !px-2.5" :aria-label="t('tasks.moreActions') || 'More'" :title="t('tasks.moreActions') || 'More'">
            <Icon name="lucide:ellipsis" class="w-4 h-4" />
          </button>
          <template #item="{ item }">
            <span v-if="item.slot === 'heading'" class="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{{ item.label }}</span>
            <template v-else>
              <UIcon v-if="item.icon" :name="item.icon" class="w-4 h-4 flex-shrink-0 text-gray-400" />
              <span class="truncate">{{ item.label }}</span>
            </template>
          </template>
        </UDropdown>
      </div>
    </div>

    <!-- Search + filters: one row. On phones the type / assignee / "mine" controls move into the filter sheet. -->
    <div class="flex items-center gap-2 mb-2 flex-shrink-0">
      <UInput v-model="search" icon="lucide:search" :placeholder="t('tasks.searchTasks') || 'Search by title or description'" class="flex-1 min-w-0" />
      <BoardFilters
        v-model:task-type-ids="selectedTaskTypeIds"
        v-model:assignee="selectedAssignee"
        v-model:my-tasks-only="myTasksOnly"
        :task-types="taskTypes"
        :member-options="memberOptions"
        :my-open-count="myOpenCount"
        class="hidden md:flex"
      />
      <div class="md:hidden flex-shrink-0">
        <button type="button" class="at-btn" :aria-label="t('tasks.filters') || 'Filters'" @click="isFiltersOpen = true">
          <Icon name="lucide:sliders-horizontal" class="w-4 h-4" />
          <span v-if="filterCount" class="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-blue-600 px-1 text-[11px] font-bold leading-none text-white">{{ filterCount }}</span>
        </button>
      </div>
    </div>

    <!-- Quick views (+ sprint switcher): one scrollable row, never wraps. -->
    <div v-scroll-fade class="mb-3 flex-shrink-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
      <template v-if="cyclesEnabled">
        <UDropdown :items="sprintMenuItems" :popper="{ placement: 'bottom-start', strategy: 'fixed' }" class="flex-shrink-0">
          <button type="button" class="pill-filter inline-flex items-center gap-1.5 whitespace-nowrap" :class="selectedCycle ? 'pill-filter--active' : ''">
            <Icon name="lucide:flag" class="w-3.5 h-3.5" />
            <span class="max-w-[10rem] truncate">{{ selectedCycle ? selectedCycle.name : (t('tasks.backlog') || 'Backlog') }}</span>
            <Icon name="lucide:chevron-down" class="w-3.5 h-3.5 opacity-70" />
          </button>
        </UDropdown>
        <span class="h-5 w-px flex-shrink-0 bg-gray-200 dark:bg-white/10" aria-hidden="true" />
      </template>
      <button v-for="v in QUICK_VIEWS" :key="v.key" type="button" class="pill-filter whitespace-nowrap flex-shrink-0" :class="quickView === v.key ? 'pill-filter--active' : ''" :aria-pressed="quickView === v.key" @click="quickView = quickView === v.key ? '' : v.key">
        <Icon :name="v.icon" class="w-3.5 h-3.5" />{{ t(v.label) }}
      </button>
    </div>

    <div v-if="error" class="mb-3 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm px-3 py-2">
      {{ error }}
    </div>

    <div v-if="loading" class="flex-1 min-h-0 overflow-hidden"><AppSkeleton variant="kanban" /></div>

    <!-- Columns stretch evenly to fill the full width; each keeps a 20%
         minimum on desktop (past 5 columns, or whenever they can no longer
         all fit at >=20%, the row scrolls horizontally instead of shrinking
         further). On mobile a 20% column would be unusably narrow, so each
         one takes ~85% of the viewport instead -- effectively one at a time,
         swipe/scroll for the rest. -->
    <div v-else class="flex-1 min-h-0 overflow-x-auto" data-tour="issues-board">
      <div class="flex gap-3 h-full">
        <div
          v-for="(col, idx) in boardStatuses"
          :key="col.key"
          class="is-col flex flex-col flex-1 basis-1/5 min-w-[85%] sm:min-w-[20%] border h-full transition-colors"
          :class="dragOverColumnKey === col.key
            ? 'bg-primary-50 dark:bg-primary-950/30 border-primary-300 dark:border-primary-700'
            : columnColorClass(col.color)"
          @dragover.prevent="dragOverColumnKey = col.key"
          @dragleave="dragOverColumnKey === col.key && (dragOverColumnKey = null)"
          @drop.prevent="handleDrop(col)"
        >
          <div class="is-col__head flex items-center justify-between px-4 py-3 flex-shrink-0">
            <span class="font-medium text-sm truncate">{{ col.label }}</span>
            <UBadge color="gray" variant="subtle" size="xs">{{ columnCount(col.key) }}</UBadge>
          </div>
          <div class="flex-1 overflow-y-auto p-2 space-y-2">
            <button
              v-for="task in tasksByColumn[col.key] || []"
              :key="task.id"
              type="button"
              draggable="true"
              class="is-card w-full text-left border p-3"
              :class="[
                isTaskOverdue(task)
                  ? 'border-red-300 dark:border-red-800 hover:border-red-400 dark:hover:border-red-700'
                  : 'border-gray-200 dark:border-gray-800 hover:border-primary-300 dark:hover:border-primary-700',
                draggingTaskId === task.id && 'opacity-40',
                dragOverTaskId === task.id && draggingTaskId !== task.id && 'border-t-2 border-t-primary-500',
              ]"
              @click="openDetail(task)"
              @dragstart="handleDragStart(task)"
              @dragend="handleDragEnd"
              @dragover.prevent.stop="dragOverTaskId = task.id"
              @dragleave="dragOverTaskId === task.id && (dragOverTaskId = null)"
              @drop.prevent.stop="handleCardDrop(col, task)"
            >
              <div class="flex items-center gap-1.5 text-[11px] text-gray-400 mb-1">
                <UIcon :name="taskTypeIcon(task)" class="w-3.5 h-3.5 flex-shrink-0" />
                <span class="font-mono">{{ taskShortCode(boardSlug, task.taskNumber) }}</span>
              </div>
              <div class="flex items-start justify-between gap-2">
                <span class="text-sm font-medium leading-snug line-clamp-2"><UIcon v-if="task.problemReportedAt" name="lucide:life-buoy" class="w-3.5 h-3.5 text-amber-500 inline -mt-0.5 mr-1" :title="task.problemReason || ''" />{{ maskProfanity(task.title) }}</span>
                <UIcon :name="priorityIcon(task.priority)" :class="['w-4 h-4 flex-shrink-0 mt-0.5', priorityColorClass(task.priority)]" />
              </div>
              <p v-if="firstLine(task.description)" class="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">{{ firstLine(task.description) }}</p>
              <a
                v-if="task.textAddress"
                :href="`https://2gis.kz/search/${encodeURIComponent(task.textAddress)}`"
                target="_blank"
                class="mt-1 text-[11px] text-primary-600 dark:text-primary-400 flex items-center gap-1 truncate"
                @click.stop
              >
                <UIcon name="lucide:map-pin" class="w-3 h-3 flex-shrink-0" />
                <span class="truncate">{{ task.textAddress }}</span>
              </a>
              <NuxtLink
                v-else-if="task.lat && task.lng"
                :to="`/${nsSlug}/issues/${boardSlug}/map?task=${taskShortCode(boardSlug, task.taskNumber)}`"
                class="mt-1 text-[11px] text-primary-600 dark:text-primary-400 flex items-center gap-1"
                @click.stop
              >
                <UIcon name="lucide:map" class="w-3 h-3 flex-shrink-0" />{{ t('tasks.showOnMap') || 'Show on map' }}
              </NuxtLink>
              <div class="mt-1.5 flex items-center justify-between gap-1.5 flex-wrap">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <UBadge v-if="isTaskOverdue(task)" color="red" variant="subtle" size="xs">
                    <UIcon name="lucide:alarm-clock" class="w-3 h-3 mr-0.5" />{{ t('tasks.overdue') || 'Overdue' }}
                  </UBadge>
                  <span v-if="task.dueAt" class="text-[11px] text-gray-400 flex items-center gap-0.5">
                    <UIcon name="lucide:calendar" class="w-3 h-3 flex-shrink-0" />{{ formatDueDate(task.dueAt) }}
                  </span>
                </div>
                <span v-if="task.assigneeUserId" class="text-[11px] text-gray-500 dark:text-gray-400 truncate max-w-[110px]">
                  {{ assigneeLabel(task) }}
                </span>
              </div>
            </button>
            <p v-if="!(tasksByColumn[col.key] || []).length" class="text-xs text-gray-400 text-center py-4">{{ t('tasks.noTasksInColumn') || 'Nothing here' }}</p>
          </div>
          <!-- The first column is where new work enters the board, so it
               always offers a way to add an issue without reaching for the
               header button -- a title-only inline input beats a modal
               round trip for the common case. -->
          <div v-if="idx === 0" class="flex-shrink-0 p-2">
            <div v-if="quickAddOpen" class="flex items-center gap-1">
              <UInput
                v-model="quickAddTitle"
                size="sm"
                autofocus
                class="flex-1"
                :placeholder="t('tasks.taskTitlePlaceholder') || 'What needs to be done?'"
                :disabled="quickAddSaving"
                @keyup.enter="submitQuickAdd"
                @keyup.esc="cancelQuickAdd"
                @blur="quickAddTitle.trim() ? submitQuickAdd() : cancelQuickAdd()"
              />
              <UButton icon="lucide:check" size="xs" color="primary" variant="soft" :loading="quickAddSaving" @mousedown.prevent="submitQuickAdd" />
              <UButton icon="lucide:x" size="xs" color="gray" variant="ghost" @mousedown.prevent="cancelQuickAdd" />
            </div>
            <UButton v-else icon="lucide:plus" size="xs" color="gray" variant="soft" block @click="openQuickAdd">
              {{ t('tasks.createTask') || 'Create issue' }}
            </UButton>
          </div>
        </div>

        <div v-if="!boardStatuses.length" class="flex items-center justify-center w-full text-gray-400 text-sm">
          {{ t('tasks.noColumns') || 'This board has no columns configured yet' }}
        </div>
      </div>
    </div>

    <!-- Phone filter sheet: the same filters as the desktop row, applied instantly. -->
    <USlideover
      v-model="isFiltersOpen"
      side="bottom"
      class="at-modal"
      :ui="{ height: 'h-auto max-h-[85vh]', rounded: 'rounded-t-[2rem]', background: 'bg-white dark:bg-[#1a1a1a]', ring: 'ring-1 ring-black/5 dark:ring-white/10', shadow: 'shadow-2xl' }"
    >
      <div class="flex flex-col gap-4 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
        <span class="mx-auto h-1 w-10 flex-shrink-0 rounded-full bg-gray-300 dark:bg-white/20" aria-hidden="true" />
        <div class="flex items-center justify-between gap-3">
          <h3 class="text-base font-semibold">{{ t('tasks.filters') || 'Filters' }}</h3>
          <button type="button" class="at-btn !px-3" :aria-label="t('app.close') || 'Close'" @click="isFiltersOpen = false"><Icon name="lucide:x" class="w-4 h-4" /></button>
        </div>
        <BoardFilters
          v-model:task-type-ids="selectedTaskTypeIds"
          v-model:assignee="selectedAssignee"
          v-model:my-tasks-only="myTasksOnly"
          :task-types="taskTypes"
          :member-options="memberOptions"
          :my-open-count="myOpenCount"
          stacked
        />
        <div class="flex items-center justify-end gap-2">
          <button type="button" class="at-btn" :disabled="!filterCount" @click="resetFilters">{{ t('app.clear') || 'Clear' }}</button>
          <button type="button" class="at-btn at-btn--primary" @click="isFiltersOpen = false">{{ t('app.done') || 'Done' }}</button>
        </div>
      </div>
    </USlideover>

    <OpenOnPhoneModal v-model="isOpenZenQrModalOpen" :url="zenModeUrl" />
    <TaskModal
      v-model="isTaskModalOpen"
      :task-types="taskTypes"
      :member-options="memberOptions"
      :geo-map-enabled="geoMapEnabled"
      :deal-fields-enabled="funnelEnabled"
      :saving="savingTask"
      @submit="handleTaskSubmit"
    />
    <TaskDetailSlideover
      v-model="isDetailOpen"
      :task="selectedTask"
      :board-statuses="boardStatuses"
      :task-types="taskTypes"
      :member-options="memberOptions"
      :ns-slug="nsSlug"
      :board-slug="boardSlug"
      :has-pending-update="!!pendingTaskUpdate"
      :cycles-enabled="cyclesEnabled"
      :cycles="cycles"
      :contacts-integration-enabled="contactsIntegrationEnabled"
      :menu-integration-enabled="menuIntegrationEnabled"
      :delivery-money-enabled="deliveryMoneyEnabled"
      :deal-fields-enabled="funnelEnabled"
      :require-handoff-accept="requireHandoffAccept"
      :current-user-id="currentUser?.id"
      @changed="handleTaskChanged"
      @deleted="handleTaskDeleted"
      @apply-pending-update="applyPendingTaskUpdate"
      @open-task="openRelatedTask"
    />
    <ReasonModal
      v-model="dropReasonOpen"
      :title="pendingDrop?.col.isTerminal ? t('tasks.reasonCancelTitle') : t('tasks.reasonStatusTitle')"
      :quick="[t('tasks.commentTpl1'), t('tasks.commentTpl2'), t('tasks.commentTpl3')]"
      :busy="dropReasonBusy"
      @confirm="confirmDropReason"
    />
    <CycleModal
      v-model="isCycleModalOpen"
      :cycle="editingCycle"
      :saving="savingCycle"
      @submit="handleCycleSubmit"
    />
    <CloseCycleModal
      v-model="isCloseCycleModalOpen"
      :cycle-name="selectedCycle?.name"
      :initial-carry-over="closeCycleCarryOverDefault"
      :saving="closingCycle"
      @submit="handleCloseCycleConfirm"
    />
    <BurndownModal v-model="isBurndownModalOpen" :cycle="selectedCycle" :tasks="tasks" :task-types="taskTypes" />
  </div>
</template>
