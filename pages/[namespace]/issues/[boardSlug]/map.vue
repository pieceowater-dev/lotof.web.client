<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useTasksToken } from '@/composables/useTasksToken';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import { taskShortCode, priorityIcon, priorityColorClass } from '@/utils/taskDisplay';
import TaskDetailSlideover from '@/components/tasks/TaskDetailSlideover.vue';
import type { TaskBoard } from '@/api/tasks/board/list';
import type { TaskType } from '@/api/tasks/tasktype/list';
import type { TaskItem } from '@/api/tasks/task/list';
import type { GeoLocation } from '@/api/tasks/geotrack/location';

interface StatusRow { key: string; label: string; isTerminal: boolean; isRequired: boolean }

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const boardSlug = computed(() => route.params.boardSlug as string);
const { token: hubToken } = useAuth();

async function getToken(): Promise<string> {
  const { current } = useTasksToken();
  const token = current();
  if (!token) throw new Error('No tasks token');
  return token;
}

const board = ref<TaskBoard | null>(null);
const boardId = computed(() => board.value?.id || '');
const boardStatuses = computed<StatusRow[]>(() => {
  try {
    const arr = board.value?.statuses ? JSON.parse(board.value.statuses) : [];
    return Array.isArray(arr) ? arr.map((s: any) => ({ key: s.key, label: s.label || s.key, isTerminal: !!s.is_terminal, isRequired: !!s.required })) : [];
  } catch {
    return [];
  }
});

const taskTypes = ref<TaskType[]>([]);
const memberOptions = ref<{ label: string; value: string }[]>([]);
const tasks = ref<TaskItem[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

// Only issues with a location are useful on a map -- everything else has
// nowhere to plot, so the list here is scoped to those (unlike the kanban
// board, which shows every issue regardless).
const locatedTasks = computed(() => tasks.value.filter((tsk) => tsk.lat != null && tsk.lng != null));
// Sorted by the same manual drag order as the kanban board -- a dispatcher
// arranges cards into a route sequence there, and the numbers here (both in
// the list and on the map pins) reflect exactly that order.
const openLocatedTasks = computed(() => {
  return locatedTasks.value
    .filter((tsk) => {
      const status = boardStatuses.value.find((s) => s.key === tsk.status);
      return !status?.isTerminal;
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);
});
const routeNumber = computed(() => {
  const map = new Map<string, number>();
  openLocatedTasks.value.forEach((tsk, idx) => map.set(tsk.id, idx + 1));
  return map;
});

function taskTypeIcon(task: TaskItem): string {
  return taskTypes.value.find((tt) => tt.id === task.taskTypeId)?.icon || 'lucide:shapes';
}

async function loadBoard() {
  const { tasksBoardsList } = await import('@/api/tasks/board/list');
  const token = await getToken();
  const res = await tasksBoardsList(token, nsSlug.value);
  board.value = res.boards.find((b) => b.slug === boardSlug.value) || null;
  if (!board.value) {
    // Stale link (e.g. the board was renamed since, which regenerates its
    // slug) -- land somewhere real instead of an empty page.
    navigateTo(`/${nsSlug.value}/issues`);
  }
}
async function loadTaskTypes() {
  if (!boardId.value) return;
  const token = await getToken();
  const { tasksTaskTypesList } = await import('@/api/tasks/tasktype/list');
  const res = await tasksTaskTypesList(token, nsSlug.value, boardId.value);
  taskTypes.value = res.taskTypes;
}
async function loadMembers() {
  if (!hubToken.value) return;
  const token = await getToken();
  const { loadIssuesStaffMemberOptions } = await import('@/utils/issuesMembers');
  memberOptions.value = await loadIssuesStaffMemberOptions(hubToken.value, token, nsSlug.value);
}
async function loadTasks() {
  if (!boardId.value) return;
  const token = await getToken();
  const { tasksBundle } = await import('@/api/tasks/task/list');
  const res = await tasksBundle(token, nsSlug.value, { boardIds: [boardId.value] }, { length: 'ONE_HUNDRED' });
  tasks.value = res.tasks;
}

// Couriers: anyone with a recent geotrack ping (reported by the Zen PWA),
// not just staff assigned to a task on this board -- a dispatcher wants to
// see where everyone actually is, whether or not they currently hold a task
// here.
const courierLocations = ref<GeoLocation[]>([]);
async function loadCouriers() {
  try {
    const token = await getToken();
    const { tasksCourierLocations } = await import('@/api/tasks/geotrack/location');
    courierLocations.value = await tasksCourierLocations(token, nsSlug.value, []);
  } catch (e) {
    logError('[tasks/map] loadCouriers failed', e);
  }
}

async function loadAll() {
  loading.value = true;
  error.value = null;
  try {
    await loadBoard();
    await Promise.all([loadTaskTypes(), loadMembers(), loadTasks(), loadCouriers()]);
  } catch (e) {
    logError('[tasks/map] load failed', e);
    error.value = getErrorMessage(e, t) || 'Failed to load issues';
  } finally {
    loading.value = false;
  }
}

// --- Leaflet map -----------------------------------------------------
const DEFAULT_CENTER: [number, number] = [43.238293, 76.945465];
const mapEl = ref<HTMLElement | null>(null);
let L: any = null;
let map: any = null;
let markers = new Map<string, any>();

async function initMap() {
  await import('leaflet/dist/leaflet.css');
  L = await import('leaflet');
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: (await import('leaflet/dist/images/marker-icon-2x.png')).default,
    iconUrl: (await import('leaflet/dist/images/marker-icon.png')).default,
    shadowUrl: (await import('leaflet/dist/images/marker-shadow.png')).default,
  });
  map = L.map(mapEl.value as HTMLElement).setView(DEFAULT_CENTER, 11);
  // CartoDB's light basemap instead of raw OSM tiles -- much more muted
  // (pale grays, no billboard-bright landuse fills), reads better alongside
  // this app's light UI and the colored priority pins need to stand out
  // against it.
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 20,
  }).addTo(map);
  syncMarkers();
  syncCourierMarkers();
}

