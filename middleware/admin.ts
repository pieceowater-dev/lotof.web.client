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

  const { user, fetchUser } = useAuth();
  if (!user.value?.id) {
    await fetchUser();
  }

  const currentUserId = user.value?.id;
  if (!currentUserId) {
    return navigateTo('/?auth-needed=true');
  }

  try {
    const { capitalGetAdminByUserId } = await import('@/api/capital/admin');
    const admin = await capitalGetAdminByUserId(token, currentUserId);
    if (!admin) {
      return navigateTo('/');
    }
  } catch {
    return navigateTo('/');
  }
});
