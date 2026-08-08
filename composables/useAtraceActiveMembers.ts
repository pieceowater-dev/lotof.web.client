import type { ComputedRef } from 'vue';
import { ref, computed } from 'vue';
import { CookieKeys } from '@/utils/storageKeys';
import { useAtraceToken } from '@/composables/useAtraceToken';
import { logError } from '@/utils/logger';

const GET_ACTIVE_MEMBERS = `
  query GetActiveMembers($page: Int!, $pageSize: Int!) {
    getActiveMembers(page: $page, pageSize: $pageSize) {
      userId
      isActive
    }
  }
`;

// Lightweight "which users are active" lookup, for views that only need to
// filter a list down to active employees (attendance stats, member/route
// pickers) -- NOT the full useAtraceMembers(), which additionally fetches
// role + schedule per member via one extra GraphQL call *per member*
// (Promise.all over the whole namespace, with a second fallback call for
// any member missing a role). That N+1 join is the right cost for the
// Settings members table, which actually needs role/schedule, but wasteful
// for anything that only reads isActive -- this hits a single
// getActiveMembers query instead.
export function useAtraceActiveMembers(nsSlug: ComputedRef<string>) {
  const { ensure: ensureAtraceToken } = useAtraceToken();

  const activeUserIds = ref<Set<string>>(new Set());
  const loading = ref(false);
  const loaded = ref(false);
  let loadPromise: Promise<void> | null = null;

  function loadActiveMembers(): Promise<void> {
    if (loadPromise) return loadPromise;

    loading.value = true;
    loadPromise = (async () => {
      try {
        const hubToken = useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value;
        if (!hubToken || !nsSlug.value) return;

        const atraceToken = await ensureAtraceToken(nsSlug.value, hubToken);
        if (!atraceToken) return;

        const { atraceClient } = await import('@/api/clients');
        const { atraceRequestWithRefresh } = await import('@/api/atrace/atraceRequestWithRefresh');
        const { getDeviceHeaders } = await import('@/utils/device');
        const devHeaders = await getDeviceHeaders();

        const res = await atraceRequestWithRefresh(
          () => atraceClient.request<{ getActiveMembers: Array<{ userId: string; isActive: boolean }> }>(
            GET_ACTIVE_MEMBERS,
            { page: 1, pageSize: 100 },
            {
              headers: {
                AtraceAuthorization: `Bearer ${atraceToken}`,
                Namespace: nsSlug.value,
                ...devHeaders,
              },
            }
          ),
          nsSlug.value
        );

        const ids = new Set<string>();
        (res?.getActiveMembers || []).forEach((m) => {
          if (m?.userId && m.isActive) ids.add(m.userId);
        });
        activeUserIds.value = ids;
      } catch (e) {
        logError('[useAtraceActiveMembers] loadActiveMembers failed:', e);
      } finally {
        // Set even on failure/early-return -- callers gate a loading spinner
        // on `loaded`, and a permanently-false value here would spin forever
        // instead of falling through to (an empty, but at least not stuck)
        // active-filtered view.
        loaded.value = true;
        loading.value = false;
        loadPromise = null;
      }
    })();

    return loadPromise;
  }

  // For callers that cache across a reactive nsSlug (e.g. switching
  // namespaces without a full page navigation) -- clears the previous
  // namespace's active list so a stale one can't linger until the next
  // loadActiveMembers() resolves.
  function resetActiveMembers() {
    activeUserIds.value = new Set();
    loaded.value = false;
  }

  return {
    activeUserIds: computed(() => activeUserIds.value),
    loading: computed(() => loading.value),
    loaded: computed(() => loaded.value),
    resetActiveMembers,
    loadActiveMembers,
  };
}
