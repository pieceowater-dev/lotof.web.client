import { logWarn } from '@/utils/logger';
import { getApiBasePath } from '@/utils/api-base';
import { CookieKeys } from '@/utils/storageKeys';

const hubApiBase = getApiBasePath('hub');

/**
 * Refresh access token using the refresh token stored in httpOnly cookie
 * The refresh_token is automatically sent by the browser in cookies
 */
export async function refreshAccessToken(): Promise<boolean> {
  try {
    const response = await fetch(`${hubApiBase}/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // Include cookies (refresh_token is httpOnly)
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      logWarn(`[auth] Token refresh failed with status ${response.status}`);
      return false;
    }

    const data = await response.json();
    console.log('[auth] Access token refreshed successfully');
    
    // If server returns new token in response body, use it directly
    if (data?.token) {
      try {
        const tokenCookie = useCookie<string | null>(CookieKeys.TOKEN, { path: '/' });
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
            const tokenCookie = useCookie<string | null>(CookieKeys.TOKEN, { path: '/' });
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
