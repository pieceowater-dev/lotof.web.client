<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useTasksToken } from '@/composables/useTasksToken';
import { usePwaInstall } from '@/composables/usePwaInstall';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import { priorityIcon, priorityColorClass, taskShortCode, blockingRequiredStatuses } from '@/utils/taskDisplay';
import { renderMarkdownSafe } from '@/utils/renderMarkdown';
import PwaInstallModal from '@/components/tasks/PwaInstallModal.vue';
import NavigateSheet from '@/components/tasks/NavigateSheet.vue';
import type { TaskItem } from '@/api/tasks/task/list';
import type { TaskBoard } from '@/api/tasks/board/list';

definePageMeta({ layout: false });

const { isStandalone } = usePwaInstall();
const isPwaModalOpen = ref(false);

interface StatusRow { key: string; label: string; isTerminal: boolean; isRequired: boolean }

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const { user: currentUser } = useAuth();

useHead({ title: 'Zen — Issues' });

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
      map[b.id] = Array.isArray(arr) ? arr.map((s: any) => ({ key: s.key, label: s.label || s.key, isTerminal: !!s.is_terminal, isRequired: !!s.required })) : [];
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
interface QueuedAction { id: string; taskId: string; status: string; isTerminal: boolean }

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
    const updated = await tasksUpdateTaskStatus(token, nsSlug.value, { taskId: action.taskId, status: action.status, isTerminal: action.isTerminal });
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
  advanceStatus(task, target);
}

