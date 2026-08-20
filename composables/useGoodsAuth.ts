import { useGoodsToken } from '@/composables/useGoodsToken';

// Every Goods page repeated this same "get me a valid Goods token" dance --
// this collapses it to one call site. nsSlug is a getter (not a plain
// string) so callers can pass a computed ref's .value lazily and it still
// reads the current namespace even if called after a route change.
export function useGoodsAuth() {
  async function getToken(nsSlug: string): Promise<string> {
    const { ensure, current } = useGoodsToken();
    const existing = current();
    if (existing) return existing;
    const { token: hubToken } = useAuth();
    if (!hubToken.value) throw new Error('No hub token');
    const token = await ensure(nsSlug, hubToken.value);
    if (!token) throw new Error('No goods token');
    return token;
  }

  return { getToken };
}
