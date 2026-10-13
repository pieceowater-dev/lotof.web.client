<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useCallPlayer } from '@/composables/useCallPlayer';

// Floating glass player for call recordings (same glass as the header and the
// live call card). Draggable by its top strip, remembers its place, keeps
// playing across page navigation because it lives in the workspace layout.
const { t } = useI18n();
const { state, close } = useCallPlayer();

const POS_KEY = 'lota-call-player-pos';
const MARGIN = 12;
const SPEEDS = [1, 1.25, 1.5, 1.75, 2, 3];

const root = ref<HTMLElement | null>(null);
const audio = ref<HTMLAudioElement | null>(null);
const pos = ref<{ x: number; y: number } | null>(null);
const dragging = ref(false);
const playing = ref(false);
const time = ref(0);
const duration = ref(0);
const speed = ref(1);
let drag: { dx: number; dy: number } | null = null;

const open = computed(() => !!state.value.call);

function clamp(p: { x: number; y: number }) {
  const w = root.value?.offsetWidth ?? 380;
  const h = root.value?.offsetHeight ?? 130;
  return {
    x: Math.min(Math.max(MARGIN, p.x), Math.max(MARGIN, window.innerWidth - w - MARGIN)),
    y: Math.min(Math.max(MARGIN, p.y), Math.max(MARGIN, window.innerHeight - h - MARGIN)),
  };
}

function placeDefault() {
  const h = root.value?.offsetHeight ?? 130;
  pos.value = clamp({ x: 20, y: window.innerHeight - h - 20 });
}

function restore() {
  try {
    const p = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
    if (p && typeof p.x === 'number' && typeof p.y === 'number') { pos.value = clamp(p); return; }
  } catch { /* storage may be unavailable */ }
  placeDefault();
}

function onDown(e: PointerEvent) {
  if ((e.target as HTMLElement).closest('button')) return;
  if (!pos.value) return;
  drag = { dx: e.clientX - pos.value.x, dy: e.clientY - pos.value.y };
  dragging.value = true;
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
}
function onMove(e: PointerEvent) {
  if (drag) pos.value = clamp({ x: e.clientX - drag.dx, y: e.clientY - drag.dy });
}
function onUp() {
  if (!drag) return;
  drag = null;
  dragging.value = false;
  try { localStorage.setItem(POS_KEY, JSON.stringify(pos.value)); } catch { /* ignore */ }
}
const onResize = () => { if (pos.value) pos.value = clamp(pos.value); };

onMounted(() => window.addEventListener('resize', onResize));
onBeforeUnmount(() => window.removeEventListener('resize', onResize));

// A new track: reset the transport and start as soon as the link is ready.
watch(() => [state.value.nonce, state.value.src], async () => {
  time.value = 0;
  duration.value = 0;
  playing.value = false;
  await nextTick();
  if (!pos.value) { restore(); }
  const a = audio.value;
  if (a && state.value.src) {
    a.playbackRate = speed.value;
    a.play().catch(() => { playing.value = false; });
  }
});

watch(open, async (isOpen) => {
  if (isOpen) { await nextTick(); if (!pos.value) restore(); }
  else { audio.value?.pause(); playing.value = false; }
});

function toggle() {
  const a = audio.value;
  if (!a) return;
  if (a.paused) a.play().catch(() => {}); else a.pause();
}
function skip(sec: number) {
  const a = audio.value;
  if (a) a.currentTime = Math.min(Math.max(0, a.currentTime + sec), a.duration || a.currentTime + sec);
}
function seek(e: Event) {
  const a = audio.value;
  if (a) a.currentTime = Number((e.target as HTMLInputElement).value);
}
function setSpeed(v: number) {
  speed.value = v;
  if (audio.value) audio.value.playbackRate = v;
}

