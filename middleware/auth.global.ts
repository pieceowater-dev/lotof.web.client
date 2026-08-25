import { CookieKeys } from '@/utils/storageKeys';
import { useAtraceToken } from '@/composables/useAtraceToken';
import { useContactsToken } from '@/composables/useContactsToken';
import { useMenuToken } from '@/composables/useMenuToken';
import { useTasksToken } from '@/composables/useTasksToken';
import { useGoodsToken } from '@/composables/useGoodsToken';
import { usePhoneGate } from '@/composables/usePhoneGate';
import { refreshAccessToken } from '@/api/auth/tokenRefresh';

export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/') return;
  // lota Гид must work fully without authorization -- every /guide page
  // is public. Without this, the isAtraceRoute/isContactsRoute/isMenuRoute/
  // isTasksRoute regexes below match on the substring "/atrace", "/contacts"
  // etc. ANYWHERE in the path, so /guide/atrace, /guide/contacts, /guide/menu
  // and /guide/issues were wrongly caught by the app-token guards and bounced
  // an anonymous visitor to "/" with auth-needed=true.
  if (to.path === '/guide' || to.path.startsWith('/guide/')) return;
  const routeName = typeof to.name === 'string' ? to.name : '';
  // Public content pages
  if (routeName === 'feed' || routeName === 'slug' || routeName === 'news' || routeName === 'category-slug' || to.path === '/feed' || to.path === '/news') return;
  // Public product landing pages (/issues, /menu, /contacts, /atrace,
  // /chekalka) -- exact top-level paths only, so this doesn't also swallow
  // the namespaced /{ns}/issues etc. below, which do need the token checks.
  // /chekalka was missing from this list for a while: every anonymous
  // chekalka.kz visitor with no token got silently bounced to "/" before
  // ever seeing the page, since nothing below exempts it either -- it has
  // no "/atrace" substring, so isAtraceRoute never applied to save it.
  if (to.path === '/issues' || to.path === '/menu' || to.path === '/contacts' || to.path === '/atrace' || to.path === '/goods' || to.path === '/chekalka') return;
  // /catalog and its single-vertical filtered views (/stores, /services) are
  // the public Patron-facing marketplace -- never require a hub token to
  // browse (see pages/catalog.vue, which only asks a visitor to log in as a
  // Patron, and does so inline, never via this middleware).
  if (to.path === '/catalog' || to.path === '/stores' || to.path === '/services') return;
  // Allow public access to public post page
  if (/^\/to\/[^/]+\/atrace\/post\/[\w-]+$/.test(to.path)) return;
  // Allow public, unauthenticated access to the public storefront page
  if (/^\/to\/[^/]+\/menu(\/|$)/.test(to.path)) return;
  // Allow public, unauthenticated access to the public task tracking page
  if (/^\/to\/[^/]+\/track(\/|$)/.test(to.path)) return;
  if (process.server) return;

  const isAtraceRoute = /\/atrace(\/|$)/.test(to.path);
  const isContactsRoute = /\/contacts(\/|$)/.test(to.path);
  const isMenuRoute = /\/menu(\/|$)/.test(to.path);
  const isTasksRoute = /\/issues(\/|$)/.test(to.path);
  const isGoodsRoute = /\/goods(\/|$)/.test(to.path);
  let token = useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value;
  if (!token) {
    // Try one refresh before redirecting to root when access token is expired.
    const refreshed = await refreshAccessToken();
    token = useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value;
    if (!refreshed || !token) {
      try {
        const full = to.fullPath || to.path;
        const trimmed = full.startsWith('/') ? full.slice(1) : full;
        localStorage.setItem('back-to', trimmed);
      } catch {}
      if (to.path.includes('/atrace/qr')) {
        return navigateTo({ path: '/', query: { 'auth-needed': 'true' } });
      }
      // auth-needed tells the homepage to auto-trigger the login flow on
      // arrival instead of leaving the visitor to notice and click "Log In"
      // themselves -- same flag the /atrace/qr redirect already used.
      return navigateTo({ path: '/', query: { 'auth-needed': 'true' } });
    }
  }

  // Restore current user once after full page reload on non-root routes.
  const { user, initialized, loading, fetchUser } = useAuth();
  if (token && !user.value && !initialized.value && !loading.value) {
    await fetchUser();
  }

  // Soft, self-throttled nudge to add a phone number -- a no-op if one is
  // already on file, the gate is already open, or we nudged recently.
  usePhoneGate().maybeNudge();

  if (isAtraceRoute) {
    const nsSlug = typeof to.params?.namespace === 'string' ? to.params.namespace : '';
    // Skip token check for plans page - it doesn't require app token.
    // Same for the QR check-in page: a scanner who isn't an active member
    // yet is exactly the case that page needs to detect itself and turn
    // into an onboarding request (see qr.vue's runCheck) -- failing here
    // first would bounce them to the login page before that logic ever
    // runs, even though they're already logged in.
    // Same for the recorded (post-scan result) page: qr.vue redirects a
    // non-member here with ok=pending/ok=0 precisely because they have no
    // app token -- requiring one here would re-fail the same ensure() call
    // qr.vue already gave up on, and silently bounce them home before they
    // ever see "your request was submitted" or the failure reason.
    if (to.path.includes('/atrace/plans') || to.path.includes('/atrace/qr') || to.path.includes('/atrace/recorded')) {
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
      // auth-needed tells the homepage to auto-trigger the login flow on
      // arrival instead of leaving the visitor to notice and click "Log In"
      // themselves -- same flag the /atrace/qr redirect already used.
      return navigateTo({ path: '/', query: { 'auth-needed': 'true' } });
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
      // auth-needed tells the homepage to auto-trigger the login flow on
      // arrival instead of leaving the visitor to notice and click "Log In"
      // themselves -- same flag the /atrace/qr redirect already used.
      return navigateTo({ path: '/', query: { 'auth-needed': 'true' } });
    }
  }

  if (isMenuRoute) {
    const nsSlug = typeof to.params?.namespace === 'string' ? to.params.namespace : '';
    // Skip token check for plans page - it doesn't require app token
    if (to.path.includes('/menu/plans')) {
      return;
    }
    const { ensure, current } = useMenuToken();
    const menuToken = current() || (nsSlug ? await ensure(nsSlug, token) : null);
    if (!menuToken) {
      try {
        const full = to.fullPath || to.path;
        const trimmed = full.startsWith('/') ? full.slice(1) : full;
        localStorage.setItem('back-to', trimmed);
      } catch {}
      // auth-needed tells the homepage to auto-trigger the login flow on
      // arrival instead of leaving the visitor to notice and click "Log In"
      // themselves -- same flag the /atrace/qr redirect already used.
      return navigateTo({ path: '/', query: { 'auth-needed': 'true' } });
    }
  }

  if (isTasksRoute) {
    const nsSlug = typeof to.params?.namespace === 'string' ? to.params.namespace : '';
    // Skip token check for plans page - it doesn't require app token
    if (to.path.includes('/issues/plans')) {
      return;
    }
    const { ensure, current } = useTasksToken();
    const tasksToken = current() || (nsSlug ? await ensure(nsSlug, token) : null);
    if (!tasksToken) {
      try {
        const full = to.fullPath || to.path;
        const trimmed = full.startsWith('/') ? full.slice(1) : full;
        localStorage.setItem('back-to', trimmed);
      } catch {}
      // auth-needed tells the homepage to auto-trigger the login flow on
      // arrival instead of leaving the visitor to notice and click "Log In"
      // themselves -- same flag the /atrace/qr redirect already used.
      return navigateTo({ path: '/', query: { 'auth-needed': 'true' } });
    }
  }

  if (isGoodsRoute) {
    const nsSlug = typeof to.params?.namespace === 'string' ? to.params.namespace : '';
    // Skip token check for plans page - it doesn't require app token
    if (to.path.includes('/goods/plans')) {
      return;
    }
    const { ensure, current } = useGoodsToken();
    const goodsToken = current() || (nsSlug ? await ensure(nsSlug, token) : null);
    if (!goodsToken) {
      try {
        const full = to.fullPath || to.path;
        const trimmed = full.startsWith('/') ? full.slice(1) : full;
        localStorage.setItem('back-to', trimmed);
      } catch {}
      // auth-needed tells the homepage to auto-trigger the login flow on
      // arrival instead of leaving the visitor to notice and click "Log In"
      // themselves -- same flag the /atrace/qr redirect already used.
      return navigateTo({ path: '/', query: { 'auth-needed': 'true' } });
    }
  }
});