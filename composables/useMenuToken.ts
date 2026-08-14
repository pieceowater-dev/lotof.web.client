import { CookieKeys, LSKeys } from '@/utils/storageKeys'
import { createAppTokenComposable } from '@/composables/useAppToken'

export const useMenuToken = createAppTokenComposable({
  cookieKey: CookieKeys.MENU_TOKEN,
  tsKey: 'menu-token-ts',
  nsKey: LSKeys.MENU_TOKEN_NS,
  storageProbeKey: '__menu_storage_probe__',
  ttlMs: 12 * 60 * 60 * 1000, // 12h
  label: 'useMenuToken',
  getSetAppToken: async () => (await import('@/api/clients')).setMenuAppToken,
  getExchangeFn: async () => (await import('@/api/menu/auth/getAppToken')).menuGetAppToken,
})
