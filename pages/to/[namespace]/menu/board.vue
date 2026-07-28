<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { logError } from '@/utils/logger';
import { getPublicStorefront } from '@/api/menu/public/storefront';
import { getKitchenBoard } from '@/api/menu/public/board';
import type { BoardOrder } from '@/api/menu/public/board';
import type { MenuBrandSettings } from '@/api/menu/brandsettings/get';
import type { MenuBranch } from '@/api/menu/branch/list';
import { statusBadgeStyle } from '@/utils/orderStatus';
import { orderTypeIcon, orderTypeLabelInfo } from '@/utils/orderType';
import { withRetry } from '@/utils/retry';

// Public, unauthenticated Kitchen Display Board — view-only, no login (see
// pages/to/[namespace]/menu/index.vue for the matching customer storefront
// this pairs with). Never linked from the storefront itself; a venue
// bookmarks this URL directly on the kitchen TV. Read-only by design: there
// is no mutation wired up anywhere on this page.
definePageMeta({ layout: false });

const route = useRoute();
const { t } = useI18n();
const nsSlug = computed(() => route.params.namespace as string);
const branchParam = computed(() => (route.query.b as string) || '');

const brand = ref<MenuBrandSettings | null>(null);
const branches = ref<MenuBranch[]>([]);
const branchId = computed(() => {
  if (!branchParam.value) return undefined;
  const match = branches.value.find((b) => b.slug === branchParam.value || b.id === branchParam.value);
  return match?.id;
});
const activeBranch = computed(() => branches.value.find((b) => b.id === branchId.value) || null);

const orders = ref<BoardOrder[]>([]);
const loading = ref(true);
const error = ref('');

type ColumnKey = 'NEW' | 'ACCEPTED' | 'IN_PREPARATION' | 'READY';
const BOARD_COLUMNS: { status: ColumnKey; labelKey: string; fallback: string }[] = [
  { status: 'NEW', labelKey: 'menu.statusNew', fallback: 'New' },
  { status: 'ACCEPTED', labelKey: 'menu.statusAccepted', fallback: 'Accepted' },
  { status: 'IN_PREPARATION', labelKey: 'menu.statusInPreparation', fallback: 'Preparing' },
  { status: 'READY', labelKey: 'menu.statusReady', fallback: 'Ready' },
];

