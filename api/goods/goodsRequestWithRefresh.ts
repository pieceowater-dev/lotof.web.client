import { goodsClient, setGoodsAppToken } from '@/api/clients';
import { goodsGetAppToken } from '@/api/goods/auth/getAppToken';
import { CookieKeys } from '@/utils/storageKeys';
import { useAuth } from '@/composables/useAuth';
import { useGoodsToken } from '@/composables/useGoodsToken';

/**
 * Universal wrapper for goodsClient requests with auto-refresh on GoodsAuthorization error.
 * Usage: await goodsRequestWithRefresh(() => goodsClient.request(...), nsSlug)
 */
export async function goodsRequestWithRefresh<T>(fn: () => Promise<T>, nsSlug: string): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isUnauthorized = error?.response?.errors?.some((e: any) =>
      typeof e.message === 'string' &&
      e.message.includes('GoodsAuthorization token is invalid')
    );
    if (isUnauthorized) {
      // Clear old token
      try { useCookie(CookieKeys.GOODS_TOKEN).value = null as any; } catch {}
      setGoodsAppToken(null);
      try { useGoodsToken().clear(); } catch {}
      // Try to get new token using hub token
      const { token } = useAuth();
      const hubToken = token.value;
      if (!hubToken) throw error;
      const newToken = await goodsGetAppToken(hubToken, nsSlug);
      if (newToken) {
        useCookie(CookieKeys.GOODS_TOKEN, { path: '/' }).value = newToken;
        setGoodsAppToken(newToken);
        // Retry original request
        return await fn();
      }
    }
    throw error;
  }
}
