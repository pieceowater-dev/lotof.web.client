import { atraceClient } from '@/api/clients';
import { getDeviceHeaders } from '@/utils/device';
import type { MemberRoleAndSchedule } from '@/api/atrace/member/getMemberWithRoleAndSchedule';

export type MemberRoleAndScheduleEntry = MemberRoleAndSchedule & {
  memberId: string;
};

const GET_MEMBERS_ROLES_AND_SCHEDULES_QUERY = /* GraphQL */ `
  query GetMembersRolesAndSchedules($input: GetMembersRolesAndSchedulesInput!) {
    getMembersRolesAndSchedules(input: $input) {
      memberId
      role {
        id
        name
        permissionIds
      }
      schedule {
        id
        userId
        year
        month
        shouldAttendDaysPerMonth
        shouldAttendHoursPerDay
        comment
      }
    }
  }
`;

// Batched counterpart to atraceGetMemberRoleAndSchedule -- one round trip
// for the whole members list instead of one per member. See
// getMembersRolesAndSchedules on the gateway for why.
export async function atraceGetMembersRolesAndSchedules(
  atraceToken: string,
  namespaceSlug: string,
  memberIds: string[],
  year: number,
  month: number
): Promise<MemberRoleAndScheduleEntry[]> {
  if (memberIds.length === 0) return [];

  const devHeaders = await getDeviceHeaders();
  const res = await atraceClient.request<{
    getMembersRolesAndSchedules: MemberRoleAndScheduleEntry[];
  }>(
    GET_MEMBERS_ROLES_AND_SCHEDULES_QUERY,
    {
      input: { memberIds, year, month }
    },
    {
      headers: {
        AtraceAuthorization: `Bearer ${atraceToken}`,
        Namespace: namespaceSlug,
        ...devHeaders,
      }
    }
  );
  return res.getMembersRolesAndSchedules;
}
