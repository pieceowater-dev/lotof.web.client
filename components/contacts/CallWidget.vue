<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useI18n } from '@/composables/useI18n';
import type { CallCardEvent } from '@/api/contacts/telephony';

// The live call card as a floating glass widget over the whole app. It can be
// dragged by its top strip (mouse, touch, pen), remembers where it was left and
// is pulled back into view when the window shrinks.
const props = defineProps<{ cards: CallCardEvent[]; nsSlug: string }>();
const emit = defineEmits<{ (e: 'dismiss', id: string): void }>();

const { t } = useI18n();

const POS_KEY = 'lota-call-widget-pos';
const MARGIN = 12;

const root = ref<HTMLElement | null>(null);
const pos = ref<{ x: number; y: number } | null>(null);
const dragging = ref(false);
const collapsed = ref(false);
const now = ref(Date.now());
let drag: { dx: number; dy: number } | null = null;
let ticker: ReturnType<typeof setInterval> | null = null;

function clamp(p: { x: number; y: number }) {
  const el = root.value;
  const w = el?.offsetWidth ?? 360;
  const h = el?.offsetHeight ?? 160;
  return {
    x: Math.min(Math.max(MARGIN, p.x), Math.max(MARGIN, window.innerWidth - w - MARGIN)),
    y: Math.min(Math.max(MARGIN, p.y), Math.max(MARGIN, window.innerHeight - h - MARGIN)),
  };
}

function placeDefault() {
  const el = root.value;
  const w = el?.offsetWidth ?? 360;
  const h = el?.offsetHeight ?? 160;
  pos.value = clamp({ x: window.innerWidth - w - 20, y: window.innerHeight - h - 20 });
}

function restore() {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (typeof p.x === 'number' && typeof p.y === 'number') {
        pos.value = clamp(p);
        return;
      }
    }
  } catch { /* storage may be unavailable */ }
  placeDefault();
}

function onDown(e: PointerEvent) {
  if ((e.target as HTMLElement).closest('button, a')) return;
  const el = root.value;
  if (!el || !pos.value) return;
  drag = { dx: e.clientX - pos.value.x, dy: e.clientY - pos.value.y };
  dragging.value = true;
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
}

function onMove(e: PointerEvent) {
  if (!drag) return;
  pos.value = clamp({ x: e.clientX - drag.dx, y: e.clientY - drag.dy });
}

function onUp() {
  if (!drag) return;
  drag = null;
  dragging.value = false;
  try { localStorage.setItem(POS_KEY, JSON.stringify(pos.value)); } catch { /* ignore */ }
}

function onResize() {
  if (pos.value) pos.value = clamp(pos.value);
}

onMounted(async () => {
  await nextTick();
  restore();
  window.addEventListener('resize', onResize);
  ticker = setInterval(() => { now.value = Date.now(); }, 1000);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize);
  if (ticker) clearInterval(ticker);
});

