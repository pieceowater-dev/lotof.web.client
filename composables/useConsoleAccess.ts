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

// The gateway fails closed (and masks the reason as "internal error") whenever the admin
// lookup hiccups -- a gateway restart, a dropped gRPC connection -- which used to hide the
// Console entry until the next lucky check. This is UI visibility only (the server still
// enforces access on every call), so the last positive answer per user is remembered for a
// week and kept on transient failures.
const CACHE_PREFIX = 'lota_console_access:';
const CACHE_TTL_MS = 7 * 24 * 3600 * 1000;
function readCachedRole(userId: string): number | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + userId);
    if (!raw) return null;
    const { role, at } = JSON.parse(raw);
    if (typeof role !== 'number' || Date.now() - at > CACHE_TTL_MS) return null;
    return role;
  } catch { return null; }
}
function writeCachedRole(userId: string, role: number | null) {
  try {
    if (role === null) localStorage.removeItem(CACHE_PREFIX + userId);
    else localStorage.setItem(CACHE_PREFIX + userId, JSON.stringify({ role, at: Date.now() }));
  } catch { /* storage unavailable */ }
}
function applyRole(role: number | null) {
  canSeeConsole.value = role === 0 || role === 1 || role === 2;
  isFullConsoleAdmin.value = role === 0 || role === 1;
}

/**
 * Refreshes whether the current user is a Capital admin/owner (role 0 or 1)
 * and may see the internal Console entry point. Safe to call repeatedly --
 * a sequence guard drops stale responses if calls overlap.
 */
async function refreshConsoleAccess(attempt = 0): Promise<void> {
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
    const role = admin ? Number(admin.role ?? -1) : null;
    applyRole(role);
    writeCachedRole(currentUserId, role !== null && role >= 0 && role <= 2 ? role : null);
  } catch (e) {
    // Fails silently otherwise, which makes "the Console entry disappeared"
    // indistinguishable from "you're not a capital admin" -- log it so a
    // real backend/network failure is visible instead of just hiding it.
    if (seq !== checkSeq) return;
    logError('[useConsoleAccess] refreshConsoleAccess failed', e);
    // A single failed check (token mid-refresh, gateway blip, a stale id during
    // the login handoff) must not hide the entry until a manual visit to
    // /console: retry once (a genuine non-admin costs one extra cheap call).
    if (attempt < 1) {
      const cachedNow = readCachedRole(currentUserId);
      if (cachedNow !== null) applyRole(cachedNow);
      setTimeout(() => { void refreshConsoleAccess(attempt + 1); }, 2000);
      return;
    }
    // Out of retries: fall back to the remembered answer instead of hiding the entry.
    const cached = readCachedRole(currentUserId);
    if (cached !== null) { applyRole(cached); return; }
    canSeeConsole.value = false;
    isFullConsoleAdmin.value = false;
  }
}

export function useConsoleAccess() {
  return { canSeeConsole, isFullConsoleAdmin, refreshConsoleAccess };
}
