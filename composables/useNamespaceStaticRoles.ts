// Namespace member roles for the Contacts app. OWNER is always derived live
// from namespace ownership (never stored); ADMIN/OPERATOR/VIEWER are real,
// backend-persisted per-member roles (contacts.msvc.core's MemberRole),
// enforced server-side by contacts.gtw when it mints a Contacts app token --
// not just a label. "OPERATOR" here is the Editor role on the backend.
import { logError } from '@/utils/logger';
import { hubNamespaceBySlug } from '@/api/hub/namespaces/get';
import { hubMembersList } from '@/api/hub/members/list';
import { FilterPaginationLengthEnum } from '@gql-hub';
import { contactsListMemberRoles, contactsSetMemberRole, type ContactsMemberAccessRole } from '@/api/contacts/memberRoles';

export type StaticAccessRole = 'OWNER' | 'ADMIN' | 'OPERATOR' | 'VIEWER';

function toBackendRole(role: StaticAccessRole): ContactsMemberAccessRole {
  return role === 'OPERATOR' ? 'EDITOR' : (role === 'ADMIN' ? 'ADMIN' : 'VIEWER');
}

function fromBackendRole(role: ContactsMemberAccessRole): StaticAccessRole {
  return role === 'EDITOR' ? 'OPERATOR' : (role === 'ADMIN' ? 'ADMIN' : 'VIEWER');
}

export interface NamespaceMember {
  id: string;
  userId: string;
  username: string;
  email: string;
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

export function useNamespaceStaticRoles() {
  const namespaceMembers = ref<NamespaceMember[]>([]);
  const memberRoles = ref<Record<string, StaticAccessRole>>({});
  const rolesLoading = ref(false);
  const roleSavingMemberId = ref<string | null>(null);

  // The UI keys everything by membership id (member.id), but the backend
  // (and the concept of "this user's role") is keyed by hub user id -- kept
  // here to translate assignStaticRole's memberId back to a userId.
  let userIdByMemberId: Record<string, string> = {};

  async function loadMembersAndRoles(nsSlug: string, hubToken?: string | null) {
    if (!hubToken || !nsSlug) return;
    rolesLoading.value = true;
    try {
      const namespace = await hubNamespaceBySlug(hubToken, nsSlug);
      if (!namespace?.id) {
        namespaceMembers.value = [];
        memberRoles.value = {};
        userIdByMemberId = {};
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
      userIdByMemberId = Object.fromEntries(members.map((m) => [m.id, m.userId]));

      const backendRoles = await contactsListMemberRoles(hubToken, nsSlug);
      const roleByUserId: Record<string, StaticAccessRole> = {};
      for (const row of backendRoles) {
        roleByUserId[row.userId] = fromBackendRole(row.role);
      }

      const nextRoles: Record<string, StaticAccessRole> = {};
      for (const member of members) {
        nextRoles[member.id] = roleByUserId[member.userId] || 'VIEWER';
      }
      const ownerMember = members.find((member) => member.userId === namespace.owner);
      if (ownerMember) {
        nextRoles[ownerMember.id] = 'OWNER';
      }

      memberRoles.value = nextRoles;
    } catch (e) {
      logError('Failed to load members/roles in contacts settings:', e);
    } finally {
      rolesLoading.value = false;
    }
  }

  async function assignStaticRole(nsSlug: string, memberId: string, role: StaticAccessRole, hubToken?: string | null) {
    const userId = userIdByMemberId[memberId];
    if (!hubToken || !nsSlug || !userId || role === 'OWNER') return;
    try {
      roleSavingMemberId.value = memberId;
      await contactsSetMemberRole(hubToken, nsSlug, userId, toBackendRole(role));
      memberRoles.value = { ...memberRoles.value, [memberId]: role };
    } catch (e) {
      logError('Failed to assign Contacts member role:', e);
      throw e;
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
