import { CookieKeys } from '@/utils/storageKeys'
import { logError } from '@/utils/logger'

export function useAtraceToken() {
  async function ensure(nsSlug: string, hubToken?: string | null): Promise<string | null> {
    const cookie = useCookie<string | null>(CookieKeys.ATRACE_TOKEN, { path: '/' })
    if (cookie.value) {
      try {
        const { setAtraceAppToken } = await import('@/api/clients')
        setAtraceAppToken(cookie.value)
      } catch {}
      return cookie.value
    }

    if (!hubToken) return null
    try {
      const { atraceGetAppToken } = await import('@/api/atrace/auth/getAppToken')
      const token = await atraceGetAppToken(hubToken, nsSlug)
      try {
        const { setAtraceAppToken } = await import('@/api/clients')
        setAtraceAppToken(token)
      } catch {}
      useCookie(CookieKeys.ATRACE_TOKEN, { path: '/', sameSite: 'lax', secure: false, maxAge: 60 * 60 * 24 * 6 }).value = token
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
  }

  return { ensure, current, clear }
}
