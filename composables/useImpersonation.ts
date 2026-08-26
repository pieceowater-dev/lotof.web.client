import { getApiBasePath } from '@/utils/api-base';
import { logWarn } from '@/utils/logger';
import { CookieKeys } from '@/utils/storageKeys';
import { useAtraceToken } from '@/composables/useAtraceToken';
import { useMenuToken } from '@/composables/useMenuToken';
import { useTasksToken } from '@/composables/useTasksToken';
import { useGoodsToken } from '@/composables/useGoodsToken';
import { useContactsToken } from '@/composables/useContactsToken';

const hubApiBase = getApiBasePath('hub');

// Every per-app token (Atrace/Menu/Tasks/Goods/Contacts) is minted against
// whichever hub identity was active at exchange time. Swapping identity
// (impersonate in, impersonate out) without invalidating these leaves stale
// cookies around: on the next page, useAppToken.ensure() sees a same-namespace
// cookie and just replays it instead of re-exchanging, so a namespace the new
// identity doesn't belong to (or a revoked membership) surfaces downstream as
// a hard "user is not a member of the namespace" failure instead of a clean
// re-exchange. Namespace-switch already clears these (useNamespace.setNamespace),
// but that path only fires when the namespace *slug* changes -- it does
// nothing when the identity changes while the slug stays the same, which is
// exactly the impersonate-in/out case.
function clearAllAppTokens() {
  if (!process.client) return;
  const clears: Array<[() => { clear: () => void }, string]> = [
    [useAtraceToken, CookieKeys.ATRACE_TOKEN],
    [useMenuToken, CookieKeys.MENU_TOKEN],
    [useTasksToken, CookieKeys.TASKS_TOKEN],
    [useGoodsToken, CookieKeys.GOODS_TOKEN],
    [useContactsToken, CookieKeys.CONTACTS_TOKEN],
  ];
  for (const [useToken, cookieKey] of clears) {
    try {
      useToken().clear();
      document.cookie = `${cookieKey}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;`;
    } catch {}
  }
}

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
      clearAllAppTokens();
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
      if (response.ok) clearAllAppTokens();
      return response.ok;
    } catch (error) {
      logWarn(`[useImpersonation] exit failed: ${String(error)}`);
      return false;
    }
  }

  return { isImpersonating, startImpersonation, exitImpersonation };
}
