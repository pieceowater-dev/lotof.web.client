/**
 * Console entry-point middleware. Unlike `admin` (role 0/1 only), this also
 * admits role 2 (Editor / "marketer") so that restricted account can reach
 * /console and /console/guide -- everything else under /console still uses
 * the stricter `admin` middleware and stays out of reach for that role.
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
    if (role !== 0 && role !== 1 && role !== 2) {
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
