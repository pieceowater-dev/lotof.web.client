<script setup lang="ts">
// Stacked "deck of cards" of promo videos. The front card plays (muted) once
// the deck is >60% in view; the cards behind peek out to the right and show
// only a poster. Clicking a back card pulls it to the front and sends the old
// front card to the back of the deck. Nothing is downloaded until a card is
// the front card AND the deck is near the viewport.
export interface DeckSlide {
  id: string;
  src: string;
  poster: string;
}

const props = defineProps<{
  slides: DeckSlide[];
  width: number;
  height: number;
  soundOnLabel?: string;
  soundOffLabel?: string;
}>();

const active = defineModel<number>('active', { default: 0 });

// iPhone-style "continuous" corners (the iOS superellipse-ish curve, same
// construction as app icons / device screens): three cubic beziers per
// corner, built in pixels from the measured card size. CSS border-radius
// only does circular arcs and `corner-shape` isn't in Safari/Firefox yet.
// Until measured (SSR / first paint) a plain rounded rect stands in.
const CORNER_RADIUS_RATIO = 0.12; // iPhone screen radius / width
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

// order[0] is the front card; the rest are the cards behind it, nearest first.
const order = ref(props.slides.map((_, i) => i));
const flying = ref<number | null>(null);
const clipPath = ref('');
const muted = ref(true);
const nearView = ref(false);
const inView = ref(false);
const loadedIds = ref<Set<string>>(new Set());
const warmed = new Set<string>();
const readyIds = ref<Set<string>>(new Set()); // videos whose first frame has loaded
const deckRef = ref<HTMLElement | null>(null);
const cardRef = ref<HTMLElement | null>(null);
const videoRefs = new Map<string, HTMLVideoElement>();
let sizeObserver: ResizeObserver | null = null;
let nearObserver: IntersectionObserver | null = null;
let viewObserver: IntersectionObserver | null = null;
let flyTimer: ReturnType<typeof setTimeout> | null = null;

const front = computed(() => order.value[0]);

function setVideoRef(id: string, el: unknown) {
  if (el) videoRefs.set(id, el as HTMLVideoElement);
  else videoRefs.delete(id);
}

function syncPlayback() {
  props.slides.forEach((slide, i) => {
    const v = videoRefs.get(slide.id);
    if (!v) return;
    if (i === front.value && inView.value) v.play().catch(() => { /* autoplay blocked: poster stays */ });
    else v.pause();
  });
}

// Loading strategy: nothing is fetched until the deck is near the viewport.
// Then the front card's video loads first; once its first frame is ready the
// next two cards' videos are attached too and buffer in the background (they
// stay in the HTTP cache), so flipping to them is instant. Anything already
// attached stays attached. Until a card's first frame is ready it shows its
// poster under a soft blurred shimmer.
function updateLoads() {
  if (!nearView.value) return;
  const ids = order.value.map((i) => props.slides[i].id);
  loadedIds.value.add(ids[0]);
  if (!readyIds.value.has(ids[0])) return;
  ids.slice(1, 3).forEach((id) => {
    loadedIds.value.add(id);
    // Also warm the HTTP cache with the whole (~0.6 MB) file, so it's there
    // even where browsers refuse to preload <video> (iOS, data saver).
    const slide = props.slides.find((sl) => sl.id === id);
    if (slide && !warmed.has(id)) {
      warmed.add(id);
      fetch(slide.src, { cache: 'force-cache' }).catch(() => { warmed.delete(id); });
    }
  });
}
watch([order, nearView, () => readyIds.value.size], updateLoads, { immediate: true });
watch(front, () => nextTick(syncPlayback));
watch(inView, () => nextTick(syncPlayback));

watch(active, (v) => {
  if (v !== front.value) bringToFront(v);
});

function bringToFront(index: number, keepSound = false, back = false) {
  if (index === front.value) return;
  const old = front.value;
  const rest = order.value.filter((i) => i !== index && i !== old);
  // Forward: the old front goes to the back of the deck. Backwards (swipe
  // right): the card pulled from the back comes in on top and the old front
  // settles in as the second card.
  order.value = back ? [index, old, ...rest] : [index, ...rest, old];
  active.value = index;
  if (!keepSound) muted.value = true;
  videoRefs.forEach((v) => { v.muted = muted.value; v.currentTime = 0; });
  // Forward: the old front lifts off to the left first, then slides in at the
  // back. Backwards: the incoming card sweeps in from the left onto the front.
  flying.value = back ? index : old;
  if (flyTimer) clearTimeout(flyTimer);
  flyTimer = setTimeout(() => { flying.value = null; }, 260);
}

// When the front video finishes, flip to the next card in the deck.
function onEnded(index: number) {
  if (index === front.value && order.value.length > 1) bringToFront(order.value[1], true);
}

// Swipe: left = next card, right = back to the previous one (the card that
// was last sent to the back of the deck). Vertical scrolling stays native
// (touch-action: pan-y), and a swipe doesn't also count as a card click.
let swipeStart: { x: number; y: number } | null = null;
let swiped = false;

function onPointerDown(e: PointerEvent) {
  swipeStart = { x: e.clientX, y: e.clientY };
  swiped = false;
}

function onPointerUp(e: PointerEvent) {
  if (!swipeStart) return;
  const dx = e.clientX - swipeStart.x;
  const dy = e.clientY - swipeStart.y;
  swipeStart = null;
  if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.2 || order.value.length < 2) return;
  swiped = true;
  if (dx < 0) bringToFront(order.value[1], true);
  else bringToFront(order.value[order.value.length - 1], true, true);
}

