import { atraceClient } from '@/api/clients';
import { getDeviceHeaders } from '@/utils/device';

export type Schedule = {
  id: string;
  userId: string;
  year: number;
  month: number;
  shouldAttendDaysPerMonth: number;
  shouldAttendHoursPerDay: number;
  comment?: string | null;
};

const GET_SCHEDULE = /* GraphQL */ `
  query GetSchedule($input: GetScheduleInput!) {
    getSchedule(input: $input) {
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

export async function atraceGetSchedule(
  atraceToken: string,
  namespaceSlug: string,
  userId: string,
  year: number,
  month: number
): Promise<Schedule> {
  const devHeaders = await getDeviceHeaders();
  const res = await atraceClient.request<{ getSchedule: Schedule }>(
    GET_SCHEDULE,
    { input: { userId, year, month } },
    {
      headers: {
        AtraceAuthorization: `Bearer ${atraceToken}`,
        Namespace: namespaceSlug,
        ...devHeaders,
      },
    }
  );
  return res.getSchedule;
}

const UPDATE_SCHEDULE = /* GraphQL */ `
  mutation UpdateSchedule($input: UpdateScheduleInput!) {
    updateSchedule(input: $input) {
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

export async function atraceUpdateSchedule(
  atraceToken: string,
  namespaceSlug: string,
  userId: string,
  year: number,
  month: number,
  shouldAttendDaysPerMonth: number,
  shouldAttendHoursPerDay: number,
  comment?: string | null
): Promise<Schedule> {
  const devHeaders = await getDeviceHeaders();
  const res = await atraceClient.request<{ updateSchedule: Schedule }>(
    UPDATE_SCHEDULE,
    {
      input: {
        userId,
        year,
        month,
        shouldAttendDaysPerMonth,
        shouldAttendHoursPerDay,
        comment: comment ?? undefined,
      },
    },
    {
      headers: {
        AtraceAuthorization: `Bearer ${atraceToken}`,
        Namespace: namespaceSlug,
        ...devHeaders,
      },
    }
  );
  return res.updateSchedule;
}
