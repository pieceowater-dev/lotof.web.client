<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useMenuToken } from '@/composables/useMenuToken';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import AppTable from '@/components/ui/AppTable.vue';
import CreateOrderModal from '@/components/menu/CreateOrderModal.vue';
import OrderDetailModal from '@/components/menu/OrderDetailModal.vue';
import { formatDisplayPhoneUniversal } from '@/utils/phone';
import { smartOrderNumber } from '@/utils/orderNumber';
import { statusBadgeStyle, nextStatuses } from '@/utils/orderStatus';
import type { MenuOrder, OrdersSummary } from '@/api/menu/order/list';
import type { MenuBranch } from '@/api/menu/branch/list';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);

const STATUSES = ['NEW', 'ACCEPTED', 'IN_PREPARATION', 'READY', 'DELIVERING', 'COMPLETED', 'CANCELLED'] as const;

// Orders with no sourceTag weren't placed through any tracked share link —
// they came in by phone, walk-in, or the bare menu URL, i.e. handled
// directly rather than through a marketing channel. The backend's sourceTag
// column has no NULL-vs-empty distinction worth exposing, so this sentinel
// (never a real share link's tag — see loadSourceTagOptions) stands in for
// "no tag" on both the quick-filter card and the source filter dropdown.
const MANUAL_SOURCE_TAG = '__manual__';

const statusLabel = (s: string) => ({
  NEW: t('menu.statusNew') || 'New',
  ACCEPTED: t('menu.statusAccepted') || 'Accepted',
  IN_PREPARATION: t('menu.statusInPreparation') || 'Preparing',
  READY: t('menu.statusReady') || 'Ready',
  DELIVERING: t('menu.statusDelivering') || 'On the way',
  COMPLETED: t('menu.statusCompleted') || 'Completed',
  CANCELLED: t('menu.statusCancelled') || 'Cancelled',
}[s] || s);

const statusColor = (s: string): any => ({
  NEW: 'blue',
  ACCEPTED: 'primary',
  IN_PREPARATION: 'amber',
  READY: 'teal',
  DELIVERING: 'violet',
  COMPLETED: 'emerald',
  CANCELLED: 'red',
}[s] || 'gray');

const CARD_STYLE: Record<string, { icon: string; active: string; iconBg: string; iconColor: string; checkColor: string }> = {
  NEW: {
    icon: 'lucide:inbox',
    active: 'border-blue-300 bg-blue-50 shadow-sm dark:border-blue-700 dark:bg-blue-950/30',
    iconBg: 'bg-blue-100 dark:bg-blue-900/40',
    iconColor: 'text-blue-600 dark:text-blue-300',
    checkColor: 'text-blue-300 dark:text-blue-700',
  },
  ACCEPTED: {
    icon: 'lucide:check',
    active: 'border-primary-300 bg-primary-50 shadow-sm dark:border-primary-700 dark:bg-primary-950/30',
    iconBg: 'bg-primary-100 dark:bg-primary-900/40',
    iconColor: 'text-primary-600 dark:text-primary-300',
    checkColor: 'text-primary-300 dark:text-primary-700',
  },
  IN_PREPARATION: {
    icon: 'lucide:hourglass',
    active: 'border-amber-300 bg-amber-50 shadow-sm dark:border-amber-700 dark:bg-amber-950/30',
    iconBg: 'bg-amber-100 dark:bg-amber-900/40',
    iconColor: 'text-amber-600 dark:text-amber-300',
    checkColor: 'text-amber-300 dark:text-amber-700',
  },
  READY: {
    icon: 'lucide:package-check',
    active: 'border-teal-300 bg-teal-50 shadow-sm dark:border-teal-700 dark:bg-teal-950/30',
    iconBg: 'bg-teal-100 dark:bg-teal-900/40',
    iconColor: 'text-teal-600 dark:text-teal-300',
    checkColor: 'text-teal-300 dark:text-teal-700',
  },
  DELIVERING: {
    icon: 'lucide:truck',
    active: 'border-violet-300 bg-violet-50 shadow-sm dark:border-violet-700 dark:bg-violet-950/30',
    iconBg: 'bg-violet-100 dark:bg-violet-900/40',
    iconColor: 'text-violet-600 dark:text-violet-300',
    checkColor: 'text-violet-300 dark:text-violet-700',
  },
  COMPLETED: {
    icon: 'lucide:check-check',
    active: 'border-emerald-300 bg-emerald-50 shadow-sm dark:border-emerald-700 dark:bg-emerald-950/30',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
    iconColor: 'text-emerald-600 dark:text-emerald-300',
    checkColor: 'text-emerald-300 dark:text-emerald-700',
  },
  CANCELLED: {
    icon: 'lucide:x',
    active: 'border-red-300 bg-red-50 shadow-sm dark:border-red-700 dark:bg-red-950/30',
    iconBg: 'bg-red-100 dark:bg-red-900/40',
    iconColor: 'text-red-600 dark:text-red-300',
    checkColor: 'text-red-300 dark:text-red-700',
  },
};
const ALL_CARD_STYLE = {
  icon: 'lucide:layout-grid',
  active: 'border-primary-300 bg-primary-50 shadow-sm dark:border-primary-700 dark:bg-primary-950/30',
  iconBg: 'bg-primary-100 dark:bg-primary-900/40',
  iconColor: 'text-primary-600 dark:text-primary-300',
  checkColor: 'text-primary-300 dark:text-primary-700',
};
const CARD_INACTIVE = 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700';
const CARD_INACTIVE_ICON_BG = 'bg-gray-100 dark:bg-gray-800';
const CARD_INACTIVE_ICON_COLOR = 'text-gray-500 dark:text-gray-400';

