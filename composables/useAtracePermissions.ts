import type { ComputedRef } from 'vue';
import { ref, computed, watch } from 'vue';
import { CookieKeys } from '@/utils/storageKeys';
import { useAtraceToken } from '@/composables/useAtraceToken';
import { logError } from '@/utils/logger';

// Proactive "what can I do" lookup for gating UI (hide a button instead of
// showing it and erroring after the click) -- backed by getMyPermissions,
// which flattens the same permission map @auth already resolves per request
// server-side, so this costs one extra lightweight query, not a new
// permission model to keep in sync.
export function useAtracePermissions(nsSlug: ComputedRef<string>) {
  const { ensure: ensureAtraceToken } = useAtraceToken();

  const allowed = ref<Set<string>>(new Set());
  const loading = ref(false);
  const loaded = ref(false);
  let loadPromise: Promise<void> | null = null;

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  function loadPermissions(): Promise<void> {
    // A resolved-successfully load is final; a call after that is a no-op.
    // A *failed* load (no token yet on client-side nav, transient error)
    // must be retryable -- callers otherwise get a permanently empty set and
    // e.g. the Analytics toggle stays hidden until a manual refresh.
    if (loadPromise) return loadPromise;
    if (loaded.value) return Promise.resolve();

    loading.value = true;
    loadPromise = (async () => {
      try {
        // Retry: on client-side navigation from the home page the atrace
        // token is still being minted when this first runs, so the initial
        // attempt legitimately has nothing to work with.
        const maxAttempts = 5;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          const hubToken = useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value;
          if (hubToken && nsSlug.value) {
            try {
              const atraceToken = await ensureAtraceToken(nsSlug.value, hubToken);
              if (atraceToken) {
                const { atraceGetMyPermissions } = await import('@/api/atrace/auth/getMyPermissions');
                const perms = await atraceGetMyPermissions(atraceToken, nsSlug.value);
                allowed.value = new Set(perms);
                loaded.value = true;
                return;
              }
            } catch (e) {
              logError(`[useAtracePermissions] attempt ${attempt}/${maxAttempts} failed:`, e);
            }
          }
          if (attempt < maxAttempts) await sleep(400 * attempt);
        }
      } finally {
        loading.value = false;
        loadPromise = null;
      }
    })();

    return loadPromise;
  }

  // Switching namespace (e.g. via the workspace switcher, without a full page
  // load) must drop the previous namespace's answer and re-resolve, otherwise
  // `loaded` stays latched and callers keep showing the old namespace's perms.
  watch(nsSlug, (next, prev) => {
    if (next === prev) return;
    allowed.value = new Set();
    loaded.value = false;
  });

  // "service.module.method", e.g. "tracker.post.create" -- matches the
  // dot-joined form perms.Require()/@auth(requires: [...]) use server-side.
  function can(permission: string): boolean {
    return allowed.value.has(permission);
  }

  return {
    loading: computed(() => loading.value),
    loaded: computed(() => loaded.value),
    can,
    loadPermissions,
  };
}
