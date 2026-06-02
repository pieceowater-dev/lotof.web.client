/**
 * Console access middleware
 * Protects /console routes and ensures user has elevated privileges
 */
export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith('/console')) return;
  
  if (process.server) return;

  const redirectToAuth = () => {
    try {
      const full = to.fullPath || to.path;
      const trimmed = full.startsWith('/') ? full.slice(1) : full;
      localStorage.setItem('back-to', trimmed);
    } catch {}
    return navigateTo('/?auth-needed=true');
  };

  // Check if user is authenticated
  const token = useCookie<string | null>('token', { path: '/' }).value;
  if (!token) {
    return redirectToAuth();
  }

  const { user, fetchUser } = useAuth();
  if (!user.value?.id) {
    await fetchUser();
  }

  const currentUserId = user.value?.id;
  if (!currentUserId) {
    return redirectToAuth();
  }

  try {
    const { capitalGetAdminByUserId } = await import('@/api/capital/admin');
    const admin = await capitalGetAdminByUserId(token, currentUserId);
    if (!admin) {
      return redirectToAuth();
    }

    const role = Number(admin.role ?? -1);
    if (role !== 0 && role !== 1) {
      return navigateTo('/');
    }
  } catch (error: any) {
    const message = String(error?.message || error?.data?.statusMessage || '').toLowerCase();
    if (
      message.includes('unauthorized')
      || message.includes('unauthenticated')
      || message.includes('token')
      || message.includes('forbidden')
      || message.includes('permission')
      || message.includes('not found')
      || message.includes('admin not found')
    ) {
      return redirectToAuth();
    }

    return navigateTo('/');
  }
});