const fmt = (sec: number) => {
  const s = Math.max(0, Math.floor(sec || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const title = computed(() => state.value.call?.clientName || state.value.call?.clientPhone || '');
const subtitle = computed(() => {
  const c = state.value.call;
  if (!c) return '';
  const dir = c.direction === 'OUT' ? t('contacts.callOut') : t('contacts.callIn');
  return `${dir} · ${new Date(c.startedAt).toLocaleString()}`;
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      ref="root"
      class="call-widget fixed z-[79] w-[23.5rem] max-w-[calc(100vw-1.5rem)]"
      :class="{ 'call-widget--dragging': dragging }"
      :style="pos ? { left: `${pos.x}px`, top: `${pos.y}px` } : { left: '20px', bottom: '20px' }"
    >
      <audio
        v-if="state.src"
        ref="audio"
        :src="state.src"
        preload="auto"
        @play="playing = true"
        @pause="playing = false"
        @ended="playing = false"
        @timeupdate="time = ($event.target as HTMLAudioElement).currentTime"
        @loadedmetadata="duration = ($event.target as HTMLAudioElement).duration"
      />

      <div
        class="call-widget__grip flex items-center gap-2 px-4 pt-2.5 pb-1"
        @pointerdown="onDown"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointercancel="onUp"
      >
        <span class="flex gap-1 text-gray-400/80"><i v-for="n in 6" :key="n" class="block w-1 h-1 rounded-full bg-current" /></span>
        <span class="flex-1 text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t('contacts.playerTitle') }}</span>
        <button type="button" class="cp-icon" :aria-label="t('common.close')" @click="close">
          <Icon name="lucide:x" class="w-4 h-4" />
        </button>
      </div>

      <div class="px-4 pb-4 space-y-3">
        <div class="min-w-0">
          <div class="font-semibold truncate text-gray-900 dark:text-white">{{ title }}</div>
          <div class="text-xs text-gray-500 dark:text-gray-400 truncate">{{ subtitle }}</div>
        </div>

        <div v-if="state.loading" class="flex items-center gap-2 text-sm text-gray-500">
          <Icon name="lucide:loader-2" class="w-4 h-4 animate-spin" />{{ t('common.loading') }}
        </div>
        <div v-else-if="state.unavailable" class="at-banner !flex-row !items-center gap-2 !py-2 text-sm">
          <Icon name="lucide:cloud-off" class="w-4 h-4 shrink-0 text-blue-600" />
          <span>{{ t('contacts.playerUnavailable') }}</span>
        </div>

        <template v-else>
          <div class="flex items-center gap-2">
            <span class="w-9 text-[11px] tabular-nums text-gray-500">{{ fmt(time) }}</span>
            <input
              type="range"
              class="cp-range flex-1"
              min="0"
              :max="duration || 0"
              step="0.1"
              :value="time"
              :style="{ '--p': duration ? `${(time / duration) * 100}%` : '0%' }"
              @input="seek"
            >
            <span class="w-9 text-right text-[11px] tabular-nums text-gray-500">{{ fmt(duration) }}</span>
          </div>
          <!-- play sits dead centre; skips are symmetrical on both sides -->
          <div class="flex items-center justify-center gap-4">
            <button type="button" class="cp-icon" aria-label="-10" @click="skip(-10)"><Icon name="lucide:rotate-ccw" class="w-4 h-4" /></button>
            <button type="button" class="cp-play" :aria-label="playing ? t('contacts.playerPause') : t('contacts.playerPlay')" @click="toggle">
              <Icon :name="playing ? 'lucide:pause' : 'lucide:play'" class="w-5 h-5" />
            </button>
            <button type="button" class="cp-icon" aria-label="+10" @click="skip(10)"><Icon name="lucide:rotate-cw" class="w-4 h-4" /></button>
          </div>
          <div class="flex items-center justify-center gap-1" role="radiogroup" :aria-label="t('contacts.playerSpeed')">
            <button
              v-for="v in SPEEDS"
              :key="v"
              type="button"
              role="radio"
              :aria-checked="speed === v"
              class="pill-filter !px-2.5 !py-1 !text-xs tabular-nums"
              :class="speed === v ? 'pill-filter--active' : ''"
              @click="setSpeed(v)"
            >
              {{ v }}×
            </button>
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>
