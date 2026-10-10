import { recordLoginClick, clearLoginPending } from '@/utils/loginPending';

// Header nav items (`.hdr-item`) show a spinner in place of their icon from the click until the next
// page has rendered (`page:finish`), with a safety timeout for clicks that never navigate.
const NAV_PENDING_MAX_MS = 8000;

export default defineNuxtPlugin((nuxtApp) => {
  let pendingNav: Element | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clearNav = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    if (pendingNav) {
      pendingNav.removeAttribute('data-nav-pending');
      pendingNav.removeAttribute('aria-busy');
      pendingNav = null;
    }
  };

  document.addEventListener('click', (e) => {
    recordLoginClick(e.target);
    const item = e.target instanceof Element ? e.target.closest('.hdr-item') : null;
    if (!item || item.getAttribute('aria-disabled') === 'true' || item.classList.contains('hdr-item--on')) return;
    clearNav();
    pendingNav = item;
    item.setAttribute('data-nav-pending', '1');
    item.setAttribute('aria-busy', 'true');
    timer = setTimeout(clearNav, NAV_PENDING_MAX_MS);
  }, true);

  nuxtApp.hook('page:finish', clearNav);
  nuxtApp.hook('app:error', clearNav);

  // Back/forward cache restores the page mid-redirect: drop the spinners.
  window.addEventListener('pageshow', (e) => {
    if ((e as PageTransitionEvent).persisted) { clearLoginPending(); clearNav(); }
  });
});