function cardStyle(s: string) {
  return CARD_STYLE[s] || ALL_CARD_STYLE;
}

const orders = ref<MenuOrder[]>([]);
const totalCount = ref(0);
const loading = ref(false);
const error = ref<string | null>(null);

const branches = ref<MenuBranch[]>([]);
const selectedBranchIds = ref<string[]>([]);
const selectedStatuses = ref<string[]>([]);
const search = ref('');
const statusCounts = ref<Record<string, number>>({});

// Quick filter: order type. Full-panel filters (source tag + date ranges)
// are separate — those are for building a report over a period, not for
// everyday triage, so they live behind an explicit "More filters" toggle
// instead of competing for space in the always-visible bar.
const selectedType = ref<'' | 'delivery' | 'pickup'>('');
const isFilterPanelOpen = ref(false);
const sourceTagFilter = ref('');
const createdFrom = ref('');
const createdTo = ref('');
const closedFrom = ref('');
const closedTo = ref('');
const appliedFilterPanel = reactive({ sourceTag: '', createdFrom: '', createdTo: '', closedFrom: '', closedTo: '' });
const hasActiveFilterPanel = computed(() => Object.values(appliedFilterPanel).some((v) => v));

// Known source tags, pulled from saved share links, so the filter is a
// selector of real tracking sources instead of free text prone to typos.
// The filter still submits the raw sourceTag (what orders are actually
// searchable by) — only the dropdown's displayed text uses the link's
// human-readable label instead of that tag. When multiple links share one
// tag, the first label seen wins.
const sourceTagOptions = ref<{ sourceTag: string; label: string }[]>([]);
async function loadSourceTagOptions() {
  try {
    const menuToken = await getToken();
    const { menuShareLinksList } = await import('@/api/menu/sharelink/list');
    const links = await menuShareLinksList(menuToken, nsSlug.value);
    const byTag = new Map<string, string>();
    for (const l of links) {
      if (!l.sourceTag || byTag.has(l.sourceTag)) continue;
      byTag.set(l.sourceTag, l.label || l.sourceTag);
    }
    sourceTagOptions.value = [...byTag.entries()]
      .map(([sourceTag, label]) => ({ sourceTag, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  } catch (e) {
    logError('[menu/index] loadSourceTagOptions failed', e);
  }
}

const summary = ref<OrdersSummary | null>(null);

// Row selection: when the user checks specific orders, the footer switches
// from "every order matching the filters" to "just these" — useful for
// pulling a total on an arbitrary hand-picked subset the filters can't
// express (e.g. "these 5 orders the courier is taking this run").
const selectedOrders = ref<MenuOrder[]>([]);
const selectedSummary = computed(() => {
  if (!selectedOrders.value.length) return null;
  return {
    count: selectedOrders.value.length,
    totalAmount: selectedOrders.value.reduce((sum, o) => sum + o.totalAmount, 0),
  };
});

// Quick filters (status/branch/type) persist across visits so the admin
// doesn't have to re-apply "just my branch, just new orders" every time
// they open the page. Scoped per-namespace since branch IDs differ.
const FILTERS_STORAGE_KEY = computed(() => `menu:quickFilters:${nsSlug.value}`);
let restoringFilters = false;
function restoreQuickFilters() {
  if (!process.client) return;
  try {
    const raw = localStorage.getItem(FILTERS_STORAGE_KEY.value);
    if (!raw) return;
    const saved = JSON.parse(raw);
    restoringFilters = true;
    if (Array.isArray(saved.selectedStatuses)) selectedStatuses.value = saved.selectedStatuses;
    if (Array.isArray(saved.selectedBranchIds)) selectedBranchIds.value = saved.selectedBranchIds;
    if (saved.selectedType === '' || saved.selectedType === 'delivery' || saved.selectedType === 'pickup') {
      selectedType.value = saved.selectedType;
    }
  } catch (e) {
    logError('[menu/index] restoreQuickFilters failed', e);
  } finally {
    restoringFilters = false;
  }
}
function persistQuickFilters() {
  if (!process.client || restoringFilters) return;
  localStorage.setItem(FILTERS_STORAGE_KEY.value, JSON.stringify({
    selectedStatuses: selectedStatuses.value,
    selectedBranchIds: selectedBranchIds.value,
    selectedType: selectedType.value,
  }));
}
watch([selectedStatuses, selectedBranchIds, selectedType], persistQuickFilters, { deep: true });

function dateInputToRfc3339(dateStr: string, endOfDay = false): string | undefined {
  if (!dateStr) return undefined;
  return endOfDay ? `${dateStr}T23:59:59Z` : `${dateStr}T00:00:00Z`;
}

const currentFilterParams = computed(() => ({
  statuses: selectedStatuses.value,
  branchIds: selectedBranchIds.value,
  search: search.value.trim() || undefined,
  types: selectedType.value ? [selectedType.value] : undefined,
  sourceTag: appliedFilterPanel.sourceTag || undefined,
  createdFrom: dateInputToRfc3339(appliedFilterPanel.createdFrom),
  createdTo: dateInputToRfc3339(appliedFilterPanel.createdTo, true),
  closedFrom: dateInputToRfc3339(appliedFilterPanel.closedFrom),
  closedTo: dateInputToRfc3339(appliedFilterPanel.closedTo, true),
}));

function applyFilterPanel() {
  appliedFilterPanel.sourceTag = sourceTagFilter.value.trim();
  appliedFilterPanel.createdFrom = createdFrom.value;
  appliedFilterPanel.createdTo = createdTo.value;
  appliedFilterPanel.closedFrom = closedFrom.value;
  appliedFilterPanel.closedTo = closedTo.value;
  isFilterPanelOpen.value = false;
  loadOrders();
  loadSummary();
}

function clearFilterPanel() {
  sourceTagFilter.value = '';
  createdFrom.value = '';
  createdTo.value = '';
  closedFrom.value = '';
  closedTo.value = '';
  applyFilterPanel();
}

const branchOptions = computed(() => branches.value.map((b) => ({ label: b.name, value: b.id })));
const branchSelectLabel = computed(() => {
  if (selectedBranchIds.value.length === 0) return t('menu.allBranches') || 'All branches';
  if (selectedBranchIds.value.length === 1) {
    return branches.value.find((b) => b.id === selectedBranchIds.value[0])?.name || (t('menu.allBranches') || 'All branches');
  }
  return `${selectedBranchIds.value.length} ${t('menu.branchesSelected') || 'branches selected'}`;
});

async function getToken(): Promise<string> {
  const { current } = useMenuToken();
  const menuToken = current();
  if (!menuToken) throw new Error('No menu token');
  return menuToken;
}

async function loadBranches() {
  try {
    const menuToken = await getToken();
    const { menuBranchesList } = await import('@/api/menu/branch/list');
    const res = await menuBranchesList(menuToken, nsSlug.value);
    branches.value = res.branches;
  } catch (e) {
    logError('[menu/index] loadBranches failed', e);
  }
}

let searchDebounce: ReturnType<typeof setTimeout> | null = null;

async function loadOrders(opts: { silent?: boolean } = {}) {
  if (!opts.silent) loading.value = true;
  error.value = null;
  try {
    const menuToken = await getToken();
    const { menuOrdersList } = await import('@/api/menu/order/list');
    const res = await menuOrdersList(menuToken, nsSlug.value, {
      ...currentFilterParams.value,
      length: 'FIFTY',
    });
    orders.value = res.orders;
    totalCount.value = res.count;
    // A real (non-silent) reload means the filters/search changed — the
    // previous selection almost certainly no longer matches what's on
    // screen, so drop it rather than leave a stale, invisible selection
    // driving the summary footer. Silent background polls leave it alone.
    if (!opts.silent) selectedOrders.value = [];
  } catch (e) {
    logError('[menu/index] loadOrders failed', e);
    if (!opts.silent) error.value = getErrorMessage(e) || 'Failed to load orders';
  } finally {
    if (!opts.silent) loading.value = false;
  }
}

async function loadSummary() {
  try {
    const menuToken = await getToken();
    const { menuOrdersSummary } = await import('@/api/menu/order/list');
    summary.value = await menuOrdersSummary(menuToken, nsSlug.value, currentFilterParams.value);
  } catch (e) {
    logError('[menu/index] loadSummary failed', e);
  }
}

async function loadStatusCounts() {
  try {
    const menuToken = await getToken();
    const { menuOrdersList } = await import('@/api/menu/order/list');
    const results = await Promise.all(
      STATUSES.map((s) =>
        menuOrdersList(menuToken, nsSlug.value, {
          statuses: [s],
          branchIds: selectedBranchIds.value,
          types: selectedType.value ? [selectedType.value] : undefined,
          length: 'TEN',
        }).then((r) => [s, r.count] as const).catch(() => [s, 0] as const)
      )
    );
    statusCounts.value = Object.fromEntries(results);
  } catch (e) {
    logError('[menu/index] loadStatusCounts failed', e);
  }
  loadManualOrdersCount();
}

const manualOrdersCount = ref(0);
async function loadManualOrdersCount() {
  try {
    const menuToken = await getToken();
    const { menuOrdersList } = await import('@/api/menu/order/list');
    const res = await menuOrdersList(menuToken, nsSlug.value, {
      sourceTag: MANUAL_SOURCE_TAG,
      branchIds: selectedBranchIds.value,
      types: selectedType.value ? [selectedType.value] : undefined,
      length: 'TEN',
    });
    manualOrdersCount.value = res.count;
  } catch (e) {
    logError('[menu/index] loadManualOrdersCount failed', e);
  }
}

const isManualFilterActive = computed(() => appliedFilterPanel.sourceTag === MANUAL_SOURCE_TAG);
function toggleManualFilter() {
  const next = isManualFilterActive.value ? '' : MANUAL_SOURCE_TAG;
  sourceTagFilter.value = next;
  appliedFilterPanel.sourceTag = next;
  loadOrders();
  loadSummary();
}

function toggleStatus(s: string) {
  const idx = selectedStatuses.value.indexOf(s);
  if (idx === -1) selectedStatuses.value = [...selectedStatuses.value, s];
  else selectedStatuses.value = selectedStatuses.value.filter((v) => v !== s);
  loadOrders();
  loadSummary();
}

function clearStatuses() {
  selectedStatuses.value = [];
  loadOrders();
  loadSummary();
}

watch(selectedBranchIds, () => {
  loadOrders();
  loadStatusCounts();
  loadSummary();
});

watch(selectedType, () => {
  loadOrders();
  loadStatusCounts();
  loadSummary();
});

watch(search, () => {
  if (searchDebounce) clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => { loadOrders(); loadSummary(); }, 400);
});

const columns = computed(() => [
  { key: 'number', label: t('menu.orderNumber') || 'Order #', sortable: true },
  { key: 'customerName', label: t('menu.customer') || 'Customer' },
  { key: 'phone', label: t('menu.phone') || 'Phone' },
  { key: 'type', label: t('menu.type') || 'Type' },
  { key: 'status', label: t('menu.status') || 'Status' },
  { key: 'totalAmount', label: t('menu.total') || 'Total', sortable: true },
  { key: 'createdAt', label: t('menu.createdAt') || 'Created', sortable: true },
  { key: 'actions', label: '' },
]);

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    const isToday = d.toDateString() === new Date().toDateString();
    return isToday
      ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ', ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function initialFor(order: MenuOrder): string {
  return (order.customerName || order.phone || '?').slice(0, 1).toUpperCase();
}

async function copyOrderLink(order: MenuOrder) {
  const url = `${window.location.origin}/${nsSlug.value}/menu?order=${smartOrderNumber(order)}`;
  try {
    await navigator.clipboard.writeText(url);
    useToast().add({ title: t('menu.linkCopied') || 'Link copied', color: 'primary' });
  } catch (e) {
    logError('[menu/index] copyOrderLink failed', e);
  }
}

// Deep-link support: ?order=<smart number> opens that order's detail on
// load, so shared/bookmarked order links (written back by OrderDetailModal
// while it's open) actually resolve to something on a fresh page load. The
// smart number is "YYMMDD-NNN" — NNN is the actual daily order number the
// backend understands for search, so we parse that trailing segment back
// out. It isn't globally unique on its own (resets daily), so on a
// collision this opens the most recently created match, which is the
// overwhelmingly common case for a link someone just shared.
async function openFromQuery() {
  const raw = route.query.order as string | undefined;
  if (!raw) return;
  const numericPart = raw.includes('-') ? raw.slice(raw.lastIndexOf('-') + 1) : raw;
  const orderNumber = Number(numericPart);
  if (Number.isNaN(orderNumber)) return;
  const existing = orders.value.find((o) => o.number === orderNumber);
  if (existing) {
    openDetail(existing);
    return;
  }
  try {
    const menuToken = await getToken();
    const { menuOrdersList } = await import('@/api/menu/order/list');
    const res = await menuOrdersList(menuToken, nsSlug.value, { search: String(orderNumber), length: 'TEN' });
    const matches = res.orders.filter((o) => o.number === orderNumber);
    matches.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (matches[0]) openDetail(matches[0]);
  } catch (e) {
    logError('[menu/index] openFromQuery failed', e);
  }
}

// Soft "live" refresh: poll the list (and summary) on a short interval so
// new/updated orders show up without a manual reload — a full GraphQL
// subscription would need a new pub/sub + WebSocket transport on the
// backend for a single-tenant admin table, so this gets the same
// user-facing result more cheaply. Skipped entirely while the detail modal
// is open so an in-progress status change/comment edit never gets
// clobbered by a background refresh, and skipped when the user has turned
// the toggle off.
let pollTimer: ReturnType<typeof setInterval> | null = null;

const liveUpdatesEnabled = ref(true);
const LIVE_UPDATES_STORAGE_KEY = computed(() => `menu:liveUpdates:${nsSlug.value}`);
function restoreLiveUpdatesPref() {
  if (!process.client) return;
  try {
    const raw = localStorage.getItem(LIVE_UPDATES_STORAGE_KEY.value);
    if (raw !== null) liveUpdatesEnabled.value = raw === '1';
  } catch (e) {
    logError('[menu/index] restoreLiveUpdatesPref failed', e);
  }
}
watch(liveUpdatesEnabled, (v) => {
  if (!process.client) return;
  localStorage.setItem(LIVE_UPDATES_STORAGE_KEY.value, v ? '1' : '0');
});

// Orders that just appeared via a background poll — used to flash the row
// and chime, so a busy admin notices a new order land without staring at
// the table. Stays highlighted (not just a timed flash) until the admin
// actually acknowledges it: opens the order, changes its status, or clicks
// the row — see clearNewOrder(), called from those three places.
const newOrderIds = ref<Set<string>>(new Set());
const displayRows = computed(() =>
  orders.value.map((o) => (newOrderIds.value.has(o.id) ? { ...o, class: 'row-flash-new' } : o))
);
function clearNewOrder(id: string) {
  if (!newOrderIds.value.has(id)) return;
  newOrderIds.value.delete(id);
  newOrderIds.value = new Set(newOrderIds.value);
}

// Synthesized rather than an audio asset — a couple of short sine-wave
// tones is enough for a notification chime and avoids shipping/loading a
// sound file for something this small.
//
// The AudioContext is created once and reused (not per-chime): browsers
// mute/suspend audio contexts that weren't created or resumed following a
// real user gesture, and a background poll firing on its own timer is
// never one — creating a fresh context there plays nothing, silently, with
// no error. Priming it on the page's first click/tap and reusing that same
// (now-unlocked) instance is what actually gets sound out of it.
let sharedAudioCtx: AudioContext | null = null;
function ensureAudioContext(): AudioContext | null {
  if (!process.client) return null;
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx) sharedAudioCtx = new AudioCtx();
  return sharedAudioCtx;
}
function unlockAudio() {
  const ctx = ensureAudioContext();
  if (ctx?.state === 'suspended') ctx.resume().catch(() => {});
}

