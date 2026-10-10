// Scroll and pointer effects for the landing page. Everything is transform/opacity driven, skipped under
// prefers-reduced-motion, and the pointer effects only run on devices that really hover.
//
//   [data-fx-progress]  gradient bar: --p = scroll progress (0..1)
//   [data-fx-parallax]  drifts against the scroll (value = speed, e.g. -0.15)
//   [data-fx-scale]     grows from .92 to 1 as it scrolls into view
//   .fx-spot            soft light follows the pointer (--mx/--my)
//   .cta-pill           pulled a few px towards the pointer (magnetic)
export function useHomeFx() {
  let cleanup: Array<() => void> = [];

  onMounted(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const scroller = (document.querySelector('main') as HTMLElement | null) || (document.scrollingElement as HTMLElement);
    const root = document.querySelector('[data-home-fx]') as HTMLElement | null;
    if (!scroller || !root) return;

    // ---- scroll-linked ----
    let raf = 0;
    const update = () => {
      raf = 0;
      const vh = window.innerHeight;
      const max = scroller.scrollHeight - scroller.clientHeight;
      root.style.setProperty('--fx-p', String(max > 0 ? Math.min(1, scroller.scrollTop / max) : 0));
      root.querySelectorAll<HTMLElement>('[data-fx-parallax]').forEach((el) => {
        const host = el.parentElement;
        if (!host) return;
        const r = host.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) return;
        const speed = parseFloat(el.dataset.fxParallax || '0.1');
        el.style.transform = `translate3d(0, ${((r.top + r.height / 2 - vh / 2) * speed).toFixed(1)}px, 0)`;
      });
      root.querySelectorAll<HTMLElement>('[data-fx-scale]').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        const t = Math.min(1, Math.max(0, (vh * 0.95 - r.top) / (vh * 0.5)));
        el.style.transform = `scale(${(0.92 + 0.08 * t).toFixed(3)})`;
      });
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };
    scroller.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    update();
    cleanup.push(() => {
      scroller.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (raf) cancelAnimationFrame(raf);
    });

    // ---- pointer effects (mouse / trackpad only) ----
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    let magnet: HTMLElement | null = null;
    const resetMagnet = () => { if (magnet) { magnet.style.translate = ''; magnet = null; } };
    const onMove = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (!t) return;
      const spot = t.closest<HTMLElement>('.fx-spot');
      if (spot) {
        const r = spot.getBoundingClientRect();
        spot.style.setProperty('--mx', `${e.clientX - r.left}px`);
        spot.style.setProperty('--my', `${e.clientY - r.top}px`);
      }
      const pill = t.closest<HTMLElement>('.cta-pill');
      if (pill) {
        if (magnet && magnet !== pill) resetMagnet();
        magnet = pill;
        const r = pill.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
        const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
        pill.style.translate = `${(dx * 10).toFixed(1)}px ${(dy * 8).toFixed(1)}px`;
      } else resetMagnet();
    };
    root.addEventListener('pointermove', onMove, { passive: true });
    root.addEventListener('pointerleave', resetMagnet);
    cleanup.push(() => {
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerleave', resetMagnet);
    });
  });

  onBeforeUnmount(() => { cleanup.forEach((fn) => fn()); cleanup = []; });
}
