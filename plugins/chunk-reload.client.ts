import { logWarn } from '@/utils/logger';

// Nuxt's built-in stale-chunk recovery (`experimental.emitRouteChunkError`,
// on by default) only catches chunk failures during route navigation --
// vue-router's own lazy page-component loading. It does nothing for the
// dynamic `import('@/api/...')` calls this app uses everywhere inside
// already-loaded pages (board/staff loads, mutations, ...) to keep those
// modules out of the page's own chunk. After a deploy rotates `_nuxt/**`
// asset hashes, a tab that's been open across that deploy 404s on those
// imports with no recovery, stranding the user on a page-level error state.
// Vite dispatches this event for every dynamic import it processes, not
// just route ones, so it covers exactly that gap.
export default defineNuxtPlugin(() => {
  if (!import.meta.client) return;

  window.addEventListener('vite:preloadError', (event) => {
    logWarn('[chunk-reload] stale build asset, reloading', (event as Event & { payload?: unknown }).payload);
    event.preventDefault();
    reloadNuxtApp({ persistState: true });
  });
});