function playNewOrderChime() {
  try {
    const ctx = ensureAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    [880, 1108.73].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = now + i * 0.12;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.4);
    });
  } catch (e) {
    logError('[menu/index] playNewOrderChime failed', e);
  }
}

async function pollTick() {
  if (isDetailOpen.value || !liveUpdatesEnabled.value) return;
  const previousIds = new Set(orders.value.map((o) => o.id));
  await loadOrders({ silent: true });
  const freshIds = orders.value.filter((o) => !previousIds.has(o.id)).map((o) => o.id);
  if (freshIds.length) {
    freshIds.forEach((id) => newOrderIds.value.add(id));
    newOrderIds.value = new Set(newOrderIds.value);
    playNewOrderChime();
  }
  loadStatusCounts();
  loadSummary();
}

onMounted(async () => {
  restoreQuickFilters();
  restoreLiveUpdatesPref();
  loadBranches();
  loadSourceTagOptions();
  await loadOrders();
  loadStatusCounts();
  loadSummary();
  openFromQuery();
  pollTimer = setInterval(pollTick, 8000);
  window.addEventListener('pointerdown', unlockAudio, { once: true });
});

onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer);
  window.removeEventListener('pointerdown', unlockAudio);
});

const isCreateOrderOpen = ref(false);
const creatingOrder = ref(false);
const updatingStatusId = ref<string | null>(null);

