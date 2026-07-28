import { atraceClient } from '@/api/clients';
import { getDeviceHeaders } from '@/utils/device';
import { atraceRequestWithRefresh } from '@/api/atrace/atraceRequestWithRefresh';
import { useRoute } from 'vue-router';

export type AtraceAttendanceSummary = {
  id: string;
  userId: string;
  year: number;
  month: number;
  requiredDays: number;
  attendedDays: number;
  missedDays: number;
  legitimateAbsences: number;
  totalWorkedHours: number;
  averageHoursPerDay: number;
  lateDays: number;
  earlyLeaveDays: number;
  lateMadeUpDays: number;
};

const SUMMARY_FIELDS = `
  id
  userId
  year
  month
  requiredDays
  attendedDays
  missedDays
  legitimateAbsences
  totalWorkedHours
  averageHoursPerDay
  lateDays
  earlyLeaveDays
  lateMadeUpDays
`;

const GET_MONTHLY_SUMMARY = `
  query GetMonthlySummary($userId: ID!, $year: Int!, $month: Int!) {
    getMonthlySummary(input: { userId: $userId, year: $year, month: $month }) {
      ${SUMMARY_FIELDS}
    }
  }
`;

const GET_SUMMARY_RANGE = `
  query GetSummaryRange($userId: ID!, $startYear: Int!, $startMonth: Int!, $endYear: Int!, $endMonth: Int!) {
    getSummaryRange(input: { userId: $userId, startYear: $startYear, startMonth: $startMonth, endYear: $endYear, endMonth: $endMonth }) {
      ${SUMMARY_FIELDS}
    }
  }
`;

function resolveNsSlug(nsSlug?: string): string {
  if (nsSlug) return nsSlug;
  try {
    const routeNs = useRoute().params.namespace;
    if (typeof routeNs === 'string' && routeNs) {
      return routeNs;
    }
  } catch {}
  throw new Error('Namespace slug is required');
}

// userId: pass '' (or omit) to mean "my own" -- the backend resolves that
// from the caller's token and only requires tracker.attendance.view, not
// .manage, for the self case.
export async function atraceGetMonthlySummary(
  userId: string,
  year: number,
  month: number,
  nsSlug?: string
): Promise<AtraceAttendanceSummary> {
  const namespace = resolveNsSlug(nsSlug);
  return atraceRequestWithRefresh(async () => {
    const devHeaders = await getDeviceHeaders();
    const response = await atraceClient.request<{ getMonthlySummary: AtraceAttendanceSummary }>(
      GET_MONTHLY_SUMMARY,
      { userId, year, month },
      { headers: { Namespace: namespace, ...devHeaders } }
    );
    return response.getMonthlySummary;
  }, namespace);
}

// userId: pass '' (or omit) to mean "my own".
export async function atraceGetSummaryRange(
  userId: string,
  startYear: number,
  startMonth: number,
  endYear: number,
  endMonth: number,
  nsSlug?: string
): Promise<AtraceAttendanceSummary[]> {
  const namespace = resolveNsSlug(nsSlug);
  return atraceRequestWithRefresh(async () => {
    const devHeaders = await getDeviceHeaders();
    const response = await atraceClient.request<{ getSummaryRange: AtraceAttendanceSummary[] }>(
      GET_SUMMARY_RANGE,
      { userId, startYear, startMonth, endYear, endMonth },
      { headers: { Namespace: namespace, ...devHeaders } }
    );
    return response.getSummaryRange;
  }, namespace);
}
