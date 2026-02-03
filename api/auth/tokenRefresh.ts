import { logWarn } from '@/utils/logger';

const hubApiBase = import.meta.env.VITE_API_HUB || 'http://localhost:8080';

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
    
    // Force cookie reload by triggering a read
    // The server has set a new 'token' cookie, but Nuxt's useCookie needs to re-read it
    if (typeof window !== 'undefined') {
      // Trigger a page context update - the cookie should now be available
      window.dispatchEvent(new Event('cookie-updated'));
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
