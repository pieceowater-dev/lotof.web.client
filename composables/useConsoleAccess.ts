import { ref } from 'vue';
import { CookieKeys } from '@/utils/storageKeys';
import { logError } from '@/utils/logger';

// Module-level (not per-component instance) so every consumer -- the home
// page dashboard tile and the header nav button -- reads the same
// capital-admin check instead of each firing its own GraphQL call.
const canSeeConsole = ref(false);
// Role 0 (owner) / 1 (admin) see every console module; role 2 (Editor, the
// restricted "marketer" account) only ever sees the Guide module.
const isFullConsoleAdmin = ref(false);
let checkSeq = 0;

/**
 * Refreshes whether the current user is a Capital admin/owner (role 0 or 1)
 * and may see the internal Console entry point. Safe to call repeatedly --
 * a sequence guard drops stale responses if calls overlap.
 */
async function refreshConsoleAccess(): Promise<void> {
  if (process.server) return;

  const { user, token, isLoggedIn, fetchUser } = useAuth();
  if (!isLoggedIn.value) {
    canSeeConsole.value = false;
    isFullConsoleAdmin.value = false;
    return;
  }

  const authToken = token.value || useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value;
  if (!authToken) {
    canSeeConsole.value = false;
    isFullConsoleAdmin.value = false;
    return;
  }

  let currentUserId = user.value?.id;
  if (!currentUserId) {
    await fetchUser();
    currentUserId = user.value?.id;
  }
  if (!currentUserId) {
    canSeeConsole.value = false;
    isFullConsoleAdmin.value = false;
    return;
  }

  const seq = ++checkSeq;
  try {
    const { capitalGetAdminByUserId } = await import('@/api/capital/admin');
    const admin = await capitalGetAdminByUserId(authToken, currentUserId);
    if (seq !== checkSeq) return; // superseded by a newer check
    const role = Number(admin?.role ?? -1);
    canSeeConsole.value = !!admin && (role === 0 || role === 1 || role === 2);
    isFullConsoleAdmin.value = !!admin && (role === 0 || role === 1);
  } catch (e) {
    // Fails silently otherwise, which makes "the Console entry disappeared"
    // indistinguishable from "you're not a capital admin" -- log it so a
    // real backend/network failure is visible instead of just hiding it.
    if (seq !== checkSeq) return;
    logError('[useConsoleAccess] refreshConsoleAccess failed', e);
    canSeeConsole.value = false;
    isFullConsoleAdmin.value = false;
  }
}

export function useConsoleAccess() {
  return { canSeeConsole, isFullConsoleAdmin, refreshConsoleAccess };
}
