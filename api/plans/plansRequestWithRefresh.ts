import { setPlansAppToken } from '@/api/clients';
import { plansGetAppToken } from '@/api/plans/auth/getAppToken';
import { CookieKeys } from '@/utils/storageKeys';
import { useAuth } from '@/composables/useAuth';
import { usePlansToken } from '@/composables/usePlansToken';

/**
 * Wraps a plansClient request and, on a "PlansAuthorization token is
 * invalid" error, refreshes the app token from the hub token and retries
 * once. Mirrors menuRequestWithRefresh.
 */
export async function plansRequestWithRefresh<T>(fn: () => Promise<T>, nsSlug: string): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isUnauthorized = error?.response?.errors?.some((e: any) =>
      typeof e.message === 'string' && e.message.includes('PlansAuthorization token is invalid'),
    );
    if (isUnauthorized) {
      try { useCookie(CookieKeys.PLANS_TOKEN).value = null as any; } catch {}
      setPlansAppToken(null);
      try { usePlansToken().clear(); } catch {}
      const { token } = useAuth();
      const hubToken = token.value;
      if (!hubToken) throw error;
      const newToken = await plansGetAppToken(hubToken, nsSlug);
      if (newToken) {
        useCookie(CookieKeys.PLANS_TOKEN, { path: '/' }).value = newToken;
        setPlansAppToken(newToken);
        return await fn();
      }
    }
    throw error;
  }
}
