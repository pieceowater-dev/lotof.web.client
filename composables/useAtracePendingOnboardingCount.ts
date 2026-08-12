import type { ComputedRef } from 'vue';
import { ref, computed } from 'vue';
import { logError } from '@/utils/logger';

// Count of QR-scan onboarding requests awaiting owner decision -- same
// badge signal as useAtracePendingCoverageCount/useAtracePendingLeaveCount.
// getOnboardingRequests is owner-only server-side, so this naturally comes
// back empty (not worth surfacing as an error) for anyone who isn't the
// namespace owner.
export function useAtracePendingOnboardingCount(nsSlug: ComputedRef<string>) {
  const pendingCount = ref(0);
  const loaded = ref(false);
  let loadPromise: Promise<void> | null = null;

  function loadPendingOnboardingCount(): Promise<void> {
    if (loadPromise) return loadPromise;

    loadPromise = (async () => {
      try {
        if (!nsSlug.value) return;
        const { atraceGetOnboardingRequests } = await import('@/api/atrace/onboarding/onboarding');
        const requests = await atraceGetOnboardingRequests('pending', nsSlug.value);
        pendingCount.value = requests.length;
      } catch (e) {
        logError('[useAtracePendingOnboardingCount] load failed:', e);
      } finally {
        loaded.value = true;
        loadPromise = null;
      }
    })();

    return loadPromise;
  }

  return {
    pendingCount: computed(() => pendingCount.value),
    loaded: computed(() => loaded.value),
    loadPendingOnboardingCount,
  };
}
