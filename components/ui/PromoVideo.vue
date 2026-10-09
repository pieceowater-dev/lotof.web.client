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
let observer: IntersectionObserver | null = null;

function play() {
  videoRef.value?.play().catch(() => { /* autoplay blocked: poster stays, user can tap */ });
}

onMounted(() => {
  if (!wrapRef.value || typeof IntersectionObserver === 'undefined') return;
  observer = new IntersectionObserver(
    (entries) => {
      const visible = entries.some((e) => e.isIntersecting);
      if (visible && !loaded.value) {
        loaded.value = true;
        nextTick(play);
      } else if (loaded.value) {
        if (visible) play();
        else videoRef.value?.pause();
      }
    },
    { rootMargin: '200px 0px', threshold: 0.25 },
  );
  observer.observe(wrapRef.value);
});

onBeforeUnmount(() => observer?.disconnect());

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
    class="relative mx-auto w-full max-w-[320px] overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-lg dark:border-gray-800"
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
      class="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition-colors hover:bg-black/70"
      :aria-label="muted ? props.soundOnLabel : props.soundOffLabel"
      @click="toggleSound"
    >
      <UIcon :name="muted ? 'lucide:volume-x' : 'lucide:volume-2'" class="h-5 w-5" />
    </button>
  </div>
</template>
