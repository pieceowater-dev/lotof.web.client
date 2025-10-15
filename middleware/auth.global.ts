export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/') return; // Allow public access to landing (index)
  // Allow client to set cookies before evaluating protected routes
  if (process.server) return;

  const token = useCookie<string | null>('token', { path: '/' }).value;
  if (!token) {
    // Small defer to allow just-set cookies to flush (e.g., after OAuth redirect)
    await Promise.resolve();
    if (!useCookie<string | null>('token', { path: '/' }).value) {
      return navigateTo('/');
    }
  }
});