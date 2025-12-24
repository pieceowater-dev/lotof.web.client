import { atraceClient } from '@/api/clients';
import { getDeviceHeaders } from '@/utils/device';

export type MemberRoleAndSchedule = {
  role: {
    id: string;
    name: string;
    permissionIds: string[];
  } | null;
  schedule: {
    id: string;
    userId: string;
    year: number;
    month: number;
    shouldAttendDaysPerMonth: number;
    shouldAttendHoursPerDay: number;
    comment?: string | null;
  } | null;
};

const GET_MEMBER_ROLE_AND_SCHEDULE_QUERY = /* GraphQL */ `
  query GetMemberRoleAndSchedule($memberId: ID!, $scheduleInput: GetScheduleInput!) {
    getMemberRole(memberId: $memberId) {
      id
      name
      permissionIds
    }
    getSchedule(input: $scheduleInput) {
      id
      userId
      year
      month
      shouldAttendDaysPerMonth
      shouldAttendHoursPerDay
      comment
    }
  }
`;

export async function atraceGetMemberRoleAndSchedule(
  atraceToken: string,
  namespaceSlug: string,
  memberId: string,
  year: number,
  month: number
): Promise<MemberRoleAndSchedule> {
  const devHeaders = await getDeviceHeaders();
  const res = await atraceClient.request<{
    getMemberRole: MemberRoleAndSchedule['role'];
    getSchedule: MemberRoleAndSchedule['schedule'];
  }>(
    GET_MEMBER_ROLE_AND_SCHEDULE_QUERY,
    {
      memberId,
      scheduleInput: { userId: memberId, year, month }
    },
    {
      headers: {
        AtraceAuthorization: `Bearer ${atraceToken}`,
        Namespace: namespaceSlug,
        ...devHeaders,
      }
    }
  );
  return {
    role: res.getMemberRole,
    schedule: res.getSchedule
  };
}
