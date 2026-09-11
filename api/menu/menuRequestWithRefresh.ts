import { setMenuAppToken } from '@/api/clients';
import { menuGetAppToken } from '@/api/menu/auth/getAppToken';
import { CookieKeys } from '@/utils/storageKeys';
import { useAuth } from '@/composables/useAuth';
import { useMenuToken } from '@/composables/useMenuToken';
import { logWarn } from '@/utils/logger';

/**
 * Universal wrapper for menuClient requests with auto-refresh on MenuAuthorization error.
 * Usage: await menuRequestWithRefresh(() => menuClient.request(...), nsSlug)
 */
export async function menuRequestWithRefresh<T>(fn: () => Promise<T>, nsSlug: string): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isUnauthorized = error?.response?.errors?.some((e: any) =>
      typeof e.message === 'string' &&
      e.message.includes('MenuAuthorization token is invalid')
    );
    if (isUnauthorized) {
      // Clear old token
      try { useCookie(CookieKeys.MENU_TOKEN).value = null as any; } catch (e) { logWarn('[menu] failed to clear token cookie', e); }
      setMenuAppToken(null);
      try { useMenuToken().clear(); } catch (e) { logWarn('[menu] failed to clear token state', e); }
      // Try to get new token using hub token
      const { token } = useAuth();
      const hubToken = token.value;
      if (!hubToken) throw error;
      const newToken = await menuGetAppToken(hubToken, nsSlug);
      if (newToken) {
        // Match the attributes the initial write uses (composables/useAppToken.ts)
        // -- without them the cookie loses Secure/SameSite the moment it's
        // rewritten here, i.e. after the very first refresh (FRONTEND_AUDIT.md L2).
        useCookie(CookieKeys.MENU_TOKEN, { path: '/', sameSite: 'lax', secure: !import.meta.dev, maxAge: 60 * 60 * 24 * 6 }).value = newToken;
        setMenuAppToken(newToken);
        // Retry original request
        return await fn();
      }
    }
    throw error;
  }
}
