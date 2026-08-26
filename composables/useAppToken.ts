import { logError } from '@/utils/logger'

// Shared factory behind useAtraceToken/useMenuToken/useTasksToken/
// useContactsToken -- the four were ~150 identical lines apiece, differing
// only in the cookie/localStorage keys and which product's token-exchange
// API to call. Each product's file is now just this factory called with
// its own config; getSetAppToken/getExchangeFn stay as thunks (not
// resolved imports) so the per-product API modules are still only pulled
// into the bundle when a token is actually being exchanged, same as
// before this refactor.
export interface AppTokenConfig {
  cookieKey: string
  tsKey: string
  nsKey: string
  storageProbeKey: string
  ttlMs: number
  label: string
  getSetAppToken: () => Promise<(token: string | null) => void>
  getExchangeFn: () => Promise<(hubToken: string, nsSlug: string) => Promise<string | null>>
}

export function createAppTokenComposable(config: AppTokenConfig) {
  const { cookieKey, tsKey, nsKey, storageProbeKey, ttlMs, label, getSetAppToken, getExchangeFn } = config

  return function useAppToken() {
    function canUseStorage(): boolean {
      if (typeof window === 'undefined') return false
      try {
        localStorage.setItem(storageProbeKey, '1')
        localStorage.removeItem(storageProbeKey)
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
        return localStorage.getItem(nsKey)
      } catch {
        return null
      }
    }

    function writeStoredNamespace(nsSlug: string) {
      if (typeof window === 'undefined') return
      try {
        localStorage.setItem(nsKey, nsSlug)
      } catch {}
    }

    function clearStoredNamespace() {
      if (typeof window === 'undefined') return
      try {
        localStorage.removeItem(nsKey)
      } catch {}
    }

    async function clearInMemoryToken() {
      try {
        const setAppToken = await getSetAppToken()
        setAppToken(null)
      } catch {}
    }

    async function ensure(nsSlug: string, hubToken?: string | null): Promise<string | null> {
      const cookie = useCookie<string | null>(cookieKey, { path: '/' })
      const storageAvailable = canUseStorage()
      const storedNs = readStoredNamespace()
      const hasNsMismatch = !!storedNs && storedNs !== nsSlug
      const shouldForceByNs = storageAvailable && !storedNs && !!cookie.value && !!hubToken && !!nsSlug

      if (cookie.value && (hasNsMismatch || shouldForceByNs)) {
        try { cookie.value = null as any } catch {}
        try { localStorage.removeItem(tsKey) } catch {}
        clearStoredNamespace()
        await clearInMemoryToken()
      }

      if (cookie.value) {
        const shouldForceRefresh = (() => {
          if (typeof window === 'undefined') return false
          try {
            const raw = localStorage.getItem(tsKey)
            const ts = raw ? Number(raw) : NaN
            if (!Number.isFinite(ts) || ts <= 0) return true
            return Date.now() - ts > ttlMs
          } catch {
            return false
          }
        })()
        if (!shouldForceRefresh || !hubToken) {
          try {
            const setAppToken = await getSetAppToken()
            setAppToken(cookie.value)
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
        const exchange = await getExchangeFn()
        let token: string | null = null
        let lastError: any = null

        // Retry transient failures. A brand-new namespace's tenant schema is
        // provisioned asynchronously on first access -- that can take a few
        // seconds, so it gets more attempts and a longer backoff than other
        // transient errors like "cached plan must not change result type".
        const maxAttempts = 6
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            token = await exchange(hubToken, nsSlug)
            if (token) break
          } catch (e) {
            lastError = e
            logError(`[${label}] attempt ${attempt}/${maxAttempts} failed`, e)
            // Originally this broke early on "not a member of the namespace"
            // on the theory that it's always a permanent, stale-identity
            // failure not worth retrying. Live prod evidence says otherwise:
            // hub-gtw's HPA was found flapping 1<->2 replicas continuously
            // (an existing, unrelated infra issue -- CPU nowhere near its
            // scaling threshold), and during that churn AmIMemberOfNamespace
            // genuinely answered "false" for confirmed, permanent namespace
            // owners. Bailing after one attempt would remove the only thing
            // that currently rides out a blip like that, so this keeps
            // retrying through all maxAttempts regardless of message.
            if (attempt < maxAttempts) {
              const isTenantWarmup = String((e as any)?.message || '').includes('tenant migration in progress')
              await sleep(isTenantWarmup ? 1500 : 300)
            }
          }
        }

        if (!token) {
          if (lastError) throw lastError
          throw new Error(`Failed to get ${label} token`)
        }

        try {
          const setAppToken = await getSetAppToken()
          setAppToken(token)
        } catch {}
        // secure:false would ship an app token over plain HTTP in
        // production; process.dev is only true for local `nuxt dev`, so
        // this is secure everywhere it actually matters.
        useCookie(cookieKey, { path: '/', sameSite: 'lax', secure: !process.dev, maxAge: 60 * 60 * 24 * 6 }).value = token
        if (typeof window !== 'undefined') {
          try { localStorage.setItem(tsKey, String(Date.now())) } catch {}
        }
        if (nsSlug) writeStoredNamespace(nsSlug)
        return token
      } catch (e) {
        logError(`[${label}] exchange failed`, e)
        return null
      }
    }

    function current(): string | null {
      return useCookie<string | null>(cookieKey, { path: '/' }).value
    }

    function clear() {
      try { useCookie(cookieKey, { path: '/' }).value = null as any } catch {}
      if (typeof window !== 'undefined') {
        try { localStorage.removeItem(tsKey) } catch {}
        try { localStorage.removeItem(nsKey) } catch {}
      }
      clearInMemoryToken()
    }

    return { ensure, current, clear }
  }
}
