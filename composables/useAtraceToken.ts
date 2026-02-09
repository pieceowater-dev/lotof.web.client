import { CookieKeys, LSKeys } from '@/utils/storageKeys'
import { logError } from '@/utils/logger'

const ATRACE_TOKEN_TS_KEY = 'atrace-token-ts'
const ATRACE_TOKEN_TTL_MS = 12 * 60 * 60 * 1000 // 12h
const ATRACE_TOKEN_NS_KEY = LSKeys.ATRACE_TOKEN_NS

export function useAtraceToken() {
  function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  function readStoredNamespace(): string | null {
    if (typeof window === 'undefined') return null
    try {
      return localStorage.getItem(ATRACE_TOKEN_NS_KEY)
    } catch {
      return null
    }
  }

  function writeStoredNamespace(nsSlug: string) {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(ATRACE_TOKEN_NS_KEY, nsSlug)
    } catch {}
  }

  function clearStoredNamespace() {
    if (typeof window === 'undefined') return
    try {
      localStorage.removeItem(ATRACE_TOKEN_NS_KEY)
    } catch {}
  }

  async function clearInMemoryToken() {
    try {
      const { setAtraceAppToken } = await import('@/api/clients')
      setAtraceAppToken(null)
    } catch {}
  }

  async function ensure(nsSlug: string, hubToken?: string | null): Promise<string | null> {
    const cookie = useCookie<string | null>(CookieKeys.ATRACE_TOKEN, { path: '/' })
    const storedNs = readStoredNamespace()
    const hasNsMismatch = !!storedNs && storedNs !== nsSlug
    const shouldForceByNs = !storedNs && !!cookie.value && !!hubToken && !!nsSlug

    if (cookie.value && (hasNsMismatch || shouldForceByNs)) {
      try { cookie.value = null as any } catch {}
      try { localStorage.removeItem(ATRACE_TOKEN_TS_KEY) } catch {}
      clearStoredNamespace()
      await clearInMemoryToken()
    }

    if (cookie.value) {
      const shouldForceRefresh = (() => {
        if (typeof window === 'undefined') return false
        try {
          const raw = localStorage.getItem(ATRACE_TOKEN_TS_KEY)
          const ts = raw ? Number(raw) : NaN
          if (!Number.isFinite(ts) || ts <= 0) return true
          return Date.now() - ts > ATRACE_TOKEN_TTL_MS
        } catch {
          return false
        }
      })()
      if (!shouldForceRefresh || !hubToken) {
        try {
          const { setAtraceAppToken } = await import('@/api/clients')
          setAtraceAppToken(cookie.value)
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
      const { atraceGetAppToken } = await import('@/api/atrace/auth/getAppToken')
      let token = await atraceGetAppToken(hubToken, nsSlug)
      if (!token) {
        await sleep(250)
        token = await atraceGetAppToken(hubToken, nsSlug)
      }
      try {
        const { setAtraceAppToken } = await import('@/api/clients')
        setAtraceAppToken(token)
      } catch {}
      useCookie(CookieKeys.ATRACE_TOKEN, { path: '/', sameSite: 'lax', secure: false, maxAge: 60 * 60 * 24 * 6 }).value = token
      if (typeof window !== 'undefined') {
        try { localStorage.setItem(ATRACE_TOKEN_TS_KEY, String(Date.now())) } catch {}
      }
      if (nsSlug) writeStoredNamespace(nsSlug)
      return token
    } catch (e) {
      logError('[useAtraceToken] exchange failed', e)
      return null
    }
  }

  function current(): string | null {
    return useCookie<string | null>(CookieKeys.ATRACE_TOKEN, { path: '/' }).value
  }

  function clear() {
    try { useCookie(CookieKeys.ATRACE_TOKEN, { path: '/' }).value = null as any } catch {}
    if (typeof window !== 'undefined') {
      try { localStorage.removeItem(ATRACE_TOKEN_TS_KEY) } catch {}
      try { localStorage.removeItem(ATRACE_TOKEN_NS_KEY) } catch {}
    }
    clearInMemoryToken()
  }

  return { ensure, current, clear }
}
