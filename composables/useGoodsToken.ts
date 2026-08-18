import { CookieKeys, LSKeys } from '@/utils/storageKeys'
import { createAppTokenComposable } from '@/composables/useAppToken'

export const useGoodsToken = createAppTokenComposable({
  cookieKey: CookieKeys.GOODS_TOKEN,
  tsKey: 'goods-token-ts',
  nsKey: LSKeys.GOODS_TOKEN_NS,
  storageProbeKey: '__goods_storage_probe__',
  ttlMs: 12 * 60 * 60 * 1000, // 12h
  label: 'useGoodsToken',
  getSetAppToken: async () => (await import('@/api/clients')).setGoodsAppToken,
  getExchangeFn: async () => (await import('@/api/goods/auth/getAppToken')).goodsGetAppToken,
})