function onCardClick(index: number) {
  if (swiped) { swiped = false; return; }
  bringToFront(index);
}

function toggleSound() {
  const v = videoRefs.get(props.slides[front.value].id);
  if (!v) return;
  muted.value = !muted.value;
  v.muted = muted.value;
  if (!muted.value) v.play().catch(() => {});
}

// Cards behind the front one are slightly blurred to push them back.
function blurPx(index: number) {
  const pos = flying.value === index ? 0 : order.value.indexOf(index);
  return pos === 0 ? 0 : pos === 1 ? 1.2 : 2;
}

function cardStyle(index: number) {
  const pos = order.value.indexOf(index);
  if (flying.value === index) {
    return { transform: 'translateX(-62%) rotate(-9deg)', zIndex: 50, opacity: 1 };
  }
  const t = [
    'translateX(0) rotate(0deg) scale(1)',
    'translateX(26%) rotate(4deg) scale(0.94)',
    'translateX(46%) rotate(8deg) scale(0.88)',
  ][Math.min(pos, 2)];
  return { transform: t, zIndex: 10 - pos, opacity: pos > 2 ? 0 : 1 };
}

onMounted(() => {
  if (typeof ResizeObserver !== 'undefined' && cardRef.value) {
    sizeObserver = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0) clipPath.value = `path('${buildContinuousPath(width, height)}')`;
    });
    sizeObserver.observe(cardRef.value);
  }
  if (!deckRef.value || typeof IntersectionObserver === 'undefined') return;
  nearObserver = new IntersectionObserver(
    (entries) => { if (entries.some((e) => e.isIntersecting)) nearView.value = true; },
    { rootMargin: '300px 0px' },
  );
  nearObserver.observe(deckRef.value);
  viewObserver = new IntersectionObserver(
    (entries) => {
      // Hysteresis: start above 60%, stop only below 30%, so scrolling around
      // the boundary doesn't make the video stutter between play and pause.
      const ratio = Math.max(...entries.map((e) => e.intersectionRatio));
      if (ratio > 0.6) { inView.value = true; nearView.value = true; }
      else if (ratio < 0.3) inView.value = false;
    },
    { threshold: [0, 0.3, 0.6, 0.61] },
  );
  viewObserver.observe(deckRef.value);
});

onBeforeUnmount(() => {
  sizeObserver?.disconnect();
  nearObserver?.disconnect();
  viewObserver?.disconnect();
  if (flyTimer) clearTimeout(flyTimer);
});
</script>

<template>
  <div
    ref="deckRef"
    class="relative mx-auto w-full max-w-[460px] select-none touch-pan-y"
    :style="{ aspectRatio: '1 / 1.12' }"
    @pointerdown="onPointerDown"
    @pointerup="onPointerUp"
    @pointercancel="swipeStart = null"
  >
    <div
      v-for="(slide, i) in props.slides"
      :key="slide.id"
      :ref="(el) => { if (i === 0) cardRef = el as HTMLElement | null; }"
      class="absolute left-0 top-0 w-[62%] origin-bottom transform-gpu transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] [backface-visibility:hidden]"
      :class="i === front ? '' : 'cursor-pointer'"
      :style="cardStyle(i)"
      :role="i === front ? undefined : 'button'"
      :tabindex="i === front ? undefined : 0"
      :aria-label="i === front ? undefined : slide.id"
      @click="onCardClick(i)"
      @keydown.enter="bringToFront(i)"
    >
      <!-- Soft shadow: a blurred dark copy of the card shape behind it (a
           drop-shadow filter on the card itself flickered over the video
           while scrolling). -->
      <div class="pointer-events-none absolute inset-0 translate-y-2 opacity-25 blur-md" aria-hidden="true">
        <div
          class="h-full w-full bg-black"
          :class="clipPath ? '' : 'rounded-[2rem]'"
          :style="{ clipPath: clipPath || undefined }"
        />
      </div>
      <div
        class="relative w-full overflow-hidden bg-white transition-[filter] duration-500 dark:bg-gray-900"
        :class="clipPath ? '' : 'rounded-[2rem]'"
        :style="{ aspectRatio: `${props.width} / ${props.height}`, clipPath: clipPath || undefined, filter: blurPx(i) ? `blur(${blurPx(i)}px)` : undefined }"
      >
        <video
          :ref="(el) => setVideoRef(slide.id, el)"
          class="absolute inset-0 h-full w-full object-cover"
          :src="loadedIds.has(slide.id) ? slide.src : undefined"
          :poster="slide.poster"
          :width="props.width"
          :height="props.height"
          :preload="!loadedIds.has(slide.id) ? 'none' : i === front ? 'auto' : 'metadata'"
          muted
          playsinline
          @loadeddata="readyIds.add(slide.id)"
          @ended="onEnded(i)"
        />
        <!-- Not ready yet: blur the poster and pulse, so it reads as loading. -->
        <div
          v-if="loadedIds.has(slide.id) && !readyIds.has(slide.id)"
          class="pointer-events-none absolute inset-0 animate-pulse bg-white/40 backdrop-blur-sm"
          aria-hidden="true"
        />
        <button
          v-if="i === front && loadedIds.has(slide.id)"
          type="button"
          class="absolute bottom-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-emerald-600 shadow-md backdrop-blur transition-colors hover:bg-white dark:bg-gray-800/90 dark:text-emerald-300"
          :aria-label="muted ? props.soundOnLabel : props.soundOffLabel"
          @click.stop="toggleSound"
        >
          <UIcon :name="muted ? 'lucide:volume-x' : 'lucide:volume-2'" class="h-4 w-4" />
        </button>
      </div>
    </div>
  </div>
</template>
