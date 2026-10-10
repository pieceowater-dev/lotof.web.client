<script setup lang="ts">
// Single horizontal promo video in the same look as PromoVideoDeck's cards: iOS "continuous" corners,
// a blurred shadow copy behind the card, poster under a soft shimmer until the first frame is ready,
// a round sound button. Nothing is downloaded until the player is near the viewport; it plays (muted)
// once >60% visible, pauses when scrolled away and loops while it stays in view (same visibility rules
// as the deck cards above); a click toggles play/pause. Width is capped by the parent (max-w-*), so a big file never swallows the whole block.
import { buildContinuousPath } from '@/utils/continuousCorners';

const props = defineProps<{
  src: string;
  poster: string;
  width: number;
  height: number;
  soundOnLabel?: string;
  soundOffLabel?: string;
  playLabel?: string;
}>();

const CORNER_RATIO = 0.075; // radius / card height — keeps a 16:9 card as round as the phone cards look
const rootRef = ref<HTMLElement | null>(null);
const cardRef = ref<HTMLElement | null>(null);
const videoRef = ref<HTMLVideoElement | null>(null);
const clipPath = ref('');
const nearView = ref(false);
const inView = ref(false);
const ready = ref(false);
const muted = ref(true);
const playing = ref(false);
const ended = ref(false);
const progress = ref(0);
let sizeObserver: ResizeObserver | null = null;
let nearObserver: IntersectionObserver | null = null;
let viewObserver: IntersectionObserver | null = null;
let userPaused = false; // a manual pause must not be undone by scrolling back into view

function syncPlayback() {
  const v = videoRef.value;
  if (!v || !nearView.value) return;
  if (inView.value && !userPaused && !ended.value) v.play().catch(() => { /* autoplay blocked: poster + play button stay */ });
  else v.pause();
}
watch(inView, () => nextTick(syncPlayback));
watch(nearView, () => nextTick(syncPlayback));

function togglePlay() {
  const v = videoRef.value;
  if (!v) return;
  if (v.paused || v.ended) {
    userPaused = false;
    if (v.ended) { v.currentTime = 0; ended.value = false; }
    v.play().catch(() => {});
  } else {
    userPaused = true;
    v.pause();
  }
}

function toggleSound() {
  const v = videoRef.value;
  if (!v) return;
  muted.value = !muted.value;
  v.muted = muted.value;
  if (!muted.value) v.play().catch(() => {});
}

function onTimeUpdate() {
  const v = videoRef.value;
  if (v && v.duration) progress.value = (v.currentTime / v.duration) * 100;
}

onMounted(() => {
  if (typeof ResizeObserver !== 'undefined' && cardRef.value) {
    sizeObserver = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0) clipPath.value = `path('${buildContinuousPath(width, height, height * CORNER_RATIO)}')`;
    });
    sizeObserver.observe(cardRef.value);
  }
  if (!rootRef.value || typeof IntersectionObserver === 'undefined') return;
  nearObserver = new IntersectionObserver(
    (entries) => { if (entries.some((e) => e.isIntersecting)) nearView.value = true; },
    { rootMargin: '300px 0px' },
  );
  nearObserver.observe(rootRef.value);
  viewObserver = new IntersectionObserver(
    (entries) => {
      const ratio = Math.max(...entries.map((e) => e.intersectionRatio));
      if (ratio > 0.6) { inView.value = true; nearView.value = true; }
      else if (ratio < 0.3) inView.value = false;
    },
    { threshold: [0, 0.3, 0.6, 0.61] },
  );
  viewObserver.observe(rootRef.value);
});

onBeforeUnmount(() => {
  sizeObserver?.disconnect();
  nearObserver?.disconnect();
  viewObserver?.disconnect();
});
</script>

<template>
  <div ref="rootRef" class="relative mx-auto w-full select-none">
    <div ref="cardRef" class="relative w-full transform-gpu [backface-visibility:hidden]">
      <!-- Soft shadow: a blurred dark copy of the card shape behind it (a drop-shadow filter on the card
           itself flickered over the video while scrolling). -->
      <div class="pointer-events-none absolute inset-0 translate-y-3 opacity-25 blur-xl" aria-hidden="true">
        <div class="h-full w-full bg-black" :class="clipPath ? '' : 'rounded-[2rem]'" :style="{ clipPath: clipPath || undefined }" />
      </div>
      <div
        class="relative w-full cursor-pointer overflow-hidden bg-white dark:bg-gray-900"
        :class="clipPath ? '' : 'rounded-[2rem]'"
        :style="{ aspectRatio: `${props.width} / ${props.height}`, clipPath: clipPath || undefined }"
        @click="togglePlay"
      >
        <video
          ref="videoRef"
          class="absolute inset-0 h-full w-full object-cover"
          :src="nearView ? props.src : undefined"
          :poster="props.poster"
          :width="props.width"
          :height="props.height"
          :preload="nearView ? 'auto' : 'none'"
          muted
          loop
          playsinline
          @loadeddata="ready = true"
          @play="playing = true; ended = false"
          @pause="playing = false"
          @ended="ended = true; playing = false"
          @timeupdate="onTimeUpdate"
        />
        <!-- Not ready yet: blur the poster and pulse, so it reads as loading. -->
        <div
          v-if="nearView && !ready"
          class="pointer-events-none absolute inset-0 animate-pulse bg-white/40 backdrop-blur-sm"
          aria-hidden="true"
        />
        <!-- Paused / finished: a round play button over the frame. -->
        <button
          v-if="ready && !playing"
          type="button"
          class="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-emerald-600 shadow-lg backdrop-blur transition-transform hover:scale-105 dark:bg-gray-800/90 dark:text-emerald-300"
          :aria-label="props.playLabel || 'Play'"
          @click.stop="togglePlay"
        >
          <UIcon name="lucide:play" class="h-6 w-6 translate-x-0.5" />
        </button>
        <button
          v-if="ready"
          type="button"
          class="absolute bottom-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-emerald-600 shadow-md backdrop-blur transition-colors hover:bg-white dark:bg-gray-800/90 dark:text-emerald-300"
          :aria-label="muted ? props.soundOnLabel : props.soundOffLabel"
          @click.stop="toggleSound"
        >
          <UIcon :name="muted ? 'lucide:volume-x' : 'lucide:volume-2'" class="h-4 w-4" />
        </button>
        <!-- Thin brand progress line along the bottom edge. -->
        <div v-if="ready" class="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-black/10">
          <div class="h-full bg-gradient-to-r from-blue-600 to-emerald-500" :style="{ width: `${progress}%` }" />
        </div>
      </div>
    </div>
  </div>
</template>
