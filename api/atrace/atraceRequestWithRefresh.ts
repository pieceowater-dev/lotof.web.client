import { atraceClient, setAtraceAppToken } from '@/api/clients';
import { atraceGetAppToken } from '@/api/atrace/auth/getAppToken';
import { CookieKeys } from '@/utils/storageKeys';
import { useAuth } from '@/composables/useAuth';
import { useAtraceToken } from '@/composables/useAtraceToken';

/**
 * Resolves the namespace slug for an Atrace API call. Prefers an explicit
 * nsSlug; when omitted, parses it directly from the URL path rather than
 * calling useRoute() -- these API functions are routinely invoked from deep
 * inside async action handlers (modal confirm callbacks, etc.), well past
 * the await boundaries that break Vue's implicit "current component
 * instance" tracking, where useRoute() silently returns undefined params
 * instead of throwing. Every Atrace page is namespace-scoped at
 * /<namespace>/atrace/..., so the first path segment is always the slug,
 * and reading it from window.location works regardless of Vue's internal
 * state.
 */
export function resolveAtraceNsSlug(nsSlug?: string): string {
  if (nsSlug) return nsSlug;

  if (typeof window !== 'undefined') {
    const first = window.location.pathname.split('/').filter(Boolean)[0];
    if (first) return first;
  }

  throw new Error('Namespace slug is required');
}

/**
 * Universal wrapper for atraceClient requests with auto-refresh on AtraceAuthorization error.
 * Usage: await atraceRequestWithRefresh(() => atraceClient.request(...), nsSlug)
 */
export async function atraceRequestWithRefresh<T>(fn: () => Promise<T>, nsSlug: string): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isUnauthorized = error?.response?.errors?.some((e: any) =>
      typeof e.message === 'string' &&
      e.message.includes('AtraceAuthorization token is invalid')
    );
    if (isUnauthorized) {
      // Clear old token
      try { useCookie(CookieKeys.ATRACE_TOKEN).value = null as any; } catch {}
      setAtraceAppToken(null);
      try { useAtraceToken().clear(); } catch {}
      // Try to get new token using hub token
      const { token } = useAuth();
      const hubToken = token.value;
      if (!hubToken) throw error;
      const newToken = await atraceGetAppToken(hubToken, nsSlug);
      if (newToken) {
        useCookie(CookieKeys.ATRACE_TOKEN, { path: '/' }).value = newToken;
        setAtraceAppToken(newToken);
        // Retry original request
        return await fn();
      }
    }
    throw error;
  }
}
