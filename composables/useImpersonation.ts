import { getApiBasePath } from '@/utils/api-base';
import { logWarn } from '@/utils/logger';

const hubApiBase = getApiBasePath('hub');

// isImpersonating just checks for the owner_token stash cookie set by
// POST /auth/impersonate -- its mere presence means "there's a real owner
// session parked, ready to restore," which is exactly "currently
// impersonating." No separate state to keep in sync: the swap/restore
// endpoints are the only things that ever set or clear it, and a full-page
// navigation after each (see below) means every composable/component just
// re-reads the current cookie value fresh, no reactive plumbing needed.
export function useImpersonation() {
  function isImpersonating(): boolean {
    if (process.server) return false;
    return !!useCookie<string | null>('owner_token', { path: '/' }).value;
  }

  // Swaps the current session for the target's real one -- a full
  // navigation afterward (not just updating reactive refs) is deliberate:
  // every composable that reads the token cookie (useAuth, per-product
  // token exchanges, ...) needs a clean re-hydration against the new
  // identity, not a patchwork of manually-synced state.
  async function startImpersonation(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${hubApiBase}/auth/impersonate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return { success: false, error: data?.error || `request failed (${response.status})` };
      }
      return { success: true };
    } catch (error) {
      logWarn(`[useImpersonation] start failed: ${String(error)}`);
      return { success: false, error: 'network error' };
    }
  }

  async function exitImpersonation(): Promise<boolean> {
    try {
      const response = await fetch(`${hubApiBase}/auth/impersonate/exit`, {
        method: 'POST',
        credentials: 'include',
      });
      return response.ok;
    } catch (error) {
      logWarn(`[useImpersonation] exit failed: ${String(error)}`);
      return false;
    }
  }

  return { isImpersonating, startImpersonation, exitImpersonation };
}
