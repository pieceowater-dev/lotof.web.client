import { CookieKeys, LSKeys } from '@/utils/storageKeys'
import { createAppTokenComposable } from '@/composables/useAppToken'

export const usePlansToken = createAppTokenComposable({
  cookieKey: CookieKeys.PLANS_TOKEN,
  tsKey: 'plans-token-ts',
  nsKey: LSKeys.PLANS_TOKEN_NS,
  storageProbeKey: '__plans_storage_probe__',
  ttlMs: 12 * 60 * 60 * 1000, // 12h
  label: 'usePlansToken',
  getSetAppToken: async () => (await import('@/api/clients')).setPlansAppToken,
  getExchangeFn: async () => (await import('@/api/plans/auth/getAppToken')).plansGetAppToken,
})
