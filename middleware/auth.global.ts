import { CookieKeys } from '@/utils/storageKeys';
import { useAtraceToken } from '@/composables/useAtraceToken';
import { useContactsToken } from '@/composables/useContactsToken';

export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/') return;
  const routeName = typeof to.name === 'string' ? to.name : '';
  // Public content pages
  if (routeName === 'feed' || routeName === 'slug' || routeName === 'news' || to.path === '/feed' || to.path === '/news') return;
  // Allow public access to public post page
  if (/^\/shared\/[^/]+\/atrace\/post\/[\w-]+$/.test(to.path)) return;
  if (process.server) return;

  const isAtraceRoute = /\/atrace(\/|$)/.test(to.path);
  const isContactsRoute = /\/contacts(\/|$)/.test(to.path);
  const token = useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value;
  if (!token) {
    await Promise.resolve();
    if (!useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value) {
      try {
        const full = to.fullPath || to.path;
        const trimmed = full.startsWith('/') ? full.slice(1) : full;
        localStorage.setItem('back-to', trimmed);
      } catch {}
      if (to.path.includes('/atrace/qr')) {
        return navigateTo({ path: '/', query: { 'auth-needed': 'true' } });
      }
      return navigateTo('/');
    }
  }

  // Restore current user once after full page reload on non-root routes.
  const { user, initialized, loading, fetchUser } = useAuth();
  if (token && !user.value && !initialized.value && !loading.value) {
    await fetchUser();
  }

  if (isAtraceRoute) {
    const nsSlug = typeof to.params?.namespace === 'string' ? to.params.namespace : '';
    // Skip token check for plans page - it doesn't require app token
    if (to.path.includes('/atrace/plans')) {
      return;
    }
    const { ensure, current } = useAtraceToken();
    const atraceToken = current() || (nsSlug ? await ensure(nsSlug, token) : null);
    if (!atraceToken) {
      try {
        const full = to.fullPath || to.path;
        const trimmed = full.startsWith('/') ? full.slice(1) : full;
        localStorage.setItem('back-to', trimmed);
      } catch {}
      return navigateTo('/');
    }
  }

  if (isContactsRoute) {
    const nsSlug = typeof to.params?.namespace === 'string' ? to.params.namespace : '';
    // Skip token check for plans page - it doesn't require app token
    if (to.path.includes('/contacts/plans')) {
      return;
    }
    const { ensure, current } = useContactsToken();
    const contactsToken = current() || (nsSlug ? await ensure(nsSlug, token) : null);
    if (!contactsToken) {
      try {
        const full = to.fullPath || to.path;
        const trimmed = full.startsWith('/') ? full.slice(1) : full;
        localStorage.setItem('back-to', trimmed);
      } catch {}
      return navigateTo('/');
    }
  }
});