// Priority color, as plain hex rather than Tailwind classes -- this HTML is
// injected straight into a Leaflet pane outside Vue/Tailwind's normal scope.
const PRIORITY_MARKER_COLORS: Record<number, string> = { 0: '#9ca3af', 1: '#3b82f6', 2: '#f59e0b', 3: '#ef4444' };
function numberedIcon(num: number, priority: number, selected: boolean) {
  const size = selected ? 34 : 28;
  const color = PRIORITY_MARKER_COLORS[priority] || PRIORITY_MARKER_COLORS[0];
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};color:#fff;width:${size}px;height:${size}px;border-radius:9999px;display:flex;align-items:center;justify-content:center;font:600 12px sans-serif;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);">${num}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function syncMarkers() {
  if (!map || !L) return;
  for (const marker of markers.values()) marker.remove();
  markers = new Map();
  const bounds: [number, number][] = [];
  for (const task of openLocatedTasks.value) {
    const pos: [number, number] = [task.lat as number, task.lng as number];
    bounds.push(pos);
    const num = routeNumber.value.get(task.id) || 0;
    const marker = L.marker(pos, { icon: numberedIcon(num, task.priority, selectedTaskId.value === task.id) }).addTo(map);
    marker.bindPopup(`<b>#${num} · ${escapeHtml(taskShortCode(boardSlug.value, task.taskNumber))}</b><br>${escapeHtml(task.title)}`);
    marker.on('click', () => { selectedTaskId.value = task.id; });
    markers.set(task.id, marker);
  }
  if (bounds.length) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
}
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
}

