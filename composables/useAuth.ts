import { hubMe } from '@/api/hub/me';
import { setGlobalAuthToken } from '@/api/clients';
import { setUnauthorizedHandler } from '@/api/clients';
import { CookieKeys, LSKeys } from '@/utils/storageKeys';

// Centralized auth composable: manages token (via cookie), current user, and auth flows
export function useAuth() {
  // token cookie (Nuxt auto-imports useCookie in composables scope)
  const token = useCookie<string | null>(CookieKeys.TOKEN);
  const user = useState<{ id: string; username: string; email: string } | null>('auth_user', () => null);
  const loading = useState<boolean>('auth_loading', () => false);
  const initialized = useState<boolean>('auth_initialized', () => false);

  async function fetchUser(force = false) {
    if (!token.value) {
      user.value = null;
      return;
    }
    if (user.value && !force) return; // cached
    loading.value = true;
    try {
      setGlobalAuthToken(token.value);
      const data = await hubMe(token.value);
      user.value = data;
    } catch (e) {
      // If token invalid → logout silently
      console.warn('[auth] fetchUser failed, clearing token');
      logout();
    } finally {
      loading.value = false;
      initialized.value = true;
    }
  }

  function login() {
    // Redirect to hub auth
    const base = import.meta.env.VITE_API_HUB;
    const redirect = encodeURIComponent(window.location.origin);
    window.location.href = `${base}/google/auth?redirect_uri=${redirect}`;
  }

  function logout() {
    token.value = null;
    user.value = null;
    setGlobalAuthToken(null);
    // Clean up per-user persisted state that should reset on logout
    if (process.client) {
      try {
        // Best-effort: clear ALL accessible cookies, including 'atrace-token'
        const expire = 'Thu, 01 Jan 1970 00:00:00 GMT';
        const cookies = (document.cookie || '').split(';');
        // Domains to try: exact host and its parent domains
        const host = window.location.hostname;
        const domainParts = host.split('.');
        const domains: (string | undefined)[] = [undefined]; // undefined => no domain attr
        for (let i = 0; i < domainParts.length; i++) {
          const d = domainParts.slice(i).join('.');
          if (d) {
            domains.push(d);
            domains.push('.' + d);
          }
        }
        // Paths to try: root and current path (defensive)
        const paths = ['/', window.location.pathname.split('/').slice(0, 2).join('/') || '/'];
        const tried = new Set<string>();
        for (const raw of cookies) {
          const name = decodeURIComponent(raw.split('=')[0].trim());
          if (!name) continue;
          for (const domain of domains) {
            for (const path of paths) {
              const key = `${name}|${domain || ''}|${path}`;
              if (tried.has(key)) continue;
              tried.add(key);
              document.cookie = `${name}=; expires=${expire}; path=${path};${domain ? ` domain=${domain};` : ''}`;
            }
          }
          // Final simple attempt (some browsers ignore domain variations)
          document.cookie = `${name}=; expires=${expire}; path=/;`;
        }

        // Explicitly clear known app cookies via Nuxt helper as well
  try { useCookie(CookieKeys.ATRACE_TOKEN).value = null as any; } catch {}
  try { useCookie(CookieKeys.TOKEN).value = null as any; } catch {}

        // Optional: clear anon selection to avoid bleeding across sessions
        const mapRaw = localStorage.getItem(LSKeys.SELECTED_NAMESPACE_BY_USER);
        if (mapRaw) {
          const map = JSON.parse(mapRaw || '{}');
          delete map['anon'];
          localStorage.setItem(LSKeys.SELECTED_NAMESPACE_BY_USER, JSON.stringify(map));
        }
      } catch {}
    }
  }

  const isLoggedIn = computed(() => !!user.value && !!token.value);

  // Register global unauthorized handler once
  if (process.client && !useState<boolean>('auth_handler_registered', () => false).value) {
    const reg = useState<boolean>('auth_handler_registered', () => false);
    setUnauthorizedHandler(() => logout());
    reg.value = true;
  }

  return { token, user, loading, initialized, isLoggedIn, fetchUser, login, logout };
}
