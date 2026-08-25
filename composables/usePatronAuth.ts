import { getPatronMe, type PatronMe } from '@/api/menu/public/patron';
import { CookieKeys, LSKeys } from '@/utils/storageKeys';
import { getApiBasePath } from '@/utils/api-base';
import { logWarn } from '@/utils/logger';

const hubApiBase = getApiBasePath('hub');

// Namespace-less Patron identity (see hub.gtw's PatronAuthService) for the
// Menu storefront -- deliberately separate from useAuth() (the namespace-
// owning hub User session): a storefront visitor authenticates here without
// ever touching the tenant-owner login flow.
export function usePatronAuth() {
  const token = useCookie<string | null>(CookieKeys.PATRON_TOKEN);
  const me = useState<PatronMe | null>('patron_me', () => null);
  const loading = useState<boolean>('patron_loading', () => false);

  const isLoggedIn = computed(() => !!token.value && !!me.value);

  async function fetchMe(force = false) {
    if (!token.value) {
      me.value = null;
      return;
    }
    if (me.value && !force) return;

    loading.value = true;
    try {
      me.value = await getPatronMe(token.value);
      if (process.client) {
        try { localStorage.setItem(LSKeys.HAS_PATRON_SESSION, '1'); } catch {}
      }
    } catch {
      // Expired/invalid token -- degrade to "not logged in" rather than
      // surfacing an error on what's an optional, best-effort identity.
      me.value = null;
    } finally {
      loading.value = false;
    }
  }

  // patron_token is a short-lived (15 min) cookie backed by an httpOnly
  // patron_refresh_token -- mirrors useAuth()'s refreshAccessToken(), but
  // there was no Patron equivalent until now, so a Patron browsing a page
  // that never makes an authenticated API call (the Catalog and its filtered
  // views are mock/static) had no way to renew before the cookie expired and
  // silently looked logged out.
  async function refreshToken(): Promise<boolean> {
    try {
      const response = await fetch(`${hubApiBase}/patron-auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) return false;

      const data = await response.json().catch(() => null);
      if (data?.token) {
        token.value = data.token;
      } else if (typeof window !== 'undefined') {
        const cookies = document.cookie.split(';').reduce((acc: Record<string, string>, c) => {
          const [k, v] = c.trim().split('=');
          if (k) acc[k] = decodeURIComponent(v || '');
          return acc;
        }, {});
        if (cookies[CookieKeys.PATRON_TOKEN]) token.value = cookies[CookieKeys.PATRON_TOKEN];
      }
      return true;
    } catch (error) {
      logWarn(`[patron-auth] Token refresh failed: ${String(error)}`);
      return false;
    }
  }

  function login(redirectUri?: string) {
    const redirect = encodeURIComponent(redirectUri || window.location.href);
    // Same /google/auth round trip useAuth().login() uses -- identity=patron
    // is the only thing that tells hub.gtw's callback to mint a Patron
    // instead of a hub User, so this never needs its own Google Cloud
    // Console redirect_uri registration.
    window.location.href = `${hubApiBase}/google/auth?identity=patron&redirect_uri=${redirect}`;
  }

  function logout() {
    token.value = null;
    me.value = null;
  }

  return { token, me, loading, isLoggedIn, fetchMe, refreshToken, login, logout };
}
