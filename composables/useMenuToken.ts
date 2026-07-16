import { CookieKeys, LSKeys } from '@/utils/storageKeys'
import { logError } from '@/utils/logger'

const MENU_TOKEN_TS_KEY = 'menu-token-ts'
const MENU_TOKEN_TTL_MS = 12 * 60 * 60 * 1000 // 12h
const MENU_TOKEN_NS_KEY = LSKeys.MENU_TOKEN_NS

export function useMenuToken() {
  function canUseStorage(): boolean {
    if (typeof window === 'undefined') return false
    try {
      const key = '__menu_storage_probe__'
      localStorage.setItem(key, '1')
      localStorage.removeItem(key)
      return true
    } catch {
      return false
    }
  }

  function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  function readStoredNamespace(): string | null {
    if (typeof window === 'undefined') return null
    try {
      return localStorage.getItem(MENU_TOKEN_NS_KEY)
    } catch {
      return null
    }
  }

  function writeStoredNamespace(nsSlug: string) {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(MENU_TOKEN_NS_KEY, nsSlug)
    } catch {}
  }

  function clearStoredNamespace() {
    if (typeof window === 'undefined') return
    try {
      localStorage.removeItem(MENU_TOKEN_NS_KEY)
    } catch {}
  }

  async function clearInMemoryToken() {
    try {
      const { setMenuAppToken } = await import('@/api/clients')
      setMenuAppToken(null)
    } catch {}
  }

  async function ensure(nsSlug: string, hubToken?: string | null): Promise<string | null> {
    const cookie = useCookie<string | null>(CookieKeys.MENU_TOKEN, { path: '/' })
    const storageAvailable = canUseStorage()
    const storedNs = readStoredNamespace()
    const hasNsMismatch = !!storedNs && storedNs !== nsSlug
    const shouldForceByNs = storageAvailable && !storedNs && !!cookie.value && !!hubToken && !!nsSlug

    if (cookie.value && (hasNsMismatch || shouldForceByNs)) {
      try { cookie.value = null as any } catch {}
      try { localStorage.removeItem(MENU_TOKEN_TS_KEY) } catch {}
      clearStoredNamespace()
      await clearInMemoryToken()
    }

    if (cookie.value) {
      const shouldForceRefresh = (() => {
        if (typeof window === 'undefined') return false
        try {
          const raw = localStorage.getItem(MENU_TOKEN_TS_KEY)
          const ts = raw ? Number(raw) : NaN
          if (!Number.isFinite(ts) || ts <= 0) return true
          return Date.now() - ts > MENU_TOKEN_TTL_MS
        } catch {
          return false
        }
      })()
      if (!shouldForceRefresh || !hubToken) {
        try {
          const { setMenuAppToken } = await import('@/api/clients')
          setMenuAppToken(cookie.value)
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
      const { menuGetAppToken } = await import('@/api/menu/auth/getAppToken')
      let token: string | null = null
      let lastError: any = null

      // Retry transient failures. A brand-new namespace's tenant schema is
      // provisioned asynchronously on first access (menu.msvc.core's
      // TenantReadiness middleware triggers a background warmup and replies
      // "tenant migration in progress, retry later") — that can take a few
      // seconds, so it gets more attempts and a longer backoff than other
      // transient errors like "cached plan must not change result type".
      const maxAttempts = 6
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          token = await menuGetAppToken(hubToken, nsSlug)
          if (token) break
        } catch (e) {
          lastError = e
          logError(`[useMenuToken] attempt ${attempt}/${maxAttempts} failed`, e)
          if (attempt < maxAttempts) {
            const isTenantWarmup = String((e as any)?.message || '').includes('tenant migration in progress')
            await sleep(isTenantWarmup ? 1500 : 300)
          }
        }
      }

      if (!token) {
        if (lastError) throw lastError
        throw new Error('Failed to get menu token')
      }

      try {
        const { setMenuAppToken } = await import('@/api/clients')
        setMenuAppToken(token)
      } catch {}
      useCookie(CookieKeys.MENU_TOKEN, { path: '/', sameSite: 'lax', secure: false, maxAge: 60 * 60 * 24 * 6 }).value = token
      if (typeof window !== 'undefined') {
        try { localStorage.setItem(MENU_TOKEN_TS_KEY, String(Date.now())) } catch {}
      }
      if (nsSlug) writeStoredNamespace(nsSlug)
      return token
    } catch (e) {
      logError('[useMenuToken] exchange failed', e)
      return null
    }
  }

  function current(): string | null {
    return useCookie<string | null>(CookieKeys.MENU_TOKEN, { path: '/' }).value
  }

  function clear() {
    try { useCookie(CookieKeys.MENU_TOKEN, { path: '/' }).value = null as any } catch {}
    if (typeof window !== 'undefined') {
      try { localStorage.removeItem(MENU_TOKEN_TS_KEY) } catch {}
      try { localStorage.removeItem(MENU_TOKEN_NS_KEY) } catch {}
    }
    clearInMemoryToken()
  }

  return { ensure, current, clear }
}
