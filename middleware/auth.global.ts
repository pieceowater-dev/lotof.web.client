import { CookieKeys } from '@/utils/storageKeys';

export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/') return;
  // Allow public access to public post page
  if (/^\/shared\/[^/]+\/atrace\/post\/[\w-]+$/.test(to.path)) return;
  if (process.server) return;

  const token = useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value;
  if (!token) {
    await Promise.resolve();
    if (!useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value) {
      try {
        const full = to.fullPath || to.path;
        const trimmed = full.startsWith('/') ? full.slice(1) : full;
        localStorage.setItem('back-to', trimmed);
      } catch {}
      if (to.path.includes('/atrace/qr')) {
        return navigateTo({ path: '/', query: { 'auth-needed': 'true' } });
      }
      return navigateTo('/');
    }
  }
});