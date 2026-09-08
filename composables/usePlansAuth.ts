import { usePlansToken } from '@/composables/usePlansToken';
import { useAuth } from '@/composables/useAuth';

// "Get me a valid lota Plans token" in one call — mirrors useGoodsAuth.
export function usePlansAuth() {
  async function getToken(nsSlug: string): Promise<string> {
    const { ensure, current } = usePlansToken();
    const existing = current();
    if (existing) return existing;
    const { token: hubToken } = useAuth();
    if (!hubToken.value) throw new Error('No hub token');
    const token = await ensure(nsSlug, hubToken.value);
    if (!token) throw new Error('No plans token');
    return token;
  }

  return { getToken };
}