// Couriers get their own marker layer, distinct from the numbered task
// pins -- a rounded pin (not a circle, so it never reads as "another stop")
// with the person's initial, dimmed when their last ping has gone stale
// (see IssuesGeoTrackService's own staleness window) rather than just
// vanishing, since "no longer sure where they are" is still useful to know.
let courierMarkers = new Map<string, any>();
function courierLabel(userId: string): string {
  return memberOptions.value.find((m) => m.value === userId)?.label || userId;
}
function courierIcon(userId: string, stale: boolean) {
  const initial = escapeHtml((courierLabel(userId) || '?').slice(0, 1).toUpperCase());
  const bg = stale ? '#9ca3af' : '#3b82f6';
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:30px;height:38px;">
      <svg width="30" height="38" viewBox="0 0 30 38" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 23 15 23s15-12.5 15-23C30 6.7 23.3 0 15 0z" fill="${bg}" stroke="#fff" stroke-width="2"/>
      </svg>
      <div style="position:absolute;top:0;left:0;width:30px;height:30px;display:flex;align-items:center;justify-content:center;color:#fff;font:700 13px sans-serif;">${initial}</div>
    </div>`,
    iconSize: [30, 38],
    iconAnchor: [15, 38],
    popupAnchor: [0, -36],
  });
}
function syncCourierMarkers() {
  if (!map || !L) return;
  for (const marker of courierMarkers.values()) marker.remove();
  courierMarkers = new Map();
  for (const loc of courierLocations.value) {
    const marker = L.marker([loc.lat, loc.lng], { icon: courierIcon(loc.userId, loc.isStale) }).addTo(map);
    marker.bindPopup(`<b>${escapeHtml(courierLabel(loc.userId))}</b><br>${loc.isStale ? escapeHtml(t('tasks.mapCourierStale') || 'Last seen') : escapeHtml(t('tasks.mapCourierActive') || 'Active')} · ${new Date(loc.updatedAt).toLocaleTimeString()}`);
    courierMarkers.set(loc.userId, marker);
  }
}

watch(openLocatedTasks, () => syncMarkers());
watch(courierLocations, () => syncCourierMarkers());

const selectedTaskId = ref<string | null>(null);
watch(selectedTaskId, (id, prevId) => {
  for (const staleId of [id, prevId]) {
    if (!staleId) continue;
    const task = openLocatedTasks.value.find((tsk) => tsk.id === staleId);
    const marker = markers.get(staleId);
    if (task && marker) marker.setIcon(numberedIcon(routeNumber.value.get(task.id) || 0, task.priority, selectedTaskId.value === staleId));
  }
});
function focusTask(task: TaskItem) {
  selectedTaskId.value = task.id;
  const marker = markers.get(task.id);
  if (marker && map) {
    map.setView(marker.getLatLng(), Math.max(map.getZoom(), 15));
    marker.openPopup();
  }
}

const sidebarTab = ref<'tasks' | 'couriers'>('tasks');
const selectedCourierId = ref<string | null>(null);
function focusCourier(loc: GeoLocation) {
  selectedCourierId.value = loc.userId;
  const marker = courierMarkers.get(loc.userId);
  if (marker && map) {
    map.setView(marker.getLatLng(), Math.max(map.getZoom(), 15));
    marker.openPopup();
  }
}

const isDetailOpen = ref(false);
const selectedTask = ref<TaskItem | null>(null);
function openDetail(task: TaskItem) {
  selectedTask.value = task;
  isDetailOpen.value = true;
}
function handleTaskChanged(updated: TaskItem) {
  const idx = tasks.value.findIndex((tsk) => tsk.id === updated.id);
  if (idx !== -1) tasks.value[idx] = updated;
  selectedTask.value = updated;
}
function handleTaskDeleted(id: string) {
  tasks.value = tasks.value.filter((tsk) => tsk.id !== id);
  isDetailOpen.value = false;
}

let courierRefreshTimer: ReturnType<typeof setInterval> | null = null;

onMounted(async () => {
  await loadAll();
  await initMap();
  const focusCode = route.query.task;
  if (typeof focusCode === 'string') {
    const match = tasks.value.find((tsk) => taskShortCode(boardSlug.value, tsk.taskNumber) === focusCode.toUpperCase());
    if (match) focusTask(match);
  }
  // Couriers move; a one-time load on page open would just show where
  // everyone was standing when the dispatcher happened to open the map.
  courierRefreshTimer = setInterval(loadCouriers, 20000);
});
onBeforeUnmount(() => {
  if (courierRefreshTimer) clearInterval(courierRefreshTimer);
  map?.remove();
});
</script>

<template>
  <div class="h-full flex flex-col p-4 pb-safe-or-4 min-h-0">
    <div class="flex items-center gap-2 mb-4 flex-shrink-0">
      <UButton icon="lucide:arrow-left" size="xs" color="gray" variant="soft" :to="`/${nsSlug}/issues/${boardSlug}`">
        {{ t('app.back') || 'Back' }}
      </UButton>
      <h1 class="text-2xl font-semibold truncate">{{ t('tasks.mapView') || 'Map view' }} — {{ board?.name || '...' }}</h1>
      <span v-if="courierLocations.length" class="flex items-center gap-1.5 text-xs text-gray-500 flex-shrink-0 ml-auto">
        <span class="h-2.5 w-2.5 rounded-full bg-blue-500 border border-white shadow-sm" />
        {{ courierLocations.length }} {{ t('tasks.mapCouriers') || 'Couriers' }}
      </span>
    </div>

    <div v-if="error" class="mb-3 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm px-3 py-2">
      {{ error }}
    </div>

    <div v-if="loading" class="flex-1 flex items-center justify-center text-gray-400">
      <UIcon name="lucide:loader-2" class="w-6 h-6 animate-spin" />
    </div>

    <!-- List gets roughly a third of the width, the map the rest. -->
    <div v-else class="flex-1 min-h-0 flex flex-col md:flex-row gap-3">
      <div class="w-full md:w-1/3 flex-shrink-0 min-h-0 flex flex-col">
        <div class="flex-shrink-0 mb-2 flex rounded-lg bg-gray-100 dark:bg-gray-800 p-0.5 text-sm">
          <button
            type="button"
            class="flex-1 rounded-md px-2 py-1.5 font-medium transition-colors"
            :class="sidebarTab === 'tasks' ? 'bg-white dark:bg-gray-900 shadow-sm' : 'text-gray-500 dark:text-gray-400'"
            @click="sidebarTab = 'tasks'"
          >
            {{ t('tasks.mapTasksTab') || 'Tasks' }} ({{ openLocatedTasks.length }})
          </button>
          <button
            type="button"
            class="flex-1 rounded-md px-2 py-1.5 font-medium transition-colors"
            :class="sidebarTab === 'couriers' ? 'bg-white dark:bg-gray-900 shadow-sm' : 'text-gray-500 dark:text-gray-400'"
            @click="sidebarTab = 'couriers'"
          >
            {{ t('tasks.mapCouriers') || 'Couriers' }} ({{ courierLocations.length }})
          </button>
        </div>
        <div class="flex-1 min-h-0 overflow-y-auto space-y-2">
          <template v-if="sidebarTab === 'tasks'">
            <p v-if="!openLocatedTasks.length" class="text-sm text-gray-400 text-center py-8">
              {{ t('tasks.noLocatedTasks') || 'No open issues with a location yet' }}
            </p>
            <button
              v-for="task in openLocatedTasks"
              :key="task.id"
              type="button"
              class="w-full text-left rounded-lg border p-2.5 transition-all"
              :class="selectedTaskId === task.id
                ? 'border-primary-400 bg-primary-50 dark:bg-primary-950/30'
                : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-primary-300 dark:hover:border-primary-700'"
              @click="focusTask(task)"
              @dblclick="openDetail(task)"
            >
              <div class="flex items-center gap-1.5 text-[11px] text-gray-400 mb-1">
                <UIcon :name="taskTypeIcon(task)" class="w-3.5 h-3.5" />
                <span class="font-mono">{{ taskShortCode(boardSlug, task.taskNumber) }}</span>
              </div>
              <div class="flex items-start justify-between gap-2">
                <span class="text-sm font-medium leading-snug line-clamp-2">{{ task.title }}</span>
                <UIcon :name="priorityIcon(task.priority)" :class="['w-4 h-4 flex-shrink-0 mt-0.5', priorityColorClass(task.priority)]" />
              </div>
              <p v-if="task.textAddress" class="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5 flex items-center gap-1">
                <UIcon name="lucide:map-pin" class="w-3 h-3 flex-shrink-0" />{{ task.textAddress }}
              </p>
            </button>
          </template>
          <template v-else>
            <p v-if="!courierLocations.length" class="text-sm text-gray-400 text-center py-8">
              {{ t('tasks.noCouriers') || 'No staff location pings yet' }}
            </p>
            <button
              v-for="loc in courierLocations"
              :key="loc.userId"
              type="button"
              class="w-full text-left rounded-lg border p-2.5 transition-all flex items-center gap-2.5"
              :class="selectedCourierId === loc.userId
                ? 'border-primary-400 bg-primary-50 dark:bg-primary-950/30'
                : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-primary-300 dark:hover:border-primary-700'"
              @click="focusCourier(loc)"
            >
              <span
                class="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold text-white"
                :class="loc.isStale ? 'bg-gray-400' : 'bg-blue-500'"
              >{{ courierLabel(loc.userId).slice(0, 1).toUpperCase() }}</span>
              <div class="min-w-0">
                <p class="text-sm font-medium truncate">{{ courierLabel(loc.userId) }}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <span class="h-1.5 w-1.5 rounded-full" :class="loc.isStale ? 'bg-gray-400' : 'bg-blue-500'" />
                  {{ loc.isStale ? (t('tasks.mapCourierStale') || 'Last seen') : (t('tasks.mapCourierActive') || 'Active') }} · {{ new Date(loc.updatedAt).toLocaleTimeString() }}
                </p>
              </div>
            </button>
          </template>
        </div>
      </div>
      <!-- isolate: Leaflet's own controls/panes use z-index up to 1000,
           which otherwise floats above the task detail slideover (a much
           lower z-index) since they're both just descendants of body with
           no stacking context between them. Isolation contains Leaflet's
           stacking entirely inside this box. -->
      <div class="flex-1 min-h-[300px] md:min-h-0" style="isolation: isolate;">
        <div ref="mapEl" class="w-full h-full rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800" />
      </div>
    </div>

    <TaskDetailSlideover
      v-model="isDetailOpen"
      :task="selectedTask"
      :board-statuses="boardStatuses"
      :task-types="taskTypes"
      :member-options="memberOptions"
      :ns-slug="nsSlug"
      :board-slug="boardSlug"
      @changed="handleTaskChanged"
      @deleted="handleTaskDeleted"
    />
  </div>
</template>
