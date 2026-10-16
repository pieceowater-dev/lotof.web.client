<script lang="ts" setup>
import AppSkeleton from '@/components/ui/AppSkeleton.vue';
import { useI18n } from '@/composables/useI18n';
import { useTasksToken } from '@/composables/useTasksToken';
import { usePwaInstall } from '@/composables/usePwaInstall';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import { priorityIcon, priorityColorClass, taskShortCode, blockingRequiredStatuses } from '@/utils/taskDisplay';
import { renderMarkdownSafe } from '@/utils/renderMarkdown';
import { maskProfanity } from '@/utils/profanityFilter';
import PwaInstallModal from '@/components/tasks/PwaInstallModal.vue';
import NavigateSheet from '@/components/tasks/NavigateSheet.vue';
import ReasonModal from '@/components/tasks/ReasonModal.vue';
import type { TaskItem } from '@/api/tasks/task/list';
import type { TaskBoard } from '@/api/tasks/board/list';
import { usePageTitle } from '@/composables/usePageTitle';

definePageMeta({ layout: false });

const { isStandalone } = usePwaInstall();
const isPwaModalOpen = ref(false);

interface StatusRow { key: string; label: string; isTerminal: boolean; isRequired: boolean; askReason?: boolean }

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const { user: currentUser } = useAuth();

usePageTitle('issues', { section: 'zen' });

async function getToken(): Promise<string> {
  const { current } = useTasksToken();
  const token = current();
  if (!token) throw new Error('No tasks token');
  return token;
}

const boards = ref<TaskBoard[]>([]);
const boardStatuses = computed<Record<string, StatusRow[]>>(() => {
  const map: Record<string, StatusRow[]> = {};
  for (const b of boards.value) {
    try {
      const arr = JSON.parse(b.statuses || '[]');
      map[b.id] = Array.isArray(arr) ? arr.map((s: any) => ({ key: s.key, label: s.label || s.key, isTerminal: !!s.is_terminal, isRequired: !!s.required, askReason: !!s.ask_reason })) : [];
    } catch {
      map[b.id] = [];
    }
  }
  return map;
});

