// Static (locally-persisted) namespace member roles for the contacts app.
// The hub doesn't yet expose per-app roles, so we derive a role map from
// membership + a localStorage cache, scoped per namespace.
import { logError } from '@/utils/logger';
import { hubNamespaceBySlug } from '@/api/hub/namespaces/get';
import { hubMembersList } from '@/api/hub/members/list';
import { FilterPaginationLengthEnum } from '@gql-hub';

export type StaticAccessRole = 'OWNER' | 'ADMIN' | 'OPERATOR' | 'VIEWER';

export interface NamespaceMember {
  id: string;
  userId: string;
  username: string;
  email: string;
}

function normalizeRole(raw?: string | null): StaticAccessRole {
  if (raw === 'OWNER' || raw === 'ADMIN' || raw === 'OPERATOR' || raw === 'VIEWER') return raw;
  // Backward compatibility for old saved role.
  if (raw === 'EDITOR') return 'OPERATOR';
  return 'VIEWER';
}

export function roleTone(role: StaticAccessRole): string {
  if (role === 'OWNER') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
  if (role === 'ADMIN') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
  if (role === 'OPERATOR') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
  return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
}

export function roleLabel(role: StaticAccessRole): string {
  if (role === 'OWNER') return 'Владелец';
  if (role === 'ADMIN') return 'Админ';
  if (role === 'OPERATOR') return 'Оператор';
  return 'Наблюдатель';
}

function storageKey(nsSlug: string): string {
  return `contacts:roles:${nsSlug}`;
}

function loadPersistedRoles(nsSlug: string): Record<string, StaticAccessRole> {
  if (!process.client) return {};
  try {
    const raw = localStorage.getItem(storageKey(nsSlug));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    const normalized: Record<string, StaticAccessRole> = {};
    for (const [memberId, role] of Object.entries(parsed || {})) {
      normalized[memberId] = normalizeRole(role);
    }
    return normalized;
  } catch {
    return {};
  }
}

function persistRoles(nsSlug: string, next: Record<string, StaticAccessRole>) {
  if (!process.client) return;
  localStorage.setItem(storageKey(nsSlug), JSON.stringify(next));
}

export function useNamespaceStaticRoles() {
  const namespaceMembers = ref<NamespaceMember[]>([]);
  const memberRoles = ref<Record<string, StaticAccessRole>>({});
  const rolesLoading = ref(false);
  const roleSavingMemberId = ref<string | null>(null);

  async function loadMembersAndRoles(nsSlug: string, hubToken?: string | null) {
    if (!hubToken || !nsSlug) return;
    rolesLoading.value = true;
    try {
      const namespace = await hubNamespaceBySlug(hubToken, nsSlug);
      if (!namespace?.id) {
        namespaceMembers.value = [];
        memberRoles.value = {};
        return;
      }

      const members: NamespaceMember[] = [];
      let page = 1;
      let batch: NamespaceMember[];
      do {
        batch = await hubMembersList(hubToken, namespace.id, page, FilterPaginationLengthEnum.Fifty);
        members.push(...batch);
        page += 1;
      } while (batch.length >= 50);

      namespaceMembers.value = members;

      const persisted = loadPersistedRoles(nsSlug);
      const nextRoles: Record<string, StaticAccessRole> = {};
      for (const member of members) {
        nextRoles[member.id] = normalizeRole(persisted[member.id]);
      }
      const ownerMember = members.find((member) => member.userId === namespace.owner);
      if (ownerMember) {
        nextRoles[ownerMember.id] = 'OWNER';
      }

      memberRoles.value = nextRoles;
      persistRoles(nsSlug, nextRoles);
    } catch (e) {
      logError('Failed to load members/roles in contacts settings:', e);
    } finally {
      rolesLoading.value = false;
    }
  }

  async function assignStaticRole(nsSlug: string, memberId: string, role: StaticAccessRole) {
    try {
      roleSavingMemberId.value = memberId;
      const next = { ...memberRoles.value, [memberId]: role };
      memberRoles.value = next;
      persistRoles(nsSlug, next);
    } finally {
      roleSavingMemberId.value = null;
    }
  }

  return {
    namespaceMembers,
    memberRoles,
    rolesLoading,
    roleSavingMemberId,
    loadMembersAndRoles,
    assignStaticRole,
  };
}
