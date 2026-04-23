/**
 * Console access middleware
 * Protects /console routes and ensures user has elevated privileges
 */
export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith('/console')) return;
  
  if (process.server) return;

  // Check if user is authenticated
  const token = useCookie<string | null>('token', { path: '/' }).value;
  if (!token) {
    // Store the console page they were trying to access and redirect to login
    try {
      const full = to.fullPath || to.path;
      const trimmed = full.startsWith('/') ? full.slice(1) : full;
      localStorage.setItem('back-to', trimmed);
    } catch {}
    return navigateTo('/?auth-needed=true');
  }

  // TODO: Add actual admin role check when backend is ready
  // For now, all authenticated users can access admin panel
  // In the future, this should verify user has admin role from Hub service
  
  // const { user } = useAuth();
  // if (!user.value?.isAdmin) {
  //   return navigateTo('/');
  // }
});
