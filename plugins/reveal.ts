// `v-reveal` directive: the element fades up once as it enters the viewport
// (IntersectionObserver; transform/opacity only -- see .reveal in
// assets/css/surface.css). The value is an optional delay in ms for staggering.
type RevealEl = HTMLElement & { __revealIO?: IntersectionObserver };

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive('reveal', {
    mounted(el: RevealEl, binding: { value?: number }) {
      // Phones show everything at once. Content hidden until scrolled to made
      // visitors think a page ended after the first card (guide, catalog, hub)
      // -- nothing hinted that more was below. The fade-up stays on desktop,
      // where the whole page is visible anyway.
      if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) return;
      el.classList.add('reveal');
      if (binding.value) el.style.transitionDelay = `${binding.value / 2}ms`; // 2x faster motion
      if (typeof IntersectionObserver === 'undefined') {
        el.classList.add('reveal-in');
        return;
      }
      const io = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            el.classList.add('reveal-in');
            io.disconnect();
          }
        },
        // A fraction of the element's own height can never be on screen for a
        // block taller than ~8 viewports (a long legal document), which left it
        // invisible forever. Ask for at most half a viewport's worth instead.
        { threshold: Math.min(0.12, (window.innerHeight * 0.5) / Math.max(el.offsetHeight, 1)), rootMargin: '0px 0px -8% 0px' },
      );
      io.observe(el);
      el.__revealIO = io;
    },
    unmounted(el: RevealEl) {
      el.__revealIO?.disconnect();
    },
    getSSRProps: () => ({}),
  });
});
