import { CookieKeys, LSKeys } from '@/utils/storageKeys'
import { createAppTokenComposable } from '@/composables/useAppToken'

export const useContactsToken = createAppTokenComposable({
  cookieKey: CookieKeys.CONTACTS_TOKEN,
  tsKey: 'contacts-token-ts',
  nsKey: LSKeys.CONTACTS_TOKEN_NS,
  storageProbeKey: '__contacts_storage_probe__',
  ttlMs: 12 * 60 * 60 * 1000, // 12h
  label: 'useContactsToken',
  getSetAppToken: async () => (await import('@/api/clients')).setContactsAppToken,
  getExchangeFn: async () => (await import('@/api/contacts/auth/getAppToken')).contactsGetAppToken,
})
