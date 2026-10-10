import { usePlansToken } from '@/composables/usePlansToken';
import { useAuth } from '@/composables/useAuth';

// "Get me a valid lota Plans token" in one call — mirrors useGoodsAuth.
export function usePlansAuth() {
  async function getToken(nsSlug: string): Promise<string> {
    const { ensure, current } = usePlansToken();
    const existing = current();
    const nuxtApp = useNuxtApp();
    const { token: hubToken } = useAuth();
    // Always go through ensure(): on a cookie hit it also puts the token into the
    // in-memory client state that builds the PlansAuthorization header. Returning the
    // bare cookie (the old shortcut) left that state empty after a full page
    // reload, so every request went out without the header ("token is missing").
    if (!hubToken.value) {
      if (existing) {
        const { setPlansAppToken } = await import('@/api/clients');
        nuxtApp.runWithContext(() => setPlansAppToken(existing));
        return existing;
      }
      throw new Error('No hub token');
    }
    const token = await ensure(nsSlug, hubToken.value);
    if (!token) throw new Error('No plans token');
    return token;
  }

  return { getToken };
}
