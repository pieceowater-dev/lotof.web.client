import type { ComputedRef } from 'vue';
import { CookieKeys } from '@/utils/storageKeys';
import { useAtraceToken } from '@/composables/useAtraceToken';
import { useI18n } from '@/composables/useI18n';
import { logError } from '@/utils/logger';
import { localizeAtraceErrorMessage } from '@/utils/atrace/localizeError';
import type { Role } from '@/api/atrace/role/getRoles';

export type AtraceMember = {
  id: string;
  userId: string;
  username: string;
  email: string;
  roleId?: string | null;
  roleName?: string | null;
  requiredWorkingDays?: number;
  requiredWorkingHours?: number;
  isActive?: boolean;
};

const DEFAULT_REQUIRED_WORKING_DAYS = 22;
const DEFAULT_REQUIRED_WORKING_HOURS = 8;

// Members list + roles + member edit/toggle-active + invite flow for the
// A-Trace settings page. Kept as one composable since the member-edit role
// selector and the invite-role selector both need `roles`, and the invite
// flow is otherwise fully independent of the members list.
export function useAtraceMembers(nsSlug: ComputedRef<string>) {
  const { t } = useI18n();
  const router = useRouter();
  const { ensure: ensureAtraceToken } = useAtraceToken();

  const members = ref<AtraceMember[]>([]);
  const roles = ref<Role[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Pagination
  const membersPage = ref(1);
  const membersPageCount = ref(10);
  const paginatedMembers = computed(() => {
    const start = (membersPage.value - 1) * membersPageCount.value;
    const end = start + membersPageCount.value;
    return members.value.slice(start, end);
  });

  // Cache to prevent duplicate concurrent requests
  let loadMembersPromise: Promise<void> | null = null;

  // Edit member modal
  const isEditMemberOpen = ref(false);
  const editingMember = ref<AtraceMember | null>(null);
  const editForm = reactive<{ roleId: string; requiredWorkingDays: number; requiredWorkingHours: number }>({
    roleId: '',
    requiredWorkingDays: DEFAULT_REQUIRED_WORKING_DAYS,
    requiredWorkingHours: DEFAULT_REQUIRED_WORKING_HOURS
  });

  async function loadMembers() {
    // Prevent duplicate concurrent requests
    if (loadMembersPromise) {
      return loadMembersPromise;
    }

    loading.value = true;
    error.value = null;

    loadMembersPromise = (async () => {
      try {
        const hubToken = useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value;
        if (!hubToken) {
          router.push('/');
          return;
        }

        // Get atrace token
        const atraceToken = await ensureAtraceToken(nsSlug.value, hubToken);
        if (!atraceToken) {
          router.push('/');
          return;
        }

        // Get namespace ID from route or from API
        const { hubNamespaceBySlug } = await import('@/api/hub/namespaces/get');
        const ns = await hubNamespaceBySlug(hubToken, nsSlug.value);
        if (!ns?.id) {
          error.value = 'Namespace not found';
          return;
        }

        // Load members - using FIFTY to get more members
        const { hubMembersList } = await import('@/api/hub/members/list');
        const membersList = await hubMembersList(hubToken, ns.id, 1, 'FIFTY');

        // Load active members from A-Trace to mark statuses
        const { atraceClient } = await import('@/api/clients');
        const { atraceRequestWithRefresh } = await import('@/api/atrace/atraceRequestWithRefresh');
        const { getDeviceHeaders } = await import('@/utils/device');
        const activeUserIds = new Set<string>();
        try {
          const devHeaders = await getDeviceHeaders();
          const activeQuery = `
                                    query GetActiveMembers($page: Int!, $pageSize: Int!) {
                                        getActiveMembers(page: $page, pageSize: $pageSize) {
                                            userId
                                            isActive
                                        }
                                    }
                                `;

          const activeRes = await atraceRequestWithRefresh(
            () => atraceClient.request<{ getActiveMembers: Array<{ userId: string; isActive: boolean }> }>(
              activeQuery,
              { page: 1, pageSize: 100 },
              {
                headers: {
                  AtraceAuthorization: `Bearer ${atraceToken}`,
                  Namespace: nsSlug.value,
                  ...devHeaders
                }
              }
            ),
            nsSlug.value
          );

          (activeRes?.getActiveMembers || []).forEach((m) => {
            if (m?.userId && m.isActive) activeUserIds.add(m.userId);
          });
        } catch (err) {
          logError('[loadMembers] Failed to load active members list:', err);
        }

        // Load role and schedule for each member using combined query
        const { atraceGetMemberRoleAndSchedule } = await import('@/api/atrace/member/getMemberWithRoleAndSchedule');
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;

        members.value = await Promise.all(
          membersList.map(async (m) => {
            try {
              // Try with userId first (new style)
              let data = await atraceGetMemberRoleAndSchedule(
                atraceToken,
                nsSlug.value,
                m.userId,
                currentYear,
                currentMonth
              );

              // If no data, try with memberId (old style for owner)
              if (!data.role) {
                data = await atraceGetMemberRoleAndSchedule(
                  atraceToken,
                  nsSlug.value,
                  m.id,
                  currentYear,
                  currentMonth
                );
              }

              return {
                ...m,
                roleId: data.role?.id || null,
                roleName: data.role?.name || null,
                requiredWorkingDays: data.schedule?.shouldAttendDaysPerMonth ?? DEFAULT_REQUIRED_WORKING_DAYS,
                requiredWorkingHours: data.schedule?.shouldAttendHoursPerDay ?? DEFAULT_REQUIRED_WORKING_HOURS,
                isActive: activeUserIds.has(m.userId)
              };
            } catch (err) {
              logError(`Failed to load role/schedule for member ${m.userId}/${m.id}:`, err);
              return {
                ...m,
                roleId: null,
                roleName: null,
                requiredWorkingDays: DEFAULT_REQUIRED_WORKING_DAYS,
                requiredWorkingHours: DEFAULT_REQUIRED_WORKING_HOURS,
                isActive: activeUserIds.has(m.userId)
              };
            }
          })
        );
      } catch (e: unknown) {
        error.value = localizeAtraceErrorMessage(e, t) || 'Failed to load members';
      } finally {
        loading.value = false;
        loadMembersPromise = null;
      }
    })();

    return loadMembersPromise;
  }

  async function loadRoles() {
    try {
      const hubToken = useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value;
      const atraceToken = await ensureAtraceToken(nsSlug.value, hubToken);
      if (!atraceToken) return;

      const { atraceGetRoles } = await import('@/api/atrace/role/getRoles');
      roles.value = await atraceGetRoles(atraceToken, nsSlug.value);
    } catch (e) {
      logError('Failed to load roles:', e);
      // Fallback to empty array on error
      roles.value = [];
    }
  }

  function openEditMember(member: AtraceMember) {
    editingMember.value = member;
    editForm.roleId = member.roleId || '';
    editForm.requiredWorkingDays = member.requiredWorkingDays ?? DEFAULT_REQUIRED_WORKING_DAYS;
    editForm.requiredWorkingHours = member.requiredWorkingHours ?? DEFAULT_REQUIRED_WORKING_HOURS;
    isEditMemberOpen.value = true;
  }

  async function toggleMemberActive(member: AtraceMember) {
    const hubToken = useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value;
    if (!hubToken) {
      router.push('/');
      return;
    }

    try {
      const atraceToken = await ensureAtraceToken(nsSlug.value, hubToken);
      if (!atraceToken) {
        router.push('/');
        return;
      }

      const { atraceClient } = await import('@/api/clients');
      const { atraceRequestWithRefresh } = await import('@/api/atrace/atraceRequestWithRefresh');
      const { getDeviceHeaders } = await import('@/utils/device');

      const devHeaders = await getDeviceHeaders();

      const query = `
          mutation SetMemberActive($input: SetMemberActiveInput!) {
            setMemberActive(input: $input) {
              id
              userId
              isActive
              createdAt
              updatedAt
            }
          }
        `;

      await atraceRequestWithRefresh(
        () => atraceClient.request<any>(
          query,
          {
            input: {
              userId: member.userId,
              isActive: member.isActive,
            }
          },
          {
            headers: {
              AtraceAuthorization: `Bearer ${atraceToken}`,
              Namespace: nsSlug.value,
              ...devHeaders
            }
          }
        ),
        nsSlug.value
      );
    } catch (e: any) {
      logError('[toggleMemberActive]', e);
      useToast().add({
        title: t('app.notification'),
        description: localizeAtraceErrorMessage(e, t) || 'Failed to update member status',
        color: 'red'
      });
      // Revert the toggle
      member.isActive = !member.isActive;
    }
  }

  async function handleSaveMember() {
    if (!editingMember.value) return;

    const hubToken = useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value;
    const atraceToken = await ensureAtraceToken(nsSlug.value, hubToken);
    if (!atraceToken) {
      router.push('/');
      return;
    }

    try {
      const { atraceAssignRole, atraceRemoveRole } = await import('@/api/atrace/role/assign');
      const { atraceUpdateSchedule } = await import('@/api/atrace/attendance/schedule');
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      // Try to use userId first for assignment (new style), fall back to memberId (old style)
      const primaryMemberId = editingMember.value.userId;
      const fallbackMemberId = editingMember.value.id;

      // Assign role via Atrace API if roleId is provided
      if (editForm.roleId) {
        try {
          await atraceAssignRole(atraceToken, nsSlug.value, editForm.roleId, primaryMemberId);
        } catch (err) {
          // If userId fails, try memberId
          logError(`Failed to assign role with userId, trying memberId:`, err);
          await atraceAssignRole(atraceToken, nsSlug.value, editForm.roleId, fallbackMemberId);
        }
      } else {
        // Remove role if empty
        const previousRoleId = editingMember.value.roleId;
        if (previousRoleId) {
          try {
            await atraceRemoveRole(atraceToken, nsSlug.value, previousRoleId, primaryMemberId);
          } catch (err) {
            // If userId fails, try memberId
            logError(`Failed to remove role with userId, trying memberId:`, err);
            await atraceRemoveRole(atraceToken, nsSlug.value, previousRoleId, fallbackMemberId);
          }
        }
      }

      // Force integers for required work params
      const requiredDays = Math.round(editForm.requiredWorkingDays);
      const requiredHours = Math.round(editForm.requiredWorkingHours);
      editForm.requiredWorkingDays = requiredDays;
      editForm.requiredWorkingHours = requiredHours;

      try {
        await atraceUpdateSchedule(
          atraceToken,
          nsSlug.value,
          primaryMemberId,
          currentYear,
          currentMonth,
          requiredDays,
          requiredHours
        );
      } catch (err) {
        // If userId fails, try memberId
        logError(`Failed to update schedule with userId, trying memberId:`, err);
        await atraceUpdateSchedule(
          atraceToken,
          nsSlug.value,
          fallbackMemberId,
          currentYear,
          currentMonth,
          requiredDays,
          requiredHours
        );
      }

      // Close modal and reload members to get fresh data from backend
      isEditMemberOpen.value = false;
      editingMember.value = null;

      // Reload members to reflect changes from backend
      await loadMembers();
    } catch (e: unknown) {
      error.value = localizeAtraceErrorMessage(e, t) || 'Failed to update member';
    }
  }

  // ---- Invite flow ----

  const isInviteOpen = ref(false);
  const inviteEmail = ref('');
  const inviteRoleId = ref<string>('');
  const inviteDays = ref<number>(DEFAULT_REQUIRED_WORKING_DAYS);
  const inviteHours = ref<number>(DEFAULT_REQUIRED_WORKING_HOURS);
  const inviteSubmitting = ref(false);
  const inviteError = ref<string | null>(null);
  const isValidInviteEmail = computed(() => {
    const email = inviteEmail.value.trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  });
  const inviteCanSubmit = computed(() => isValidInviteEmail.value && !inviteSubmitting.value);

  function buildActionsJson(): string {
    const ops: Array<any> = [];
    console.log('[buildActionsJson] inviteRoleId:', inviteRoleId.value);
    const roleIdNum = inviteRoleId.value ? parseInt(inviteRoleId.value, 10) : NaN;
    console.log('[buildActionsJson] roleIdNum:', roleIdNum);
    if (!Number.isNaN(roleIdNum)) {
      ops.push({ op: 'assign_role', params: { roleId: roleIdNum } });
    }
    ops.push({ op: 'set_active', params: { isActive: true } });
    const d = Math.max(0, Math.round(inviteDays.value));
    const h = Math.max(0, Math.round(inviteHours.value));
    ops.push({ op: 'create_schedule', params: { workDays: d, hoursPerDay: h } });
    console.log('[buildActionsJson] final ops:', ops);
    return JSON.stringify({ version: 1, 'pieceowater.atrace': ops });
  }

  async function submitInvite() {
    inviteError.value = null;
    const hubToken = useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value;
    if (!hubToken) {
      router.push('/');
      return;
    }
    const email = inviteEmail.value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      inviteError.value = t('app.invalidEmail') || 'Enter a valid email';
      return;
    }
    try {
      inviteSubmitting.value = true;
      const { hubCreateInvite } = await import('@/api/hub/invite/create');
      const actions = buildActionsJson();
      console.log('[submitInvite] actions:', actions);
      // default expiresAt: 30 days
      const expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
      await hubCreateInvite(hubToken, {
        namespaceSlug: nsSlug.value,
        email,
        actions,
        expiresAt
      });
      useToast().add({ title: t('app.notification'), description: t('app.sendInvite') || 'Invite sent', color: 'primary' });
      inviteEmail.value = '';
      isInviteOpen.value = false;
    } catch (e: any) {
      inviteError.value = e?.response?.errors?.[0]?.message || e?.message || 'Failed to create invite';
    } finally {
      inviteSubmitting.value = false;
    }
  }

  return {
    members, roles, loading, error,
    membersPage, membersPageCount, paginatedMembers,
    isEditMemberOpen, editingMember, editForm,
    loadMembers, loadRoles, openEditMember, handleSaveMember, toggleMemberActive,

    isInviteOpen, inviteEmail, inviteRoleId, inviteDays, inviteHours, inviteSubmitting, inviteError,
    isValidInviteEmail, inviteCanSubmit, submitInvite,
  };
}