function elapsed(ev: CallCardEvent): string {
  if (!ev.call.inProgress || ev.eventType !== 'accepted') return '';
  const sec = Math.max(0, Math.floor((now.value - new Date(ev.call.startedAt).getTime()) / 1000));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

function initial(ev: CallCardEvent): string {
  const n = (ev.clientKnown ? ev.clientName : '') || '';
  return n.trim().charAt(0).toUpperCase() || '#';
}

const title = (ev: CallCardEvent) => (ev.clientKnown ? (ev.clientName || ev.call.clientPhone) : t('contacts.liveUnknown'));
const headline = computed(() => (props.cards.length > 1 ? `${t('contacts.liveCalls')}: ${props.cards.length}` : ''));
</script>

<template>
  <Teleport to="body">
    <div
      v-if="cards.length"
      ref="root"
      class="call-widget fixed z-[80] w-[22.5rem] max-w-[calc(100vw-1.5rem)]"
      :class="{ 'call-widget--dragging': dragging }"
      :style="pos ? { left: `${pos.x}px`, top: `${pos.y}px` } : { right: '20px', bottom: '20px' }"
    >
      <!-- drag strip -->
      <div
        class="call-widget__grip flex items-center gap-2 px-4 pt-2.5 pb-1.5"
        @pointerdown="onDown"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointercancel="onUp"
      >
        <span class="flex gap-1 text-gray-400/80">
          <i v-for="n in 6" :key="n" class="block w-1 h-1 rounded-full bg-current" />
        </span>
        <span class="flex-1 text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ headline || t('contacts.liveCall') }}</span>
        <button
          type="button"
          class="text-gray-400 hover:text-gray-700 dark:hover:text-white"
          :title="collapsed ? t('contacts.liveExpand') : t('contacts.liveCollapse')"
          @click="collapsed = !collapsed"
        >
          <UIcon :name="collapsed ? 'lucide:chevron-up' : 'lucide:chevron-down'" class="w-4 h-4" />
        </button>
      </div>

      <div class="px-3 pb-3 space-y-2">
        <div
          v-for="ev in cards"
          :key="ev.call.id"
          class="rounded-2xl bg-white/60 dark:bg-white/5 px-3 py-3"
        >
          <div class="flex items-center gap-3">
            <div
              class="relative w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-white font-semibold text-lg"
              :class="[ev.call.inProgress ? 'call-widget__ring' : '', ev.clientKnown ? 'bg-gradient-to-br from-blue-500 to-emerald-500' : 'bg-gray-400 dark:bg-gray-600']"
            >
              <span>{{ ev.clientKnown ? initial(ev) : '?' }}</span>
              <span class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center shadow">
                <UIcon
                  :name="ev.call.direction === 'OUT' ? 'lucide:phone-outgoing' : 'lucide:phone-incoming'"
                  class="w-3 h-3"
                  :class="ev.call.inProgress ? 'text-emerald-600' : 'text-gray-500'"
                />
              </span>
            </div>
            <div class="min-w-0 flex-1">
              <div class="font-semibold leading-tight truncate text-gray-900 dark:text-white">{{ title(ev) }}</div>
              <div class="text-sm text-gray-600 dark:text-gray-300 tabular-nums truncate">{{ ev.call.clientPhone }}</div>
              <div class="text-[11px] text-gray-500 dark:text-gray-400">
                <template v-if="ev.call.inProgress">{{ ev.eventType === 'accepted' ? t('contacts.liveTalking') : t('contacts.liveRinging') }}</template>
                <template v-else-if="ev.call.status">{{ t(`contacts.callStatus_${ev.call.status}`) }}</template>
              </div>
            </div>
            <div v-if="elapsed(ev)" class="shrink-0 text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{{ elapsed(ev) }}</div>
            <button
              type="button"
              class="self-start -mt-1 -mr-1 text-gray-400 hover:text-gray-700 dark:hover:text-white"
              @click="emit('dismiss', ev.call.id)"
            >
              <UIcon name="lucide:x" class="w-4 h-4" />
            </button>
          </div>

          <template v-if="!collapsed">
            <div v-if="ev.call.firstFromNumber || ev.call.comment" class="mt-2 flex items-center gap-2 flex-wrap">
              <span v-if="ev.call.firstFromNumber" class="text-[11px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200">{{ t('contacts.callFirst') }}</span>
              <span v-if="ev.call.comment" class="text-xs text-gray-600 dark:text-gray-300 truncate">{{ ev.call.comment }}</span>
            </div>
            <div class="mt-3 flex gap-2">
              <UButton
                v-if="ev.clientKnown && ev.call.clientId"
                size="xs"
                color="primary"
                variant="soft"
                icon="lucide:user"
                :to="`/${nsSlug}/contacts/${ev.call.clientId}`"
              >
                {{ t('contacts.liveOpenClient') }}
              </UButton>
              <UButton
                v-else
                size="xs"
                color="primary"
                variant="soft"
                icon="lucide:user-plus"
                :to="`/${nsSlug}/contacts/new?phone=${encodeURIComponent(ev.call.clientPhone)}`"
              >
                {{ t('contacts.liveCreateClient') }}
              </UButton>
            </div>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>
