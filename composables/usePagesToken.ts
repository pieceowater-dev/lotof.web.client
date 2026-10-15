import { CookieKeys, LSKeys } from '@/utils/storageKeys'
import { createAppTokenComposable } from '@/composables/useAppToken'

export const usePagesToken = createAppTokenComposable({
  cookieKey: CookieKeys.PAGES_TOKEN,
  tsKey: 'pages-token-ts',
  nsKey: LSKeys.PAGES_TOKEN_NS,
  storageProbeKey: '__pages_storage_probe__',
  ttlMs: 12 * 60 * 60 * 1000, // 12h
  label: 'usePagesToken',
  getSetAppToken: async () => (await import('@/api/clients')).setPagesAppToken,
  getExchangeFn: async () => (await import('@/api/pages/auth/getAppToken')).pagesGetAppToken,
})