async function handleStatusChange(order: MenuOrder, status: string) {
  if (order.status === status) return;
  updatingStatusId.value = order.id;
  try {
    const menuToken = await getToken();
    const { menuUpdateOrderStatus } = await import('@/api/menu/order/updateStatus');
    const updated = await menuUpdateOrderStatus(menuToken, nsSlug.value, order.id, status);
    const idx = orders.value.findIndex((o) => o.id === updated.id);
    if (idx !== -1) orders.value[idx] = updated;
    clearNewOrder(order.id);
    loadStatusCounts();
    useToast().add({ title: t('menu.statusUpdated') || 'Status updated', color: 'primary' });
  } catch (e) {
    logError('[menu/index] handleStatusChange failed', e);
    useToast().add({ title: getErrorMessage(e) || 'Failed to update status', color: 'red' });
  } finally {
    updatingStatusId.value = null;
  }
}

function statusMenuItems(row: MenuOrder) {
  return [
    nextStatuses(row.status, row.type).map((s) => ({
      label: statusLabel(s),
      icon: statusBadgeStyle(s).icon,
      status: s,
      click: () => handleStatusChange(row, s),
    })),
  ];
}

const isDetailOpen = ref(false);
const selectedOrder = ref<MenuOrder | null>(null);

function openDetail(row: MenuOrder) {
  selectedOrder.value = row;
  isDetailOpen.value = true;
  clearNewOrder(row.id);
}

