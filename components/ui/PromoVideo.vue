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

// iPhone-style "continuous" corners (the iOS superellipse-ish curve, same
// construction as app icons / device screens): three cubic beziers per
// corner, built in pixels from the measured player size. CSS border-radius
// only does circular arcs and `corner-shape` isn't in Safari/Firefox yet.
// Until measured (SSR / first paint) a plain rounded rect stands in.
const CORNER_RADIUS_RATIO = 0.12; // iPhone screen radius / width
const clipPath = ref('');
const CORNER: Array<[number, number]> = [
  [1.08849296, 0], [0.86840694, 0], [0.63149379, 0.07491139],
  [0.37282383, 0.16905956], [0.16905956, 0.37282383], [0.07491139, 0.63149379],
  [0, 0.86840694], [0, 1.08849296], [0, 1.52866483],
];

function buildContinuousPath(w: number, h: number): string {
  const r = w * CORNER_RADIUS_RATIO;
  const ext = 1.52866483 * r;
  const f = (n: number) => n.toFixed(2);
  const corner = (map: (a: number, b: number) => [number, number]) => {
    let out = '';
    for (let i = 0; i < CORNER.length; i += 3) {
      const pts = [0, 1, 2].map((k) => map(CORNER[i + k][0] * r, CORNER[i + k][1] * r));
      out += `C${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(',')}`;
    }
    return out;
  };
  return (
    `M${f(ext)} 0L${f(w - ext)} 0` +
    corner((a, b) => [w - a, b]) +
    `L${f(w)} ${f(h - ext)}` +
    corner((a, b) => [w - b, h - a]) +
    `L${f(ext)} ${f(h)}` +
    corner((a, b) => [a, h - b]) +
    `L0 ${f(ext)}` +
    corner((a, b) => [b, a]) +
    'Z'
  );
}

let sizeObserver: ResizeObserver | null = null;

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
  if (!wrapRef.value) return;
  if (typeof ResizeObserver !== 'undefined') {
    sizeObserver = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0) clipPath.value = `path('${buildContinuousPath(width, height)}')`;
    });
    sizeObserver.observe(wrapRef.value);
  }
  if (typeof IntersectionObserver === 'undefined') return;
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
  sizeObserver?.disconnect();
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
  <div class="mx-auto w-full max-w-[230px] drop-shadow-lg">
    <div
      ref="wrapRef"
      class="relative w-full overflow-hidden bg-white dark:bg-gray-900"
      :class="clipPath ? '' : 'rounded-[2rem]'"
      :style="{ aspectRatio: `${props.width} / ${props.height}`, clipPath: clipPath || undefined }"
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
        class="absolute bottom-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-emerald-600 shadow-md backdrop-blur transition-colors hover:bg-white dark:bg-gray-800/90 dark:text-emerald-300"
        :aria-label="muted ? props.soundOnLabel : props.soundOffLabel"
        @click="toggleSound"
      >
        <UIcon :name="muted ? 'lucide:volume-x' : 'lucide:volume-2'" class="h-4 w-4" />
      </button>
    </div>
  </div>
</template>