const tasks = ref<TaskItem[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

// Only tasks not yet in a terminal column need the courier's attention.
const openTasks = computed(() => {
  return tasks.value
    .filter((task) => {
      const statuses = boardStatuses.value[task.boardId] || [];
      const current = statuses.find((s) => s.key === task.status);
      return !current?.isTerminal;
    })
    .sort((a, b) => b.priority - a.priority || (a.dueAt || '').localeCompare(b.dueAt || ''));
});

// Only the current stop is expanded by default; a tap opens another one (and
// folds the previous), so a long route stays a scannable list of stops.
const expandedId = ref<string | null>(null);
function isExpanded(task: TaskItem, idx: number) {
  return expandedId.value ? expandedId.value === task.id : idx === 0;
}
function toggleExpanded(task: TaskItem, idx: number) {
  expandedId.value = isExpanded(task, idx) ? '__none__' : task.id;
}

function nextStatus(task: TaskItem): StatusRow | null {
  const statuses = boardStatuses.value[task.boardId] || [];
  const idx = statuses.findIndex((s) => s.key === task.status);
  if (idx === -1 || idx + 1 >= statuses.length) return null;
  return statuses[idx + 1];
}
function terminalStatus(task: TaskItem): StatusRow | null {
  const statuses = boardStatuses.value[task.boardId] || [];
  return statuses.find((s) => s.isTerminal) || null;
}

// Distinct from `loading` (full-screen spinner, first load only) -- a manual
// refresh keeps the current list visible with just a small spinner on the
// button, since replacing the whole screen for a pull-to-refresh action
// feels broken on a page a courier is actively working from.
const refreshing = ref(false);
async function load(opts: { manual?: boolean; silent?: boolean } = {}) {
  if (opts.manual) refreshing.value = true;
  else if (!opts.silent) loading.value = true;
  error.value = null;
  try {
    if (!currentUser.value?.id) return;
    const token = await getToken();
    const { tasksBoardsList } = await import('@/api/tasks/board/list');
    const boardsRes = await tasksBoardsList(token, nsSlug.value);
    // Only boards with Zen Mode turned on take part in this view -- toggling
    // it off for a board should actually remove its issues from here, not
    // just flip a setting nothing reads.
    boards.value = boardsRes.boards.filter((b) => {
      try {
        return !!(b.featureFlags ? JSON.parse(b.featureFlags).zen_mode : false);
      } catch {
        return false;
      }
    });
    const zenBoardIds = new Set(boards.value.map((b) => b.id));

    const { tasksBundle } = await import('@/api/tasks/task/list');
    const res = await tasksBundle(token, nsSlug.value, { assigneeUserId: currentUser.value.id }, { length: 'ONE_HUNDRED' });
    tasks.value = res.tasks.filter((tsk) => zenBoardIds.has(tsk.boardId));
  } catch (e) {
    logError('[tasks/zen] load failed', e);
    error.value = getErrorMessage(e, t) || 'Failed to load issues';
  } finally {
    loading.value = false;
    refreshing.value = false;
  }
}

// --- Status actions, queued for offline resilience --------------------
// A lift/basement/bad LTE spell is routine for a courier — every status
// change goes through this queue instead of failing outright, and is
// retried automatically once the browser reports it's back online (plus a
// periodic timer as a backstop, since the 'online' event is not always
// reliable). Backed by localStorage (not IndexedDB): the payloads are tiny
// and few, and this codebase already leans on localStorage everywhere else
// with zero IndexedDB precedent — a second persistence mechanism for a
// handful of small JSON objects isn't worth the extra code.
const QUEUE_KEY = computed(() => `tasks:zenQueue:${nsSlug.value}`);
interface QueuedAction { id: string; taskId: string; status: string; isTerminal: boolean; comment?: string }

function readQueue(): QueuedAction[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY.value) || '[]');
  } catch {
    return [];
  }
}
function writeQueue(items: QueuedAction[]) {
  try { localStorage.setItem(QUEUE_KEY.value, JSON.stringify(items)); } catch {}
}
const pendingCount = ref(0);
function refreshPendingCount() { pendingCount.value = readQueue().length; }

async function sendStatusUpdate(action: QueuedAction): Promise<boolean> {
  try {
    const token = await getToken();
    const { tasksUpdateTaskStatus } = await import('@/api/tasks/task/update');
    const updated = await tasksUpdateTaskStatus(token, nsSlug.value, { taskId: action.taskId, status: action.status, isTerminal: action.isTerminal, comment: action.comment });
    const idx = tasks.value.findIndex((tsk) => tsk.id === updated.id);
    if (idx !== -1) tasks.value[idx] = updated;
    return true;
  } catch (e) {
    logError('[tasks/zen] status update failed, queued for retry', e);
    return false;
  }
}

async function flushQueue() {
  const queue = readQueue();
  if (!queue.length) return;
  const remaining: QueuedAction[] = [];
  for (const action of queue) {
    const ok = await sendStatusUpdate(action);
    if (!ok) remaining.push(action);
  }
  writeQueue(remaining);
  refreshPendingCount();
}

function handleAdvanceClick(task: TaskItem, target: StatusRow) {
  const statuses = boardStatuses.value[task.boardId] || [];
  const missing = blockingRequiredStatuses(target, statuses, task.visitedStatuses);
  if (missing.length) {
    useToast().add({
      title: t('tasks.requiredStatusBlocked', { status: missing.map((m) => m.label).join(', ') }) || `Must pass through: ${missing.map((m) => m.label).join(', ')}`,
      color: 'amber',
    });
    return;
  }
  if (target.askReason) {
    reasonMode.value = 'status';
    reasonTask.value = task;
    reasonTarget.value = target;
    reasonOpen.value = true;
    return;
  }
  advanceStatus(task, target);
}