// Switches the already-open detail modal to a different order by id (e.g.
// clicking one of "customer's other orders" inside it) — looks in the
// currently-loaded list first, falls back to fetching it directly since a
// past order very often won't match the current filters.
async function handleOpenOrderById(orderId: string) {
  const existing = orders.value.find((o) => o.id === orderId);
  if (existing) {
    openDetail(existing);
    return;
  }
  try {
    const menuToken = await getToken();
    const { menuGetOrder } = await import('@/api/menu/order/get');
    const fetched = await menuGetOrder(menuToken, nsSlug.value, orderId);
    if (fetched) openDetail(fetched);
  } catch (e) {
    logError('[menu/index] handleOpenOrderById failed', e);
  }
}

// Closing the detail modal means whatever was edited (status, comment, ...)
// should be reflected immediately rather than waiting for the next poll —
// and a plain reload naturally drops the row if it no longer matches the
// active filters (e.g. filtered to NEW and the order was just accepted).
watch(isDetailOpen, (isOpen, wasOpen) => {
  if (!isOpen && wasOpen) {
    loadOrders();
    loadStatusCounts();
    loadSummary();
  }
});

function handleDetailStatusChanged(updated: MenuOrder) {
  const idx = orders.value.findIndex((o) => o.id === updated.id);
  if (idx !== -1) orders.value[idx] = updated;
  selectedOrder.value = updated;
  clearNewOrder(updated.id);
  loadStatusCounts();
}

