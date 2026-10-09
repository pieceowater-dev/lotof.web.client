// The page scrolls inside <main class="main-scroll">, not the window, so
// Nuxt's default scroll-to-top never fires. Entering or moving within the
// Гид should always start at the top of the page.
export default defineNuxtPlugin(() => {
  const router = useRouter();
  router.afterEach((to, from) => {
    if (to.path === from.path || !to.path.startsWith('/guide')) return;
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('main.main-scroll')?.scrollTo({ top: 0, behavior: 'instant' });
    });
  });
});
