import { log, logWarn } from '@/utils/logger';
import { getApiBasePath } from '@/utils/api-base';
import { CookieKeys } from '@/utils/storageKeys';

const hubApiBase = getApiBasePath('hub');

/**
 * Refresh access token using the refresh token stored in httpOnly cookie.
 * On the client, the browser attaches refresh_token to this request
 * automatically (credentials: include). On the server there is no browser
 * cookie jar to draw from -- this Nitro-side fetch is a brand new outbound
 * request that carries nothing unless we forward the *incoming* request's
 * Cookie header ourselves, so a server-rendered page (useAsyncData without
 * lazy/client-only) can refresh an expired token same as a client-side call
 * can.
 */
export async function refreshAccessToken(): Promise<boolean> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (process.server) {
      const forwarded = useRequestHeaders(['cookie']);
      if (forwarded.cookie) headers.cookie = forwarded.cookie;
    }

    const response = await fetch(`${hubApiBase}/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // Include cookies (refresh_token is httpOnly)
      headers,
    });

    if (!response.ok) {
      logWarn(`[auth] Token refresh failed with status ${response.status}`);
      return false;
    }

    const data = await response.json();
    log('[auth] Access token refreshed successfully');
    
    // If server returns new token in response body, use it directly
    if (data?.token) {
      try {
        // sameSite/secure kept explicit here (no other client-side write of
        // this cookie sets them either -- see FRONTEND_AUDIT.md L2 for the
        // per-service tokens' version of the same gap).
        const tokenCookie = useCookie<string | null>(CookieKeys.TOKEN, { path: '/', sameSite: 'lax', secure: !import.meta.dev });
        tokenCookie.value = data.token;
        // Update global auth token for API client
        const { setGlobalAuthToken } = await import('@/api/clients');
        setGlobalAuthToken(data.token);
      } catch (e) {
        logWarn(`[auth] Failed to update token from response: ${String(e)}`);
      }
    } else {
      // Fallback: try to force cookie refresh by doing a synchronous read
      // This is a workaround for Nuxt's lazy cookie reading
      if (typeof window !== 'undefined') {
        // Parse cookies manually to get fresh value
        const cookies = document.cookie.split(';').reduce((acc: Record<string, string>, c) => {
          const [k, v] = c.trim().split('=');
          if (k) acc[k] = decodeURIComponent(v || '');
          return acc;
        }, {});
        const newToken = cookies[CookieKeys.TOKEN];
        if (newToken) {
          try {
            const tokenCookie = useCookie<string | null>(CookieKeys.TOKEN, { path: '/', sameSite: 'lax', secure: !import.meta.dev });
            tokenCookie.value = newToken;
            const { setGlobalAuthToken } = await import('@/api/clients');
            setGlobalAuthToken(newToken);
          } catch (e) {
            logWarn(`[auth] Failed to update token from cookie: ${String(e)}`);
          }
        }
      }
    }
    
    return true;
  } catch (error) {
    logWarn(`[auth] Token refresh failed: ${String(error)}`);
    return false;
  }
}

/**
 * Setup automatic token refresh on 401 unauthorized responses
 * This should be called when setting up auth interceptors
 */
export function setupTokenRefreshInterceptor() {
  // This will be integrated with the GraphQL client error handling
  // When a 401 is detected, we'll call refreshAccessToken and retry
}