async function handleCreateOrder(payload: any) {
  creatingOrder.value = true;
  try {
    const menuToken = await getToken();
    const { menuCreateOrder } = await import('@/api/menu/order/create');
    await menuCreateOrder(menuToken, nsSlug.value, payload);
    useToast().add({ title: t('menu.orderCreated') || 'Order created', color: 'emerald' });
    isCreateOrderOpen.value = false;
    loadOrders();
    loadStatusCounts();
  } catch (e) {
    logError('[menu/index] handleCreateOrder failed', e);
    useToast().add({ title: getErrorMessage(e) || 'Failed to create order', color: 'red' });
  } finally {
    creatingOrder.value = false;
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-4 pb-safe-or-4 min-h-0">
    <div class="flex flex-col md:flex-row md:justify-between md:items-center mb-4 flex-shrink-0 gap-3">
      <div class="text-left">
        <h1 class="text-2xl font-semibold">
          {{ t('menu.title') || 'Orders' }}
        </h1>
        <span class="text-sm text-gray-600 dark:text-gray-400">{{ t('menu.subtitle') || 'Every order from your storefronts, in one place' }}</span>
      </div>
      <div class="flex items-center gap-2 self-start">
        <UButton
          icon="lucide:external-link"
          size="xs"
          color="emerald"
          variant="soft"
          class="min-w-fit whitespace-nowrap gap-2"
          :ui="{ rounded: 'rounded-xl' }"
          :to="`/to/${nsSlug}/menu`"
          target="_blank"
        >
          {{ t('menu.storefront') || 'Storefront' }}
        </UButton>
        <UButton
          icon="lucide:settings"
          size="xs"
          color="primary"
          variant="soft"
          class="min-w-fit whitespace-nowrap gap-2"
          :ui="{ rounded: 'rounded-xl' }"
          :to="`/${nsSlug}/menu/settings`"
        >
          {{ t('menu.settings') || 'Settings' }}
        </UButton>
      </div>
    </div>

    <!-- Quick status filter cards (multi-select) -->
    <div class="flex gap-2.5 overflow-x-auto pb-2 mb-3 flex-shrink-0">
      <button
        class="group flex-shrink-0 flex items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 min-w-[116px] text-left transition-all duration-200"
        :class="selectedStatuses.length === 0 ? cardStyle('').active : CARD_INACTIVE"
        @click="clearStatuses"
      >
        <span
          class="flex h-8 w-8 items-center justify-center rounded-xl transition-colors"
          :class="selectedStatuses.length === 0 ? cardStyle('').iconBg : CARD_INACTIVE_ICON_BG"
        >
          <Icon
            :name="cardStyle('').icon"
            class="h-4 w-4"
            :class="selectedStatuses.length === 0 ? cardStyle('').iconColor : CARD_INACTIVE_ICON_COLOR"
          />
        </span>
        <span>
          <span class="block text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t('menu.all') || 'All' }}</span>
          <span class="block text-lg font-bold leading-tight tabular-nums text-gray-900 dark:text-gray-100">{{ totalCount }}</span>
        </span>
      </button>
      <!-- A different filter dimension from the status cards (source tag,
           not status) — orders with no sourceTag, i.e. not placed through
           any tracked share link. Distinct color so it doesn't read as
           another status. -->
      <button
        class="group flex-shrink-0 flex items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 min-w-[116px] text-left transition-all duration-200"
        :class="isManualFilterActive
          ? 'border-indigo-300 bg-indigo-50 shadow-sm dark:border-indigo-700 dark:bg-indigo-950/30'
          : CARD_INACTIVE"
        @click="toggleManualFilter"
      >
        <span
          class="flex h-8 w-8 items-center justify-center rounded-xl transition-colors"
          :class="isManualFilterActive ? 'bg-indigo-100 dark:bg-indigo-900/40' : CARD_INACTIVE_ICON_BG"
        >
          <Icon
            name="lucide:user"
            class="h-4 w-4"
            :class="isManualFilterActive ? 'text-indigo-600 dark:text-indigo-300' : CARD_INACTIVE_ICON_COLOR"
          />
        </span>
        <span>
          <span class="block text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t('menu.myOrdersCard') || 'My orders' }}</span>
          <span class="block text-lg font-bold leading-tight tabular-nums text-gray-900 dark:text-gray-100">{{ manualOrdersCount }}</span>
        </span>
      </button>
      <button
        v-for="s in STATUSES"
        :key="s"
        class="group relative flex-shrink-0 flex items-center gap-2.5 rounded-2xl border py-2.5 text-left transition-all duration-200"
        :class="[selectedStatuses.includes(s) ? cardStyle(s).active : CARD_INACTIVE, selectedStatuses.includes(s) ? 'pl-3.5 pr-7' : 'px-3.5']"
        @click="toggleStatus(s)"
      >
        <Icon
          v-if="selectedStatuses.includes(s)"
          name="lucide:check-circle-2"
          class="absolute top-1.5 right-1.5 h-4 w-4"
          :class="cardStyle(s).checkColor"
        />
        <span
          class="flex h-8 w-8 items-center justify-center rounded-xl transition-colors"
          :class="selectedStatuses.includes(s) ? cardStyle(s).iconBg : CARD_INACTIVE_ICON_BG"
        >
          <Icon
            :name="cardStyle(s).icon"
            class="h-4 w-4"
            :class="selectedStatuses.includes(s) ? cardStyle(s).iconColor : CARD_INACTIVE_ICON_COLOR"
          />
        </span>
        <span>
          <span class="block text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ statusLabel(s) }}</span>
          <span class="block text-lg font-bold leading-tight tabular-nums text-gray-900 dark:text-gray-100">{{ statusCounts[s] ?? 0 }}</span>
        </span>
      </button>
    </div>

    <!-- Branch filter (multi-select) + search -->
    <div class="flex flex-col sm:flex-row gap-2 mb-3 flex-shrink-0">
      <USelectMenu
        v-model="selectedBranchIds"
        multiple
        icon="lucide:map-pin"
        :options="branchOptions"
        value-attribute="value"
        option-attribute="label"
        class="w-full sm:w-56"
        :ui="{ rounded: 'rounded-xl' }"
        :popper="{ strategy: 'fixed' }"
      >
        <template #label>
          <span class="truncate">{{ branchSelectLabel }}</span>
        </template>
      </USelectMenu>
      <UInput
        v-model="search"
        icon="lucide:search"
        :placeholder="t('menu.searchOrders') || 'Search by phone, name or order #'"
        class="w-full sm:flex-1"
        :ui="{ rounded: 'rounded-xl' }"
      />
      <div class="flex rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden flex-shrink-0">
        <button
          v-for="opt in [{ value: '', label: t('menu.any') || 'Any' }, { value: 'delivery', label: t('menu.delivery') || 'Delivery' }, { value: 'pickup', label: t('menu.pickup') || 'Pickup' }]"
          :key="opt.value"
          type="button"
          class="px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors"
          :class="selectedType === opt.value
            ? 'bg-primary-500 text-white'
            : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'"
          @click="selectedType = opt.value as typeof selectedType"
        >
          {{ opt.label }}
        </button>
      </div>
      <UButton
        icon="lucide:sliders-horizontal"
        color="gray"
        variant="soft"
        class="flex-shrink-0"
        :ui="{ rounded: 'rounded-xl' }"
        @click="isFilterPanelOpen = true"
      >
        <span class="hidden sm:inline">{{ t('menu.moreFilters') || 'More filters' }}</span>
        <span v-if="hasActiveFilterPanel" class="w-1.5 h-1.5 rounded-full bg-primary-500" />
      </UButton>
      <UButton
        icon="lucide:plus"
        color="primary"
        variant="soft"
        class="w-full sm:w-auto justify-center flex-shrink-0"
        :ui="{ rounded: 'rounded-xl' }"
        @click="isCreateOrderOpen = true"
      >
        {{ t('menu.createOrder') || 'Create order' }}
      </UButton>
    </div>

    <div
      v-if="error"
      class="mb-4 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm px-3 py-2"
    >
      {{ error }}
    </div>

    <div class="flex-1 min-h-0">
      <AppTable
        v-model:selected="selectedOrders"
        :rows="displayRows"
        :columns="columns"
        :loading="loading"
        empty-icon="lucide:receipt-text"
        @select="openDetail"
      >
        <template #number-data="{ row }">
          <span class="font-mono font-semibold tabular-nums">{{ smartOrderNumber(row) }}</span>
        </template>
        <template #customerName-data="{ row }">
          <div class="flex items-center gap-2 min-w-0">
            <span class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-[10px] font-semibold text-gray-600 dark:text-gray-300">
              {{ initialFor(row) }}
            </span>
            <span class="truncate">{{ row.customerName || (t('menu.guestCustomer') || 'Guest') }}</span>
          </div>
        </template>
        <template #phone-data="{ row }">
          <span class="tabular-nums">{{ formatDisplayPhoneUniversal(row.phone) }}</span>
        </template>
        <template #type-data="{ row }">
          <UBadge color="gray" variant="subtle">
            {{ row.type === 'pickup' ? (t('menu.pickup') || 'Pickup') : (t('menu.delivery') || 'Delivery') }}
          </UBadge>
        </template>
        <template #status-data="{ row }">
          <!-- The .stop lives on this wrapping span, not on the trigger
               button inside UDropdown: UDropdown's own open/close toggle is
               a click listener on its HMenuButton wrapper, an ANCESTOR of
               the button. Putting .stop on the button itself blocked that
               ancestor listener from ever firing, so the dropdown silently
               never opened — stopping one level further out still prevents
               the row's own @select from firing without eating the click
               UDropdown needs. -->
          <span v-if="nextStatuses(row.status, row.type).length" @click.stop>
          <UDropdown :items="statusMenuItems(row)" :popper="{ placement: 'bottom-start', strategy: 'fixed' }">
            <button
              type="button"
              class="inline-flex items-center gap-1 rounded-full transition-opacity hover:opacity-80 disabled:opacity-50"
              :disabled="updatingStatusId === row.id"
            >
              <span
                class="inline-flex items-center gap-1 rounded-full pl-1.5 pr-2 py-0.5 text-white text-xs font-semibold"
                :style="{ backgroundColor: statusBadgeStyle(row.status).bg }"
              >
                <Icon :name="statusBadgeStyle(row.status).icon" class="w-3 h-3" />
                {{ statusLabel(row.status) }}
              </span>
              <Icon
                :name="updatingStatusId === row.id ? 'lucide:loader-2' : 'lucide:chevron-down'"
                class="w-3 h-3 text-gray-400"
                :class="{ 'animate-spin': updatingStatusId === row.id }"
              />
            </button>
            <template #item="{ item }">
              <span class="flex items-center gap-2 w-full">
                <span class="h-2 w-2 rounded-full flex-shrink-0" :style="{ backgroundColor: statusBadgeStyle(item.status).bg }" />
                <span class="truncate">{{ item.label }}</span>
              </span>
            </template>
          </UDropdown>
          </span>
          <span
            v-else
            class="inline-flex items-center gap-1 rounded-full pl-1.5 pr-2 py-0.5 text-white text-xs font-semibold"
            :style="{ backgroundColor: statusBadgeStyle(row.status).bg }"
          >
            <Icon :name="statusBadgeStyle(row.status).icon" class="w-3 h-3" />
            {{ statusLabel(row.status) }}
          </span>
        </template>
        <template #totalAmount-data="{ row }">
          <span class="font-semibold tabular-nums">{{ row.totalAmount.toLocaleString() }}</span>
        </template>
        <template #createdAt-data="{ row }">
          <span class="text-gray-500 dark:text-gray-400">{{ formatDate(row.createdAt) }}</span>
        </template>
        <template #actions-data="{ row }">
          <UTooltip :text="t('menu.copyLink') || 'Copy share link'">
            <UButton icon="lucide:link" size="2xs" color="gray" variant="ghost" @click.stop="copyOrderLink(row)" />
          </UTooltip>
        </template>
      </AppTable>
    </div>

    <!-- Table footer: live-updates control always lives here; the summary
         (by default every order matching the current filters, not just the
         loaded page — combine with the date-range filters above for a quick
         report over a period; checking specific rows switches it to just
         that subset) only appears once there's something to show. -->
    <div
      class="flex-shrink-0 mt-2 flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-sm transition-colors"
      :class="selectedSummary
        ? 'border-primary-200 dark:border-primary-800 bg-primary-50/60 dark:bg-primary-950/20'
        : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'"
    >
      <label class="flex items-center gap-2 cursor-pointer select-none flex-shrink-0">
        <UToggle v-model="liveUpdatesEnabled" size="sm" />
        <span class="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
          {{ t('menu.liveUpdates') || 'Live updates' }}
          <span
            v-if="liveUpdatesEnabled"
            class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"
            :title="t('menu.liveUpdatesHint') || 'Auto-refreshes every few seconds and chimes on new orders'"
          />
        </span>
      </label>

      <div v-if="selectedSummary || summary" class="flex items-center gap-3">
        <span class="text-gray-500 dark:text-gray-400">
          {{ selectedSummary ? (t('menu.summarySelected') || 'Selected') : (t('menu.summaryOrders') || 'Orders') }}:
          <span class="font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{{ (selectedSummary || summary)!.count }}</span>
        </span>
        <span class="text-gray-500 dark:text-gray-400">
          {{ t('menu.summaryTotal') || 'Total' }}:
          <span class="font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{{ (selectedSummary || summary)!.totalAmount.toLocaleString() }}</span>
        </span>
        <UButton
          v-if="selectedSummary"
          size="2xs"
          color="primary"
          variant="soft"
          icon="lucide:x"
          @click="selectedOrders = []"
        >
          {{ t('menu.clearSelection') || 'Clear selection' }}
        </UButton>
      </div>
    </div>

    <CreateOrderModal
      v-model="isCreateOrderOpen"
      :ns-slug="nsSlug"
      :branches="branches"
      :saving="creatingOrder"
      @submit="handleCreateOrder"
    />

    <OrderDetailModal
      v-model="isDetailOpen"
      :order="selectedOrder"
      :branches="branches"
      :source-tag-options="sourceTagOptions"
      @status-changed="handleDetailStatusChanged"
      @open-order="handleOpenOrderById"
    />

    <!-- Full filter panel: source tag + date ranges, for building a report
         over a period rather than everyday triage — kept out of the
         always-visible bar above. -->
    <USlideover v-model="isFilterPanelOpen">
      <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800', body: { base: 'flex-1 overflow-y-auto bg-gray-50/60 dark:bg-gray-950/40' } }" class="flex flex-col h-full">
        <template #header>
          <div class="flex items-center gap-3">
            <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/40 flex-shrink-0">
              <Icon name="lucide:sliders-horizontal" class="h-4 w-4 text-primary-600 dark:text-primary-300" />
            </span>
            <div class="min-w-0">
              <h3 class="text-base font-semibold leading-tight">{{ t('menu.moreFilters') || 'More filters' }}</h3>
              <p class="text-xs text-gray-500 dark:text-gray-400 truncate">{{ t('menu.moreFiltersHint') || 'For building a report over a period' }}</p>
            </div>
            <UButton icon="lucide:x" size="sm" color="gray" variant="ghost" class="ml-auto flex-shrink-0" @click="isFilterPanelOpen = false" />
          </div>
        </template>

        <div class="space-y-4">
          <div class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
            <div class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              <Icon name="lucide:link" class="h-3.5 w-3.5" />
              {{ t('menu.sourceTagLabel') || 'Source' }}
            </div>
            <USelectMenu
              v-model="sourceTagFilter"
              :options="[{ label: t('menu.any') || 'Any', value: '' }, { label: t('menu.myOrdersCard') || 'My orders', value: MANUAL_SOURCE_TAG }, ...sourceTagOptions.map((s) => ({ label: s.label, value: s.sourceTag }))]"
              value-attribute="value"
              option-attribute="label"
              icon="lucide:link"
              :popper="{ strategy: 'fixed' }"
            />
            <p class="text-xs text-gray-400">{{ t('menu.sourceTagFilterHint') || 'From links saved in the Share tab' }}</p>
          </div>

          <div class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
            <div class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              <Icon name="lucide:calendar-plus" class="h-3.5 w-3.5" />
              {{ t('menu.createdRangeLabel') || 'Created' }}
            </div>
            <div class="grid grid-cols-2 gap-3">
              <UFormGroup :label="t('menu.createdFrom') || 'From'">
                <UInput v-model="createdFrom" type="date" />
              </UFormGroup>
              <UFormGroup :label="t('menu.createdTo') || 'To'">
                <UInput v-model="createdTo" type="date" />
              </UFormGroup>
            </div>
          </div>

          <div class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
            <div class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              <Icon name="lucide:calendar-check-2" class="h-3.5 w-3.5" />
              {{ t('menu.closedRangeLabel') || 'Closed' }}
            </div>
            <p class="text-xs text-gray-400 -mt-1">{{ t('menu.closedHint') || 'Completed or cancelled' }}</p>
            <div class="grid grid-cols-2 gap-3">
              <UFormGroup :label="t('menu.closedFrom') || 'From'">
                <UInput v-model="closedFrom" type="date" />
              </UFormGroup>
              <UFormGroup :label="t('menu.closedTo') || 'To'">
                <UInput v-model="closedTo" type="date" />
              </UFormGroup>
            </div>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="ghost" @click="clearFilterPanel">
              {{ t('app.clear') || 'Clear' }}
            </UButton>
            <UButton color="primary" icon="lucide:check" @click="applyFilterPanel">
              {{ t('menu.applyFilters') || 'Apply' }}
            </UButton>
          </div>
        </template>
      </UCard>
    </USlideover>
  </div>
</template>
