// `v-reveal` directive: the element fades up once as it enters the viewport
// (IntersectionObserver; transform/opacity only -- see .reveal in
// assets/css/surface.css). The value is an optional delay in ms for staggering.
type RevealEl = HTMLElement & { __revealIO?: IntersectionObserver };

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive('reveal', {
    mounted(el: RevealEl, binding: { value?: number }) {
      el.classList.add('reveal');
      if (binding.value) el.style.transitionDelay = `${binding.value}ms`;
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
