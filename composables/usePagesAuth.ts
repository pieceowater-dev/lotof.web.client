import { usePagesToken } from '@/composables/usePagesToken';
import { useAuth } from '@/composables/useAuth';

// "Get me a valid lota Pages token" in one call — mirrors usePlansAuth.
export function usePagesAuth() {
  async function getToken(nsSlug: string): Promise<string> {
    const { ensure, current } = usePagesToken();
    const existing = current();
    const nuxtApp = useNuxtApp();
    const { token: hubToken } = useAuth();
    // Always go through ensure() when a hub token exists: on a cookie hit it also
    // fills the in-memory client state that builds the PagesAuthorization header.
    if (!hubToken.value) {
      if (existing) {
        const { setPagesAppToken } = await import('@/api/clients');
        nuxtApp.runWithContext(() => setPagesAppToken(existing));
        return existing;
      }
      throw new Error('No hub token');
    }
    const token = await ensure(nsSlug, hubToken.value);
    if (!token) throw new Error('No pages token');
    return token;
  }

  return { getToken };
}
