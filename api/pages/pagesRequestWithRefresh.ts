import { setPagesAppToken } from '@/api/clients';
import { pagesGetAppToken } from '@/api/pages/auth/getAppToken';
import { CookieKeys } from '@/utils/storageKeys';
import { useAuth } from '@/composables/useAuth';
import { usePagesToken } from '@/composables/usePagesToken';
import { logWarn } from '@/utils/logger';

/**
 * Wraps a pagesClient request and, on a missing/invalid PagesAuthorization token,
 * exchanges the hub token for a fresh pages token and retries once.
 */
export async function pagesRequestWithRefresh<T>(fn: () => Promise<T>, nsSlug: string): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isUnauthorized = error?.response?.errors?.some((e: any) => {
      const m = typeof e?.message === 'string' ? e.message : '';
      return m.includes('PagesAuthorization token is invalid')
        || (m.includes('PagesAuthorization') && (m.includes('missing') || m.includes('unauthorized')));
    });
    if (isUnauthorized) {
      try { useCookie(CookieKeys.PAGES_TOKEN).value = null as any; } catch (e) { logWarn('[pages] failed to clear token cookie', e); }
      setPagesAppToken(null);
      try { usePagesToken().clear(); } catch (e) { logWarn('[pages] failed to clear token state', e); }
      const { token } = useAuth();
      const hubToken = token.value;
      if (!hubToken) throw error;
      const newToken = await pagesGetAppToken(hubToken, nsSlug);
      if (newToken) {
        useCookie(CookieKeys.PAGES_TOKEN, { path: '/', sameSite: 'lax', secure: !import.meta.dev, maxAge: 60 * 60 * 24 * 6 }).value = newToken;
        setPagesAppToken(newToken);
        return await fn();
      }
    }
    throw error;
  }
}
