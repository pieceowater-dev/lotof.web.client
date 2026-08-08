import type { ComputedRef } from 'vue';
import { ref, computed } from 'vue';
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

  function loadPermissions(): Promise<void> {
    if (loadPromise) return loadPromise;

    loading.value = true;
    loadPromise = (async () => {
      try {
        const hubToken = useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value;
        if (!hubToken || !nsSlug.value) return;

        const atraceToken = await ensureAtraceToken(nsSlug.value, hubToken);
        if (!atraceToken) return;

        const { atraceGetMyPermissions } = await import('@/api/atrace/auth/getMyPermissions');
        const perms = await atraceGetMyPermissions(atraceToken, nsSlug.value);
        allowed.value = new Set(perms);
      } catch (e) {
        logError('[useAtracePermissions] loadPermissions failed:', e);
      } finally {
        loaded.value = true;
        loading.value = false;
        loadPromise = null;
      }
    })();

    return loadPromise;
  }

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
