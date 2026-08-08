import type { ComputedRef } from 'vue';
import { ref, computed } from 'vue';
import { logError } from '@/utils/logger';

// Count of shift-coverage requests awaiting approval, for the red badge on
// the Атrace "Управление" entry point and the Подмены смен tab -- both meant
// to make sure a manager actually notices a pending request instead of it
// sitting unseen in a tab they weren't already on. getShiftCoverages with no
// userId filter requires tracker.schedule.manage server-side, so this
// naturally comes back empty (not an error worth surfacing) for anyone who
// isn't a manager/admin.
export function useAtracePendingCoverageCount(nsSlug: ComputedRef<string>) {
  const pendingCount = ref(0);
  const loaded = ref(false);
  let loadPromise: Promise<void> | null = null;

  function loadPendingCoverageCount(): Promise<void> {
    if (loadPromise) return loadPromise;

    loadPromise = (async () => {
      try {
        if (!nsSlug.value) return;
        const { atraceGetShiftCoverages } = await import('@/api/atrace/schedule/coverage');
        const coverages = await atraceGetShiftCoverages(undefined, undefined, undefined, nsSlug.value);
        pendingCount.value = coverages.filter((c) => c.status === 'pending').length;
      } catch (e) {
        logError('[useAtracePendingCoverageCount] load failed:', e);
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
    loadPendingCoverageCount,
  };
}
