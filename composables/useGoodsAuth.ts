import { useGoodsToken } from '@/composables/useGoodsToken';

// Every Goods page repeated this same "get me a valid Goods token" dance --
// this collapses it to one call site. nsSlug is a getter (not a plain
// string) so callers can pass a computed ref's .value lazily and it still
// reads the current namespace even if called after a route change.
export function useGoodsAuth() {
  async function getToken(nsSlug: string): Promise<string> {
    const { ensure, current } = useGoodsToken();
    const existing = current();
    const nuxtApp = useNuxtApp();
    const { token: hubToken } = useAuth();
    // Always go through ensure(): on a cookie hit it also puts the token into the
    // in-memory client state that builds the GoodsAuthorization header. Returning the
    // bare cookie (the old shortcut) left that state empty after a full page
    // reload, so every request went out without the header ("token is missing").
    if (!hubToken.value) {
      if (existing) {
        const { setGoodsAppToken } = await import('@/api/clients');
        nuxtApp.runWithContext(() => setGoodsAppToken(existing));
        return existing;
      }
      throw new Error('No hub token');
    }
    const token = await ensure(nsSlug, hubToken.value);
    if (!token) throw new Error('No goods token');
    return token;
  }

  return { getToken };
}
