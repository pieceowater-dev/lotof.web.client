// `v-reveal` directive: the element fades up once as it enters the viewport
// (IntersectionObserver; transform/opacity only -- see .reveal in
// assets/css/surface.css). The value is an optional delay in ms for staggering.
type RevealEl = HTMLElement & { __revealIO?: IntersectionObserver };

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive('reveal', {
    mounted(el: RevealEl, binding: { value?: number }) {
      // Pages that opt out (`data-reveal-off-mobile`, e.g. /hub) show everything at once on phones:
      // hidden-until-scrolled blocks made visitors forget the content was there.
      if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches && el.closest('[data-reveal-off-mobile]')) return;
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
        { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
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
