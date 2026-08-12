import type { ComputedRef } from 'vue';
import { ref, computed } from 'vue';
import { CookieKeys } from '@/utils/storageKeys';
import { logError } from '@/utils/logger';

// Persisted across visits so a dismissed banner stays gone -- there's no
// "seen" flag on the coverage record itself, so dismissal is tracked purely
// client-side by request id.
const DISMISSED_KEY = 'atrace-dismissed-coverage-approvals';

export type CoverageApprovalBanner = {
  id: string;
  date: string;
  coveringUserId: string;
  coveringUserName: string;
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

// Full-width "your shift on <date> is now covered by <name>" banners for
// approved coverage requests -- the point is the employee who asked for the
// swap actually notices the approval instead of it sitting silently in a
// Settings tab they have no reason to open. Only surfaces requests where the
// current user is the one being covered (originalUserId), not the coworker
// covering for them.
export function useAtraceCoverageApprovalBanners(nsSlug: ComputedRef<string>) {
  const banners = ref<CoverageApprovalBanner[]>([]);
  const loaded = ref(false);

  async function load(currentUserId: string) {
    try {
      if (!nsSlug.value || !currentUserId) return;
      const hubToken = useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value;
      if (!hubToken) return;

      const { atraceGetShiftCoverages } = await import('@/api/atrace/schedule/coverage');
      const coverages = await atraceGetShiftCoverages(currentUserId, undefined, undefined, nsSlug.value);
      const approved = coverages.filter((c) => c.status === 'approved' && c.originalUserId === currentUserId);

      const dismissed = readDismissed();
      const visible = approved.filter((c) => !dismissed.has(c.id));
      if (visible.length === 0) {
        banners.value = [];
        return;
      }

      // Resolve covering-user display names -- best effort, falls back to
      // the raw id if the lookup fails, so a name-resolution hiccup never
      // hides an otherwise-valid approval.
      const nameById = new Map<string, string>();
      try {
        const [{ hubNamespaceBySlug }, { hubMembersList }, { FilterPaginationLengthEnum }] = await Promise.all([
          import('@/api/hub/namespaces/get'),
          import('@/api/hub/members/list'),
          import('@gql-hub'),
        ]);
        const ns = await hubNamespaceBySlug(hubToken, nsSlug.value);
        if (ns?.id) {
          const members = await hubMembersList(hubToken, ns.id, 1, FilterPaginationLengthEnum.Fifty);
          for (const m of members) nameById.set(m.userId, m.nickname || m.username);
        }
      } catch (e) {
        logError('[useAtraceCoverageApprovalBanners] failed to resolve names:', e);
      }

      banners.value = visible.map((c) => ({
        id: c.id,
        date: c.date,
        coveringUserId: c.coveringUserId,
        coveringUserName: nameById.get(c.coveringUserId) || c.coveringUserId,
      }));
    } catch (e) {
      logError('[useAtraceCoverageApprovalBanners] load failed:', e);
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
