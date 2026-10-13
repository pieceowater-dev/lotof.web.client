import { ref } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { memberDisplayNameWithFallback } from '@/utils/memberDisplayName';
import { FilterPaginationLengthEnum } from '@gql-hub';
import { logError } from '@/utils/logger';

// Display names of the namespace's members, loaded once per namespace; feeds
// order fields whose list comes from "staff".
const cache = new Map<string, string[]>();

export function useStaffNames() {
  const { token: hubToken } = useAuth();
  const names = ref<string[]>([]);

  async function load(nsSlug: string) {
    if (cache.has(nsSlug)) { names.value = cache.get(nsSlug)!; return; }
    if (!hubToken.value || !nsSlug) return;
    try {
      const { hubNamespaceBySlug } = await import('@/api/hub/namespaces/get');
      const { hubMembersList } = await import('@/api/hub/members/list');
      const ns = await hubNamespaceBySlug(hubToken.value, nsSlug);
      if (!ns?.id) return;
      const out: string[] = [];
      let page = 1;
      let batch: Array<{ username: string; email: string; nickname?: string | null }>;
      do {
        batch = await hubMembersList(hubToken.value, ns.id, page, FilterPaginationLengthEnum.Fifty);
        for (const m of batch) out.push(memberDisplayNameWithFallback(m, m.email));
        page += 1;
      } while (batch.length >= 50);
      const sorted = out.filter(Boolean).sort((a, b) => a.localeCompare(b));
      cache.set(nsSlug, sorted);
      names.value = sorted;
    } catch (e) {
      logError('[useStaffNames] load failed', e);
    }
  }

  return { names, load };
}
