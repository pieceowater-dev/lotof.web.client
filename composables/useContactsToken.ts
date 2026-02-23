import { CookieKeys, LSKeys } from '@/utils/storageKeys'
import { logError } from '@/utils/logger'

const CONTACTS_TOKEN_TS_KEY = 'contacts-token-ts'
const CONTACTS_TOKEN_TTL_MS = 12 * 60 * 60 * 1000 // 12h
const CONTACTS_TOKEN_NS_KEY = LSKeys.CONTACTS_TOKEN_NS

export function useContactsToken() {
  function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  function readStoredNamespace(): string | null {
    if (typeof window === 'undefined') return null
    try {
      return localStorage.getItem(CONTACTS_TOKEN_NS_KEY)
    } catch {
      return null
    }
  }

  function writeStoredNamespace(nsSlug: string) {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(CONTACTS_TOKEN_NS_KEY, nsSlug)
    } catch {}
  }

  function clearStoredNamespace() {
    if (typeof window === 'undefined') return
    try {
      localStorage.removeItem(CONTACTS_TOKEN_NS_KEY)
    } catch {}
  }

  async function clearInMemoryToken() {
    try {
      const { setContactsAppToken } = await import('@/api/clients')
      setContactsAppToken(null)
    } catch {}
  }

  async function ensure(nsSlug: string, hubToken?: string | null): Promise<string | null> {
    const cookie = useCookie<string | null>(CookieKeys.CONTACTS_TOKEN, { path: '/' })
    const storedNs = readStoredNamespace()
    const hasNsMismatch = !!storedNs && storedNs !== nsSlug
    const shouldForceByNs = !storedNs && !!cookie.value && !!hubToken && !!nsSlug

    if (cookie.value && (hasNsMismatch || shouldForceByNs)) {
      try { cookie.value = null as any } catch {}
      try { localStorage.removeItem(CONTACTS_TOKEN_TS_KEY) } catch {}
      clearStoredNamespace()
      await clearInMemoryToken()
    }

    if (cookie.value) {
      const shouldForceRefresh = (() => {
        if (typeof window === 'undefined') return false
        try {
          const raw = localStorage.getItem(CONTACTS_TOKEN_TS_KEY)
          const ts = raw ? Number(raw) : NaN
          if (!Number.isFinite(ts) || ts <= 0) return true
          return Date.now() - ts > CONTACTS_TOKEN_TTL_MS
        } catch {
          return false
        }
      })()
      if (!shouldForceRefresh || !hubToken) {
        try {
          const { setContactsAppToken } = await import('@/api/clients')
          setContactsAppToken(cookie.value)
        } catch {}
        if (!storedNs && nsSlug) writeStoredNamespace(nsSlug)
        return cookie.value
      }
      try {
        cookie.value = null as any
      } catch {}
    }

    if (!hubToken) return null
    try {
      const { contactsGetAppToken } = await import('@/api/contacts/auth/getAppToken')
      let token: string | null = null
      let lastError: any = null
      
      // Try up to 2 times with a small delay to handle transient DB errors
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          token = await contactsGetAppToken(hubToken, nsSlug)
          if (token) break
        } catch (e) {
          lastError = e
          logError(`[useContactsToken] attempt ${attempt}/2 failed`, e)
          if (attempt < 2) {
            await sleep(300)
          }
        }
      }
      
      if (!token) {
        if (lastError) throw lastError
        throw new Error('Failed to get contacts token')
      }
      
      try {
        const { setContactsAppToken } = await import('@/api/clients')
        setContactsAppToken(token)
      } catch {}
      useCookie(CookieKeys.CONTACTS_TOKEN, { path: '/', sameSite: 'lax', secure: false, maxAge: 60 * 60 * 24 * 6 }).value = token
      if (typeof window !== 'undefined') {
        try { localStorage.setItem(CONTACTS_TOKEN_TS_KEY, String(Date.now())) } catch {}
      }
      if (nsSlug) writeStoredNamespace(nsSlug)
      return token
    } catch (e) {
      logError('[useContactsToken] exchange failed', e)
      return null
    }
  }

  function current(): string | null {
    return useCookie<string | null>(CookieKeys.CONTACTS_TOKEN, { path: '/' }).value
  }

  function clear() {
    try { useCookie(CookieKeys.CONTACTS_TOKEN, { path: '/' }).value = null as any } catch {}
    if (typeof window !== 'undefined') {
      try { localStorage.removeItem(CONTACTS_TOKEN_TS_KEY) } catch {}
      try { localStorage.removeItem(CONTACTS_TOKEN_NS_KEY) } catch {}
    }
    clearInMemoryToken()
  }

  return { ensure, current, clear }
}