// Reason dialog (a column that asks why, or a reported problem). The reason
// rides along in the offline queue like the status itself.
const reasonOpen = ref(false);
const reasonBusy = ref(false);
const reasonMode = ref<'status' | 'problem'>('status');
const reasonTask = ref<TaskItem | null>(null);
const reasonTarget = ref<StatusRow | null>(null);
const PROBLEMS = computed(() => [
  { code: 'CLIENT_NO_ANSWER', label: t('tasks.problemNoAnswer') },
  { code: 'ADDRESS_NOT_FOUND', label: t('tasks.problemNoAddress') },
  { code: 'NO_GOODS', label: t('tasks.problemNoGoods') },
  { code: 'OTHER', label: t('tasks.problemOther') },
]);
const reasonQuick = computed(() => (reasonMode.value === 'problem' ? PROBLEMS.value.map((p) => p.label) : [t('tasks.commentTpl1'), t('tasks.commentTpl2'), t('tasks.commentTpl3')]));
function openProblem(task: TaskItem) {
  reasonMode.value = 'problem';
  reasonTask.value = task;
  reasonOpen.value = true;
}
async function onReasonConfirm(v: { text: string }) {
  const task = reasonTask.value;
  if (!task) return;
  reasonBusy.value = true;
  try {
    if (reasonMode.value === 'problem') {
      const { tasksReportProblem } = await import('@/api/tasks/task/extra');
      const picked = PROBLEMS.value.find((p) => v.text.includes(p.label));
      const updated = await tasksReportProblem(await getToken(), nsSlug.value, { taskId: task.id, reasonCode: picked?.code || 'OTHER', text: v.text || undefined });
      const idx = tasks.value.findIndex((tsk) => tsk.id === updated.id);
      if (idx !== -1) tasks.value[idx] = updated;
    } else if (reasonTarget.value) {
      await advanceStatus(task, reasonTarget.value, v.text);
    }
    reasonOpen.value = false;
  } catch (e) {
    logError('[tasks/zen] reason action failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed', color: 'red' });
  } finally {
    reasonBusy.value = false;
  }
}

async function advanceStatus(task: TaskItem, target: StatusRow, comment?: string) {
  const action: QueuedAction = { id: `${task.id}:${Date.now()}`, taskId: task.id, status: target.key, isTerminal: target.isTerminal, comment: comment || undefined };
  // Optimistic local update so the card moves immediately regardless of
  // network state — matches the plan's "optimistic UI + offline queue".
  const idx = tasks.value.findIndex((tsk) => tsk.id === task.id);
  if (idx !== -1) tasks.value[idx] = { ...tasks.value[idx], status: target.key };

  if (!navigator.onLine) {
    writeQueue([...readQueue(), action]);
    refreshPendingCount();
    useToast().add({ title: t('tasks.zenQueuedOffline') || 'Saved — will sync once back online', color: 'amber' });
    return;
  }
  const ok = await sendStatusUpdate(action);
  if (!ok) {
    writeQueue([...readQueue(), action]);
    refreshPendingCount();
  }
}

// --- Geolocation reporting ---------------------------------------------
// Throttled to one send per ~25s regardless of watchPosition's own callback
// rate (plan §5) — a delta of one point every few seconds is unnecessary
// load for a last-known-position table. iOS Safari throttles/stops
// watchPosition entirely once backgrounded (plan §9.3) — there is no
// workaround for that from the page itself, only the manual refresh button.
let watchId: number | null = null;
let lastSentAt = 0;
const GEO_SEND_INTERVAL_MS = 25000;
const geoStatus = ref<'idle' | 'active' | 'denied' | 'unsupported'>('idle');
const geoHelp = ref(false);
const lastSentAgo = ref<string | null>(null);
// Local-only, unthrottled -- unlike reportPosition's 25s-throttled server
// write, this just drives the live "you are here" dot in the navigate sheet
// while it's open, so it should track every watchPosition callback.
const currentPosition = ref<{ lat: number; lng: number } | null>(null);

