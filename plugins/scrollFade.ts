// `v-scroll-fade` directive: a horizontally scrolling strip (tabs, chips) gets a
// soft haze on the side that still has hidden content, so the edge never looks
// like a hard cut-off ("is it broken?") and it is clear the row scrolls. The
// haze is a CSS mask driven by two classes (see .scroll-fade in surface.css);
// each side fades only while there is something past it. `v-scroll-fade.y`
// does the same for a vertical scroller.
type FadeEl = HTMLElement & { __fadeCleanup?: () => void };

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive('scroll-fade', {
    mounted(el: FadeEl, binding: { modifiers?: Record<string, boolean> }) {
      const vertical = !!binding.modifiers?.y;
      el.classList.add('scroll-fade');
      if (vertical) el.classList.add('scroll-fade--y');
      const [before, after] = vertical ? ['fade-t', 'fade-b'] : ['fade-l', 'fade-r'];
      const update = () => {
        const pos = vertical ? el.scrollTop : el.scrollLeft;
        const size = vertical ? el.clientHeight : el.clientWidth;
        const total = vertical ? el.scrollHeight : el.scrollWidth;
        el.classList.toggle(before, pos > 2);
        el.classList.toggle(after, pos + size < total - 2);
      };
      update();
      el.addEventListener('scroll', update, { passive: true });
      const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
      ro?.observe(el);
      for (const child of Array.from(el.children)) ro?.observe(child);
      const mo = typeof MutationObserver !== 'undefined' ? new MutationObserver(update) : null;
      mo?.observe(el, { childList: true, subtree: true });
      el.__fadeCleanup = () => {
        el.removeEventListener('scroll', update);
        ro?.disconnect();
        mo?.disconnect();
      };
    },
    unmounted(el: FadeEl) {
      el.__fadeCleanup?.();
    },
    getSSRProps: () => ({}),
  });
});
