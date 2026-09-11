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
    // The gateway rejects a request with no app token ("token is missing for
    // key \"PlansAuthorization\"") differently from an expired/invalid one
    // ("PlansAuthorization token is invalid"). Both mean the same thing to us:
    // (re)exchange the hub token for a plans token and retry once.
    const isUnauthorized = error?.response?.errors?.some((e: any) => {
      const m = typeof e?.message === 'string' ? e.message : '';
      return m.includes('PlansAuthorization token is invalid')
        || (m.includes('PlansAuthorization') && (m.includes('missing') || m.includes('unauthorized')));
    });
    if (isUnauthorized) {
      try { useCookie(CookieKeys.PLANS_TOKEN).value = null as any; } catch {}
      setPlansAppToken(null);
      try { usePlansToken().clear(); } catch {}
      const { token } = useAuth();
      const hubToken = token.value;
      if (!hubToken) throw error;
      const newToken = await plansGetAppToken(hubToken, nsSlug);
      if (newToken) {
        // Match the attributes the initial write uses (composables/useAppToken.ts)
        // -- without them the cookie loses Secure/SameSite the moment it's
        // rewritten here, i.e. after the very first refresh (FRONTEND_AUDIT.md L2).
        useCookie(CookieKeys.PLANS_TOKEN, { path: '/', sameSite: 'lax', secure: !import.meta.dev, maxAge: 60 * 60 * 24 * 6 }).value = newToken;
        setPlansAppToken(newToken);
        return await fn();
      }
    }
    throw error;
  }
}
