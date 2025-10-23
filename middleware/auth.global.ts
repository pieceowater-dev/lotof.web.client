import { CookieKeys } from '@/utils/storageKeys';

export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/') return; // Allow public access to landing (index)
  // Allow client to set cookies before evaluating protected routes
  if (process.server) return;

  const token = useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value;
  if (!token) {
    // Small defer to allow just-set cookies to flush (e.g., after OAuth redirect)
    await Promise.resolve();
    if (!useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value) {
      // Persist intended destination so we can send the user back after auth
      try {
        const full = to.fullPath || to.path;
        const trimmed = full.startsWith('/') ? full.slice(1) : full;
        localStorage.setItem('back-to', trimmed);
      } catch {}
      // For QR scans, redirect with a flag so home can auto-trigger login
      if (to.path.includes('/atrace/qr')) {
        return navigateTo({ path: '/', query: { 'auth-needed': 'true' } });
      }
      return navigateTo('/');
    }
  }
});