async function reportPosition(pos: GeolocationPosition) {
  const now = Date.now();
  if (now - lastSentAt < GEO_SEND_INTERVAL_MS) return;
  lastSentAt = now;
  try {
    const token = await getToken();
    const { tasksUpdateMyLocation } = await import('@/api/tasks/geotrack/location');
    await tasksUpdateMyLocation(token, nsSlug.value, pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
    lastSentAgo.value = new Date().toLocaleTimeString();
  } catch (e) {
    logError('[tasks/zen] failed to report position', e);
  }
}

function startGeoWatch() {
  if (!process.client || !navigator.geolocation) {
    geoStatus.value = 'unsupported';
    return;
  }
  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      geoStatus.value = 'active';
      currentPosition.value = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      reportPosition(pos);
    },
    (err) => {
      logError('[tasks/zen] geolocation error', err);
      if (err.code === err.PERMISSION_DENIED) geoStatus.value = 'denied';
    },
    { enableHighAccuracy: false, maximumAge: 15000, timeout: 20000 },
  );
}
function stopGeoWatch() {
  if (watchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchId);
  watchId = null;
}
function manualRefreshLocation() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition((pos) => { lastSentAt = 0; reportPosition(pos); });
}

// A task with an actual map pin opens the in-app navigate sheet (task pin +
// live position, both on the same map) instead of leaving the PWA -- only a
// bare text address (no coordinates) has nowhere better to go than an
// external 2GIS search.
function textAddressUrl(task: TaskItem): string | null {
  if (task.lat && task.lng) return null;
  if (task.textAddress) return `https://2gis.kz/search/${encodeURIComponent(task.textAddress)}`;
  return null;
}
const isNavigateSheetOpen = ref(false);
const navigateTask = ref<TaskItem | null>(null);
function openNavigateSheet(task: TaskItem) {
  navigateTask.value = task;
  isNavigateSheetOpen.value = true;
}

function taskTypeBoard(task: TaskItem): string {
  return boards.value.find((b) => b.id === task.boardId)?.name || '';
}
function taskCode(task: TaskItem): string {
  return taskShortCode(boards.value.find((b) => b.id === task.boardId)?.slug, task.taskNumber);
}

// Burger menu (plan: "лого lota Zen ---- бургер меню") -- the only way out
// of this full-screen PWA view back to the regular board UI, plus the
// install-app flow. Kept to just these two since there's nothing else here
// yet that needs a settings surface.
const menuItems = computed(() => [[
  // ?pick=1 opts out of the index page's own auto-redirects (straight into
  // the only board, or -- on mobile -- straight back into Zen), otherwise
  // this link would just bounce the user right back here.
  { label: t('tasks.zenBackToBoard') || 'Back to main view', icon: 'lucide:layout-grid', click: () => navigateTo(`/${nsSlug.value}/issues?pick=1`) },
  ...(!isStandalone.value ? [{ label: t('tasks.installApp') || 'Install app', icon: 'lucide:download', click: () => { isPwaModalOpen.value = true; } }] : []),
]]);

let flushTimer: ReturnType<typeof setInterval> | null = null;
let refreshTimer: ReturnType<typeof setInterval> | null = null;

onMounted(async () => {
  await load();
  refreshPendingCount();
  startGeoWatch();
  window.addEventListener('online', flushQueue);
  flushTimer = setInterval(flushQueue, 20000);
  // Silent: this used to set the same full-screen `loading` flag as the
  // initial load, which meant the whole list flashed away behind a spinner
  // every 30s while a courier might be mid-read -- background polls should
  // never be visible at all.
  refreshTimer = setInterval(() => load({ silent: true }), 30000);
});
onBeforeUnmount(() => {
  stopGeoWatch();
  window.removeEventListener('online', flushQueue);
  if (flushTimer) clearInterval(flushTimer);
  if (refreshTimer) clearInterval(refreshTimer);
});
</script>

