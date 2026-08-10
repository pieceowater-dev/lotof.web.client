import type { ComputedRef } from 'vue';
import { ref, computed } from 'vue';
import { CookieKeys } from '@/utils/storageKeys';
import { logError } from '@/utils/logger';
import type { AtraceLeaveType } from '@/api/atrace/schedule/leave';

// Persisted across visits so a dismissed banner stays gone -- there's no
// "seen" flag on the leave record itself, so dismissal is tracked purely
// client-side by request id. Mirrors useAtraceCoverageApprovalBanners.
const DISMISSED_KEY = 'atrace-dismissed-leave-approvals';

export type LeaveApprovalBanner = {
  id: string;
  startDate: string;
  endDate: string;
  type: AtraceLeaveType;
};

function readDismissed(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return new Set<string>(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function writeDismissed(ids: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(ids)));
  } catch {}
}

// Full-width "your leave on <date> has been approved" banners for approved
// leave requests -- the point is the employee who asked for the day off
// actually notices the approval instead of it sitting silently in a Settings
// tab they have no reason to open.
export function useAtraceLeaveApprovalBanners(nsSlug: ComputedRef<string>) {
  const banners = ref<LeaveApprovalBanner[]>([]);
  const loaded = ref(false);

  async function load(currentUserId: string) {
    try {
      if (!nsSlug.value || !currentUserId) return;
      const hubToken = useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value;
      if (!hubToken) return;

      const { atraceGetLeaveRequests } = await import('@/api/atrace/schedule/leave');
      const requests = await atraceGetLeaveRequests(currentUserId, undefined, undefined, nsSlug.value);
      const approved = requests.filter((r) => r.status === 'approved' && r.userId === currentUserId);

      const dismissed = readDismissed();
      const visible = approved.filter((r) => !dismissed.has(r.id));

      banners.value = visible.map((r) => ({
        id: r.id,
        startDate: r.startDate,
        endDate: r.endDate,
        type: r.type,
      }));
    } catch (e) {
      logError('[useAtraceLeaveApprovalBanners] load failed:', e);
    } finally {
      loaded.value = true;
    }
  }

  function dismiss(id: string) {
    const dismissed = readDismissed();
    dismissed.add(id);
    writeDismissed(dismissed);
    banners.value = banners.value.filter((b) => b.id !== id);
  }

  return {
    banners: computed(() => banners.value),
    loaded: computed(() => loaded.value),
    load,
    dismiss,
  };
}
