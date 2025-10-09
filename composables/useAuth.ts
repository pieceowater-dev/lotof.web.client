import { hubMe } from '@/api/hub/me';
import { setGlobalAuthToken } from '@/api/clients';
import { setUnauthorizedHandler } from '@/api/clients';

// Centralized auth composable: manages token (via cookie), current user, and auth flows
export function useAuth() {
  // token cookie (Nuxt auto-imports useCookie in composables scope)
  const token = useCookie<string | null>('token');
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
        // Optional: clear anon selection to avoid bleeding across sessions
        const mapRaw = localStorage.getItem('selectedNamespaceByUser');
        if (mapRaw) {
          const map = JSON.parse(mapRaw || '{}');
          delete map['anon'];
          localStorage.setItem('selectedNamespaceByUser', JSON.stringify(map));
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
