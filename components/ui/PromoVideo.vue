<script setup lang="ts">
// Poster-first video that downloads nothing until it scrolls near the
// viewport (preload="none" + src attached by an IntersectionObserver), plays
// muted while visible and pauses once it leaves, so it never costs bandwidth
// or CPU for visitors who don't reach it.
const props = defineProps<{
  src: string;
  poster: string;
  width: number;
  height: number;
  soundOnLabel?: string;
  soundOffLabel?: string;
}>();

const wrapRef = ref<HTMLElement | null>(null);
const videoRef = ref<HTMLVideoElement | null>(null);
const loaded = ref(false);
const muted = ref(true);
let loadObserver: IntersectionObserver | null = null;
let playObserver: IntersectionObserver | null = null;

function play() {
  videoRef.value?.play().catch(() => { /* autoplay blocked: poster stays, user can tap */ });
}

onMounted(() => {
  if (!wrapRef.value || typeof IntersectionObserver === 'undefined') return;
  // Start fetching a bit before the block is on screen...
  loadObserver = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        loaded.value = true;
        loadObserver?.disconnect();
      }
    },
    { rootMargin: '300px 0px' },
  );
  loadObserver.observe(wrapRef.value);
  // ...but only play (muted) once more than 60% of it is visible.
  playObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries.some((e) => e.intersectionRatio > 0.6);
      loaded.value = loaded.value || visible;
      if (visible) nextTick(play);
      else videoRef.value?.pause();
    },
    { threshold: [0, 0.6, 0.61] },
  );
  playObserver.observe(wrapRef.value);
});

onBeforeUnmount(() => {
  loadObserver?.disconnect();
  playObserver?.disconnect();
});

function toggleSound() {
  if (!videoRef.value) return;
  muted.value = !muted.value;
  videoRef.value.muted = muted.value;
  if (!muted.value) play();
}
</script>

<template>
  <div
    ref="wrapRef"
    class="relative mx-auto w-full max-w-[340px] overflow-hidden rounded-3xl bg-white shadow-lg dark:bg-gray-900"
    :style="{ aspectRatio: `${props.width} / ${props.height}` }"
  >
    <video
      ref="videoRef"
      class="absolute inset-0 h-full w-full object-cover"
      :src="loaded ? props.src : undefined"
      :poster="props.poster"
      :width="props.width"
      :height="props.height"
      preload="none"
      muted
      loop
      playsinline
    />
    <button
      v-if="loaded"
      type="button"
      class="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-emerald-600 shadow-md backdrop-blur transition-colors hover:bg-white dark:bg-gray-800/90 dark:text-emerald-300"
      :aria-label="muted ? props.soundOnLabel : props.soundOffLabel"
      @click="toggleSound"
    >
      <UIcon :name="muted ? 'lucide:volume-x' : 'lucide:volume-2'" class="h-5 w-5" />
    </button>
  </div>
</template>
