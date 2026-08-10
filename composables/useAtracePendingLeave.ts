import type { ComputedRef } from 'vue';
import { ref, computed } from 'vue';
import { logError } from '@/utils/logger';

// Count of leave requests (отгул/отпуск) awaiting approval, for the red badge
// on the Атrace "Управление" entry point and the Отгулы/отпуска tab -- both
// meant to make sure a manager actually notices a pending request instead of
// it sitting unseen in a tab they weren't already on. getLeaveRequests with
// no userId filter requires tracker.schedule.manage server-side, so this
// naturally comes back empty (not an error worth surfacing) for anyone who
// isn't a manager/admin. Mirrors useAtracePendingCoverageCount.
export function useAtracePendingLeaveCount(nsSlug: ComputedRef<string>) {
  const pendingCount = ref(0);
  const loaded = ref(false);
  let loadPromise: Promise<void> | null = null;

  function loadPendingLeaveCount(): Promise<void> {
    if (loadPromise) return loadPromise;

    loadPromise = (async () => {
      try {
        if (!nsSlug.value) return;
        const { atraceGetLeaveRequests } = await import('@/api/atrace/schedule/leave');
        const requests = await atraceGetLeaveRequests(undefined, undefined, undefined, nsSlug.value);
        pendingCount.value = requests.filter((r) => r.status === 'pending').length;
      } catch (e) {
        logError('[useAtracePendingLeaveCount] load failed:', e);
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
    loadPendingLeaveCount,
  };
}