const ordersByColumn = computed(() => {
  const map: Record<ColumnKey, BoardOrder[]> = { NEW: [], ACCEPTED: [], IN_PREPARATION: [], READY: [] };
  for (const o of orders.value) {
    if (o.status in map) map[o.status as ColumnKey].push(o);
  }
  for (const key of Object.keys(map) as ColumnKey[]) {
    map[key].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  return map;
});

async function loadBrand() {
  try {
    const storefront = await withRetry(() => getPublicStorefront(nsSlug.value));
    brand.value = storefront.brandSettings;
    branches.value = storefront.branches;
  } catch (e) {
    logError('[kitchen-board] loadBrand failed', e);
  }
}

async function loadBoard() {
  try {
    orders.value = await getKitchenBoard(nsSlug.value, branchId.value);
    error.value = '';
  } catch (e) {
    logError('[kitchen-board] loadBoard failed', e);
    error.value = t('menu.boardLoadError') || 'Could not refresh the board — retrying shortly.';
  } finally {
    loading.value = false;
  }
}

// Ticking clock for the "elapsed since created" label on each card — purely
// client-side, no extra requests.
const now = ref(Date.now());
let clockTimer: ReturnType<typeof setInterval> | null = null;
function elapsedLabel(createdAt: string): string {
  const mins = Math.max(0, Math.floor((now.value - new Date(createdAt).getTime()) / 60000));
  if (mins < 1) return t('menu.justNow') || 'just now';
  if (mins < 60) return t('menu.minutesAgo', { count: mins }) || `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}
// A card sitting for a while is exactly the thing a kitchen board should
// flag — 15 minutes unattended is a reasonable "this is getting old" line
// without flagging every order that's merely a few minutes in.
const STALE_MINUTES = 15;
function isStale(createdAt: string): boolean {
  return (now.value - new Date(createdAt).getTime()) / 60000 >= STALE_MINUTES;
}

let pollTimer: ReturnType<typeof setInterval> | null = null;
onMounted(async () => {
  await loadBrand();
  await loadBoard();
  pollTimer = setInterval(loadBoard, 5000);
  clockTimer = setInterval(() => { now.value = Date.now(); }, 1000);
});
onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer);
  if (clockTimer) clearInterval(clockTimer);
});

// Reload immediately (rather than waiting for the next 5s tick) if the
// branch changes — e.g. someone edits the ?b= query on an already-open tab.
watch(branchId, () => { loading.value = true; loadBoard(); });

const isFullscreen = ref(false);
function toggleFullscreen() {
  if (!process.client) return;
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.().catch(() => {});
  } else {
    document.exitFullscreen?.().catch(() => {});
  }
}
onMounted(() => {
  document.addEventListener('fullscreenchange', () => { isFullscreen.value = !!document.fullscreenElement; });
});

useHead(() => ({
  title: `${t('menu.kitchenBoard') || 'Kitchen board'} — ${brand.value?.name || nsSlug.value}`,
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
}));
</script>

<template>
  <div class="h-screen w-screen overflow-hidden bg-gray-950 text-white flex flex-col">
    <header class="flex-shrink-0 flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-800">
      <div class="flex items-center gap-3 min-w-0">
        <img v-if="brand?.logoUrl" :src="brand.logoUrl" :alt="brand.name" class="w-8 h-8 rounded-lg object-contain bg-white flex-shrink-0">
        <Icon v-else name="lucide:store" class="w-6 h-6 text-gray-500 flex-shrink-0" />
        <h1 class="text-lg font-bold truncate">{{ brand?.name || nsSlug }}</h1>
        <span v-if="activeBranch" class="text-sm text-gray-400 truncate">— {{ activeBranch.name }}</span>
      </div>
      <div class="flex items-center gap-3 flex-shrink-0">
        <span v-if="error" class="text-xs text-amber-400 flex items-center gap-1">
          <Icon name="lucide:wifi-off" class="w-3.5 h-3.5" />
          {{ error }}
        </span>
        <span class="text-2xl font-mono tabular-nums text-gray-300">{{ new Date(now).toLocaleTimeString() }}</span>
        <button
          type="button"
          class="w-9 h-9 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center transition-colors"
          :aria-label="t('menu.toggleFullscreen') || 'Toggle fullscreen'"
          @click="toggleFullscreen"
        >
          <Icon :name="isFullscreen ? 'lucide:minimize' : 'lucide:maximize'" class="w-4 h-4 text-gray-300" />
        </button>
      </div>
    </header>

    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <UIcon name="lucide:loader-2" class="w-10 h-10 animate-spin text-gray-600" />
    </div>

    <div v-else class="flex-1 min-h-0 grid grid-cols-4 gap-px bg-gray-800">
      <div v-for="col in BOARD_COLUMNS" :key="col.status" class="min-h-0 flex flex-col bg-gray-950">
        <div
          class="flex-shrink-0 flex items-center justify-between px-4 py-2.5"
          :style="{ backgroundColor: statusBadgeStyle(col.status).bg }"
        >
          <span class="text-sm font-bold uppercase tracking-wide flex items-center gap-2">
            <Icon :name="statusBadgeStyle(col.status).icon" class="w-4 h-4" />
            {{ t(col.labelKey) || col.fallback }}
          </span>
          <span class="text-sm font-bold tabular-nums bg-black/25 rounded-full px-2 py-0.5">{{ ordersByColumn[col.status].length }}</span>
        </div>

        <div class="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
          <div
            v-for="order in ordersByColumn[col.status]"
            :key="order.id"
            class="rounded-xl bg-gray-900 border p-3 space-y-1.5"
            :class="isStale(order.createdAt) ? 'border-red-600' : 'border-gray-800'"
          >
            <div class="flex items-center justify-between">
              <span class="text-3xl font-black tabular-nums">#{{ order.number }}</span>
              <span
                class="text-xs font-medium tabular-nums"
                :class="isStale(order.createdAt) ? 'text-red-400' : 'text-gray-500'"
              >{{ elapsedLabel(order.createdAt) }}</span>
            </div>
            <div class="flex items-center gap-1.5 text-xs font-semibold text-gray-300">
              <Icon :name="order.tableTag ? 'lucide:utensils' : orderTypeIcon(order.type)" class="w-3.5 h-3.5" />
              <span v-if="order.tableTag">{{ t('menu.tableNumber', { number: order.tableTag }) || `Table ${order.tableTag}` }}</span>
              <span v-else>{{ t(orderTypeLabelInfo(order.type).key) || orderTypeLabelInfo(order.type).fallback }}</span>
            </div>
            <ul class="text-sm text-gray-300 space-y-0.5 pt-1 border-t border-gray-800">
              <li v-for="(item, idx) in order.items" :key="idx" class="flex justify-between gap-2">
                <span class="truncate">{{ item.name }}</span>
                <span class="font-semibold tabular-nums flex-shrink-0">×{{ item.quantity }}</span>
              </li>
            </ul>
          </div>
          <div v-if="!ordersByColumn[col.status].length" class="text-center py-8 text-gray-700 text-sm">
            {{ t('menu.boardColumnEmpty') || '—' }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
