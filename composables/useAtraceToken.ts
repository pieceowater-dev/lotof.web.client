import { CookieKeys, LSKeys } from '@/utils/storageKeys'
import { createAppTokenComposable } from '@/composables/useAppToken'

export const useAtraceToken = createAppTokenComposable({
  cookieKey: CookieKeys.ATRACE_TOKEN,
  tsKey: 'atrace-token-ts',
  nsKey: LSKeys.ATRACE_TOKEN_NS,
  storageProbeKey: '__atrace_storage_probe__',
  ttlMs: 12 * 60 * 60 * 1000, // 12h
  label: 'useAtraceToken',
  getSetAppToken: async () => (await import('@/api/clients')).setAtraceAppToken,
  getExchangeFn: async () => (await import('@/api/atrace/auth/getAppToken')).atraceGetAppToken,
})