<template>
  <div class="min-h-screen bg-gray-50 text-gray-900 flex flex-col">
    <!-- Always light, regardless of system theme -- this is a full-screen
         courier PWA modeled after Yandex Delivery/DoorDash's driver apps,
         which stay bright for outdoor daytime readability rather than
         following the OS dark-mode setting. -->
    <div class="sticky top-0 z-10 bg-white rounded-b-[1.75rem] shadow-[0_14px_30px_-22px_rgba(15,23,42,0.45)]">
      <div class="px-4 pt-3 pb-2 flex items-center justify-between">
        <div class="flex items-center gap-1.5">
          <picture>
            <source srcset="/assets/logo.webp" type="image/webp">
            <img src="/assets/logo.png" alt="lota" width="22" height="22" class="h-[22px] w-[22px] flex-shrink-0">
          </picture>
          <span class="text-base font-bold leading-none">lota <span class="font-normal text-gray-400">Zen</span></span>
        </div>
        <UDropdown :items="menuItems" :popper="{ placement: 'bottom-end', strategy: 'fixed' }">
          <UButton icon="lucide:menu" size="md" color="gray" variant="ghost" :aria-label="t('tasks.moreActions') || 'Menu'" />
        </UDropdown>
      </div>
      <p v-if="geoStatus === 'denied' && geoHelp" class="mx-4 mb-2.5 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-snug text-amber-900 dark:bg-amber-900/20 dark:text-amber-100">{{ t('tasks.zenGeoHelp') }}</p>
      <div class="px-4 pb-2.5 flex items-center justify-between gap-2">
        <p class="text-xs text-gray-500 flex items-center gap-1.5 min-w-0">
          <span
            class="h-1.5 w-1.5 rounded-full flex-shrink-0"
            :class="geoStatus === 'active' ? 'bg-teal-500' : geoStatus === 'denied' ? 'bg-red-500' : 'bg-gray-400'"
          />
          <span class="truncate">
            <template v-if="geoStatus === 'active'">{{ lastSentAgo ? `${t('tasks.zenLastSent') || 'Last sent'}: ${lastSentAgo}` : (t('tasks.zenLocatingLabel') || 'Locating...') }}</template>
            <template v-else-if="geoStatus === 'denied'">
              {{ t('tasks.zenGeoDenied') || 'Location access denied' }}
              <button type="button" class="ml-1 inline-flex min-h-[2rem] items-center px-1 font-medium text-primary-600 underline dark:text-primary-300" @click="geoHelp = !geoHelp">{{ t('tasks.zenGeoHow') }}</button>
            </template>
            <template v-else-if="geoStatus === 'unsupported'">{{ t('tasks.zenGeoUnsupported') || 'Geolocation not supported' }}</template>
            <template v-else>{{ t('tasks.zenGeoStarting') || 'Starting location...' }}</template>
          </span>
        </p>
        <div class="flex items-center gap-2 flex-shrink-0">
          <span v-if="pendingCount" class="text-[11px] px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-semibold">
            {{ pendingCount }} {{ t('tasks.zenPending') || 'pending' }}
          </span>
          <UButton icon="lucide:locate-fixed" size="md" color="gray" variant="soft" :title="t('tasks.zenRefreshLocation') || 'Refresh location'" :aria-label="t('tasks.zenRefreshLocation') || 'Refresh location'" @click="manualRefreshLocation" />
          <UButton
            icon="lucide:refresh-cw"
            size="md"
            color="gray"
            variant="soft"
            :loading="refreshing"
            :title="t('tasks.zenRefreshList') || 'Refresh list'"
            :aria-label="t('tasks.zenRefreshList') || 'Refresh list'"
            @click="load({ manual: true })"
          />
        </div>
      </div>
      <div v-if="!loading" class="px-4 pb-2 text-xs text-gray-500 flex items-center gap-1.5">
        <UIcon name="lucide:package" class="w-3.5 h-3.5 flex-shrink-0" />
        {{ t('tasks.zenTasksLeft', { count: openTasks.length }) || `${openTasks.length} issues left` }}
      </div>
    </div>

    <PwaInstallModal v-model="isPwaModalOpen" />

    <div v-if="error" class="m-4 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{{ error }}</div>

    <div v-if="loading" class="flex-1 min-h-0 overflow-hidden"><AppSkeleton variant="list" :rows="4" /></div>

    <div v-else-if="!openTasks.length" class="flex-1 flex flex-col items-center justify-center gap-2 text-gray-400 text-center px-6">
      <UIcon name="lucide:coffee" class="w-10 h-10" />
      <p>{{ t('tasks.zenEmpty') || 'No open issues assigned to you right now' }}</p>
    </div>

    <div v-else class="flex-1 overflow-y-auto p-3 space-y-3 pb-safe-or-4">
      <div
        v-for="(task, idx) in openTasks"
        :key="task.id"
        class="rounded-[1.75rem] bg-white"
        :class="[
          idx === 0 ? 'shadow-[inset_0_0_0_2px_rgba(37,99,235,0.45),0_22px_36px_-24px_rgba(37,99,235,0.55)]' : 'shadow-[inset_0_0_0_1px_rgba(15,23,42,0.08),0_14px_28px_-22px_rgba(15,23,42,0.3)]',
        ]"
      >
        <!-- Header: always visible. On the collapsed (later) stops this is the
             whole card -- when, where, what -- and a tap expands it. -->
        <button type="button" class="w-full text-left p-5 pb-3" :aria-expanded="isExpanded(task, idx)" @click="toggleExpanded(task, idx)">
          <div v-if="idx === 0" class="flex items-center gap-1.5 text-[11px] font-bold text-primary-600 uppercase tracking-wide mb-2">
            <UIcon name="lucide:navigation-2" class="w-3.5 h-3.5" />
            {{ t('tasks.zenNextStop') || 'Next stop' }}
          </div>
          <div class="flex items-start justify-between gap-2 mb-1.5">
            <span class="flex items-center gap-1.5 min-w-0 text-[11px] text-gray-400 font-medium">
              <span class="font-mono flex-shrink-0">{{ taskCode(task) }}</span>
              <span class="truncate">· {{ taskTypeBoard(task) }}</span>
            </span>
            <span class="flex items-center gap-1.5 flex-shrink-0">
              <UIcon :name="priorityIcon(task.priority)" :class="['w-3.5 h-3.5', priorityColorClass(task.priority)]" />
              <span v-if="task.dueAt" class="text-xs font-semibold text-gray-600 tabular-nums">
                <template v-if="task.dueFrom">{{ new Date(task.dueFrom).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) }}–</template>{{ new Date(task.dueAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) }}
              </span>
              <UIcon :name="isExpanded(task, idx) ? 'lucide:chevron-up' : 'lucide:chevron-down'" class="w-4 h-4 text-gray-400" />
            </span>
          </div>
          <h2 class="text-base font-semibold leading-snug text-gray-900">{{ maskProfanity(task.title) }}</h2>
          <p v-if="task.textAddress" class="mt-1 text-sm text-gray-600 flex items-start gap-1.5">
            <UIcon name="lucide:map-pin" class="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-400" /><span>{{ task.textAddress }}</span>
          </p>
          <p v-if="task.problemReportedAt" class="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
            <UIcon name="lucide:life-buoy" class="w-3.5 h-3.5" />{{ t('tasks.problemBanner') }}<template v-if="task.problemReason"> · {{ task.problemReason }}</template>
          </p>
        </button>

        <div v-if="isExpanded(task, idx)" class="px-5 pb-5 space-y-3">
          <div v-if="task.description" class="zen-md text-sm text-gray-500 line-clamp-4" v-html="renderMarkdownSafe(maskProfanity(task.description))" />
          <p v-if="task.clientNameSnapshot" class="text-sm font-medium text-gray-700 flex items-center gap-1.5">
            <UIcon name="lucide:user-round" class="w-4 h-4 flex-shrink-0 text-gray-400" />{{ task.clientNameSnapshot }}
          </p>

          <!-- 1. Getting there / reaching the client: two big equal buttons. -->
          <div v-if="(task.lat && task.lng) || textAddressUrl(task) || task.clientPhoneSnapshot" class="grid grid-cols-2 gap-2">
            <button
              v-if="task.lat && task.lng"
              type="button" class="at-btn !py-3 justify-center" @click="openNavigateSheet(task)"
            >
              <UIcon name="lucide:navigation" class="w-4 h-4" />{{ t('tasks.zenNavigate') || 'Navigate' }}
            </button>
            <a v-else-if="textAddressUrl(task)" :href="textAddressUrl(task)!" target="_blank" class="at-btn !py-3 justify-center">
              <UIcon name="lucide:navigation" class="w-4 h-4" />{{ t('tasks.zenNavigate') || 'Navigate' }}
            </a>
            <a v-if="task.clientPhoneSnapshot" :href="`tel:${task.clientPhoneSnapshot}`" class="at-btn !py-3 justify-center">
              <UIcon name="lucide:phone" class="w-4 h-4" />{{ t('tasks.zenCall') || 'Call' }}
            </a>
          </div>

          <!-- 2. The step forward: one full-width thumb target. -->
          <button
            v-if="nextStatus(task)"
            type="button" class="at-btn at-btn--primary w-full justify-center !py-3.5 text-base"
            @click="handleAdvanceClick(task, nextStatus(task)!)"
          >
            <span class="truncate">{{ nextStatus(task)!.label }}</span><UIcon name="lucide:arrow-right" class="w-4 h-4 flex-shrink-0" />
          </button>
          <!-- Deliberately NOT emerald/green: a global CSS rule silently
               rewrites any bg-emerald-*/bg-green-* into a soft near-white
               gradient (meant for light badge surfaces), which made this
               button unreadable regardless of which shade was tried. Also
               deliberately not black/near-black. Indigo is unaffected by
               that remap and reads as a distinct "final" action. -->
          <button
            v-if="terminalStatus(task) && terminalStatus(task)!.key !== nextStatus(task)?.key"
            type="button" class="at-btn w-full justify-center !py-3 !bg-indigo-600 !text-white hover:!bg-indigo-700"
            @click="handleAdvanceClick(task, terminalStatus(task)!)"
          >
            <UIcon name="lucide:check-circle-2" class="w-4 h-4 flex-shrink-0" /><span class="truncate">{{ terminalStatus(task)!.label }}</span>
          </button>

          <!-- 3. Escape hatch, deliberately quiet: not a competing button. -->
          <button
            v-if="!task.problemReportedAt"
            type="button"
            class="mx-auto flex items-center gap-1.5 py-1 text-sm font-medium text-gray-500 hover:text-gray-700"
            @click="openProblem(task)"
          >
            <UIcon name="lucide:life-buoy" class="w-4 h-4" />{{ t('tasks.problemButton') }}
          </button>
        </div>
      </div>
    </div>

    <ReasonModal v-model="reasonOpen" :title="reasonMode === 'problem' ? t('tasks.problemTitle') : (reasonTarget?.isTerminal ? t('tasks.reasonCancelTitle') : t('tasks.reasonStatusTitle'))" :quick="reasonQuick" :busy="reasonBusy" @confirm="onReasonConfirm" />
    <NavigateSheet v-model="isNavigateSheetOpen" :task="navigateTask" :current-position="currentPosition" />
  </div>
</template>

<style scoped>
.zen-md :deep(p) { margin: 0; }
.zen-md :deep(a) { color: rgb(var(--color-primary-500)); text-decoration: underline; }
.zen-md :deep(strong) { font-weight: 600; }
.zen-md :deep(code) { background: rgba(128, 128, 128, 0.15); padding: 0 0.25em; border-radius: 0.2em; }
.zen-md :deep(ul),
.zen-md :deep(ol) { margin: 0; padding-left: 1em; }
/* This is a 3-line clamped preview, not the full reading view -- headings
   stay body-sized (just bolder) so a "# Title" description doesn't blow up
   the card's height budget the way it correctly does in the full detail view. */
.zen-md :deep(h1),
.zen-md :deep(h2),
.zen-md :deep(h3),
.zen-md :deep(h4),
.zen-md :deep(h5),
.zen-md :deep(h6) { font-size: inherit; font-weight: 600; margin: 0; }
</style>