async function advanceStatus(task: TaskItem, target: StatusRow) {
  const action: QueuedAction = { id: `${task.id}:${Date.now()}`, taskId: task.id, status: target.key, isTerminal: target.isTerminal };
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
    <div class="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
      <div class="px-4 pt-3 pb-2 flex items-center justify-between">
        <div class="flex items-center gap-1.5">
          <picture>
            <source srcset="/assets/logo.webp" type="image/webp">
            <img src="/assets/logo.png" alt="lota" width="22" height="22" class="h-[22px] w-[22px] flex-shrink-0">
          </picture>
          <span class="text-base font-bold leading-none">lota <span class="font-normal text-gray-400">Zen</span></span>
        </div>
        <UDropdown :items="menuItems" :popper="{ placement: 'bottom-end', strategy: 'fixed' }">
          <UButton icon="lucide:menu" size="sm" color="gray" variant="ghost" />
        </UDropdown>
      </div>
      <div class="px-4 pb-2.5 flex items-center justify-between gap-2">
        <p class="text-xs text-gray-500 flex items-center gap-1.5 min-w-0">
          <span
            class="h-1.5 w-1.5 rounded-full flex-shrink-0"
            :class="geoStatus === 'active' ? 'bg-teal-500' : geoStatus === 'denied' ? 'bg-red-500' : 'bg-gray-400'"
          />
          <span class="truncate">
            <template v-if="geoStatus === 'active'">{{ lastSentAgo ? `${t('tasks.zenLastSent') || 'Last sent'}: ${lastSentAgo}` : (t('tasks.zenLocatingLabel') || 'Locating...') }}</template>
            <template v-else-if="geoStatus === 'denied'">{{ t('tasks.zenGeoDenied') || 'Location access denied' }}</template>
            <template v-else-if="geoStatus === 'unsupported'">{{ t('tasks.zenGeoUnsupported') || 'Geolocation not supported' }}</template>
            <template v-else>{{ t('tasks.zenGeoStarting') || 'Starting location...' }}</template>
          </span>
        </p>
        <div class="flex items-center gap-2 flex-shrink-0">
          <span v-if="pendingCount" class="text-[11px] px-2 py-1 rounded-full bg-amber-50 text-amber-700 font-medium">
            {{ pendingCount }} {{ t('tasks.zenPending') || 'pending' }}
          </span>
          <UButton icon="lucide:locate-fixed" size="xs" color="gray" variant="soft" :title="t('tasks.zenRefreshLocation') || 'Refresh location'" @click="manualRefreshLocation" />
          <UButton
            icon="lucide:refresh-cw"
            size="xs"
            color="gray"
            variant="soft"
            :loading="refreshing"
            :title="t('tasks.zenRefreshList') || 'Refresh list'"
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

    <div v-if="loading" class="flex-1 flex items-center justify-center text-gray-400">
      <UIcon name="lucide:loader-2" class="w-6 h-6 animate-spin" />
    </div>

    <div v-else-if="!openTasks.length" class="flex-1 flex flex-col items-center justify-center gap-2 text-gray-400 text-center px-6">
      <UIcon name="lucide:coffee" class="w-10 h-10" />
      <p>{{ t('tasks.zenEmpty') || 'No open issues assigned to you right now' }}</p>
    </div>

    <div v-else class="flex-1 overflow-y-auto p-3 space-y-3 pb-safe-or-4">
      <div
        v-for="(task, idx) in openTasks"
        :key="task.id"
        class="rounded-2xl bg-white p-4"
        :class="idx === 0 ? 'border-2 border-primary-400 shadow-md' : 'border border-gray-100 shadow-sm'"
      >
        <div v-if="idx === 0" class="flex items-center gap-1.5 text-[11px] font-bold text-primary-600 uppercase tracking-wide mb-2">
          <UIcon name="lucide:navigation-2" class="w-3.5 h-3.5" />
          {{ t('tasks.zenNextStop') || 'Next stop' }}
        </div>
        <div class="flex items-start justify-between gap-2 mb-1.5">
          <span class="flex items-center gap-1.5 min-w-0 text-[11px] text-gray-400 font-medium">
            <span class="font-mono flex-shrink-0">{{ taskCode(task) }}</span>
            <span class="truncate">· {{ taskTypeBoard(task) }}</span>
          </span>
          <span class="flex items-center gap-1 flex-shrink-0">
            <UIcon :name="priorityIcon(task.priority)" :class="['w-3.5 h-3.5', priorityColorClass(task.priority)]" />
            <span v-if="task.dueAt" class="text-[11px] text-gray-400">{{ new Date(task.dueAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) }}</span>
          </span>
        </div>
        <h2 class="text-base font-semibold leading-snug mb-1 text-gray-900">{{ task.title }}</h2>
        <div v-if="task.description" class="zen-md text-sm text-gray-500 mb-2 line-clamp-3" v-html="renderMarkdownSafe(task.description)" />
        <p v-if="task.textAddress" class="text-sm text-gray-600 flex items-center gap-1.5 mb-1">
          <UIcon name="lucide:map-pin" class="w-4 h-4 flex-shrink-0 text-gray-400" />{{ task.textAddress }}
        </p>
        <p v-if="task.clientNameSnapshot" class="text-sm text-gray-600 mb-2">{{ task.clientNameSnapshot }}</p>

        <div class="flex items-center gap-2 mt-3 flex-wrap">
          <a
            v-if="task.clientPhoneSnapshot"
            :href="`tel:${task.clientPhoneSnapshot}`"
            class="flex items-center gap-1.5 rounded-xl bg-gray-100 text-gray-700 px-3 py-2 text-sm font-medium hover:bg-gray-200 transition-colors flex-shrink-0"
          >
            <UIcon name="lucide:phone" class="w-4 h-4" />{{ t('tasks.zenCall') || 'Call' }}
          </a>
          <button
            v-if="task.lat && task.lng"
            type="button"
            class="flex items-center gap-1.5 rounded-xl bg-gray-100 text-gray-700 px-3 py-2 text-sm font-medium hover:bg-gray-200 transition-colors flex-shrink-0"
            @click="openNavigateSheet(task)"
          >
            <UIcon name="lucide:navigation" class="w-4 h-4" />{{ t('tasks.zenNavigate') || 'Navigate' }}
          </button>
          <a
            v-else-if="textAddressUrl(task)"
            :href="textAddressUrl(task)!"
            target="_blank"
            class="flex items-center gap-1.5 rounded-xl bg-gray-100 text-gray-700 px-3 py-2 text-sm font-medium hover:bg-gray-200 transition-colors flex-shrink-0"
          >
            <UIcon name="lucide:navigation" class="w-4 h-4" />{{ t('tasks.zenNavigate') || 'Navigate' }}
          </a>
          <button
            v-if="nextStatus(task)"
            type="button"
            class="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 rounded-xl bg-primary-600 text-white px-3 py-2.5 text-sm font-semibold hover:bg-primary-700 transition-colors whitespace-nowrap"
            @click="handleAdvanceClick(task, nextStatus(task)!)"
          >
            <UIcon name="lucide:arrow-right" class="w-4 h-4 flex-shrink-0" /><span class="truncate">{{ nextStatus(task)!.label }}</span>
          </button>
          <!-- Deliberately NOT emerald/green: a global CSS rule silently
               rewrites any bg-emerald-*/bg-green-* into a soft near-white
               gradient (meant for light badge surfaces), which made this
               button unreadable regardless of which shade was tried. Also
               deliberately not black/near-black. Indigo is unaffected by
               that remap and reads as a distinct "final" action next to the
               blue "next status" button above. -->
          <button
            v-if="terminalStatus(task) && terminalStatus(task)!.key !== nextStatus(task)?.key"
            type="button"
            class="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 text-white px-3 py-2.5 text-sm font-semibold hover:bg-indigo-700 transition-colors whitespace-nowrap"
            @click="handleAdvanceClick(task, terminalStatus(task)!)"
          >
            <UIcon name="lucide:check-circle-2" class="w-4 h-4 flex-shrink-0" /><span class="truncate">{{ terminalStatus(task)!.label }}</span>
          </button>
        </div>
      </div>
    </div>

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
