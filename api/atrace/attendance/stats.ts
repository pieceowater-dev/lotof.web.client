import { atraceClient, setAtraceAppToken } from '@/api/clients';
import { atraceGetAppToken } from '@/api/atrace/auth/getAppToken';
import { atraceRequestWithRefresh } from '@/api/atrace/atraceRequestWithRefresh';
import { CookieKeys } from '@/utils/storageKeys';
import { useAuth } from '@/composables/useAuth';
import { useRoute } from 'vue-router';

type UserAttendanceStats = {
  userId: string;
  username?: string;
  email?: string;
  workDays: number;
  attendedDays: number;
  violationDays: number;
  legitimateAbsences: number;
  totalWorkedHours: number;
};

const GET_ALL_USERS_STATS = `
  query GetAllUsersStats($startDate: String!, $endDate: String!, $postId: String) {
    getAllUsersStats(input: { startDate: $startDate, endDate: $endDate, postId: $postId }) {
      userId
      username
      workDays
      attendedDays
      violationDays
      legitimateAbsences
      totalWorkedHours
    }
  }
`;

const GET_ATTENDANCE_REPORT = `
  query GetAttendanceReport($userId: ID!, $startDate: String!, $endDate: String!) {
    getAttendanceReport(input: { userId: $userId, startDate: $startDate, endDate: $endDate }) {
      userId
      startDate
      endDate
      attendances {
        id
        userId
        date
        firstCheckIn
        lastCheckOut
        workedHours
        requiredHours
        attended
        legitimate
        reason
        processedAt
        checkCount
        firstRecordId
        lastRecordId
      }
    }
  }
`;

const GET_USERS_BY_IDS = `
  query GetUsersByIDs($ids: [ID!]!) {
    getUsersByIDs(ids: $ids) {
      id
      username
      email
    }
  }
`;

const EXPORT_DAILY_ATTENDANCE = `
  query ExportDailyAttendance($startDate: String!, $endDate: String!) {
    exportDailyAttendance(input: { startDate: $startDate, endDate: $endDate }) {
      userId
      username
      date
      firstCheckIn
      lastCheckOut
      workedHours
      attended
      legitimate
      reason
    }
  }
`;


// Helper: robust atraceClient request with auto-refresh on unauthorized
async function atraceRequestWithRefresh<T>(fn: () => Promise<T>, nsSlug: string): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isUnauthorized = error?.response?.errors?.some((e: any) =>
      typeof e.message === 'string' &&
      e.message.includes('AtraceAuthorization token is invalid')
    );
    if (isUnauthorized) {
      // Clear old token
      try { useCookie(CookieKeys.ATRACE_TOKEN).value = null as any; } catch {}
      setAtraceAppToken(null);
      // Try to get new token using hub token
      const { token } = useAuth();
      const hubToken = token.value;
      if (!hubToken) throw error;
      const newToken = await atraceGetAppToken(hubToken, nsSlug);
      if (newToken) {
        useCookie(CookieKeys.ATRACE_TOKEN, { path: '/' }).value = newToken;
        setAtraceAppToken(newToken);
        // Retry original request
        return await fn();
      }
    }
    throw error;
  }
}

export async function atraceGetAllUsersStats(
  startDate: string,
  endDate: string,
  postId?: string | null,
  nsSlug?: string
): Promise<UserAttendanceStats[]> {
  // nsSlug required for token refresh
  if (!nsSlug) {
    // Try to get from route if not provided
    try {
      nsSlug = useRoute().params.namespace as string;
    } catch {}
  }
  return atraceRequestWithRefresh(async () => {
    const response = await atraceClient.request<{
      getAllUsersStats: Array<{
        userId: string;
        username: string;
        workDays: number;
        attendedDays: number;
        violationDays: number;
        legitimateAbsences: number;
        totalWorkedHours: number;
      }>;
    }>(GET_ALL_USERS_STATS, { startDate, endDate, postId: postId ?? null });

    return response.getAllUsersStats;
  }, nsSlug!);
}

export async function atraceExportDailyAttendance(
  startDate: string,
  endDate: string,
  nsSlug?: string
): Promise<Array<{
  userId: string;
  username: string;
  date: string;
  firstCheckIn: number;
  lastCheckOut: number;
  workedHours: number;
  attended: boolean;
  legitimate: boolean;
  reason?: string;
}>> {
  if (!nsSlug) {
    try {
      nsSlug = useRoute().params.namespace as string;
    } catch {}
  }
  return atraceRequestWithRefresh(async () => {
    const response = await atraceClient.request<{
      exportDailyAttendance: Array<{
        userId: string;
        username: string;
        date: string;
        firstCheckIn: number;
        lastCheckOut: number;
        workedHours: number;
        attended: boolean;
        legitimate: boolean;
        reason?: string;
      }>;
    }>(EXPORT_DAILY_ATTENDANCE, { startDate, endDate });
    return response.exportDailyAttendance;
  }, nsSlug!);
}

export async function atraceGetAttendanceReport(
  userId: string,
  startDate: string,
  endDate: string,
  nsSlug?: string
): Promise<Array<{
  id: string;
  date: string;
  firstCheckIn: number; // unix timestamp
  lastCheckOut: number; // unix timestamp
  workedHours: number;
  requiredHours: number;
  attended: boolean;
  legitimate: boolean;
  reason?: string;
}>> {
  // nsSlug required for token refresh
  if (!nsSlug) {
    // Try to get from route if not provided
    try {
      nsSlug = useRoute().params.namespace as string;
    } catch {}
  }
  return atraceRequestWithRefresh(async () => {
    const response = await atraceClient.request<{
      getAttendanceReport: {
        userId: string;
        startDate: string;
        endDate: string;
        attendances: Array<{
          id: string;
          userId: string;
          date: string;
          firstCheckIn: number;
          lastCheckOut: number;
          workedHours: number;
          requiredHours: number;
          attended: boolean;
          legitimate: boolean;
          reason: string;
          processedAt: number;
          checkCount: number;
          firstRecordId: string;
          lastRecordId: string;
        }>;
      };
    }>(GET_ATTENDANCE_REPORT, { userId, startDate, endDate });

    return response.getAttendanceReport.attendances;
  }, nsSlug!);
}

const MARK_DAY_LEGITIMATE = `
  mutation MarkDayLegitimate($userId: ID!, $date: String!, $reason: String!) {
    markDayLegitimate(input: { userId: $userId, date: $date, reason: $reason }) {
      id
      userId
      date
      attended
      legitimate
      reason
    }
  }
`;

export async function atraceMarkDayLegitimate(
  userId: string,
  date: string,
  reason: string,
  nsSlug?: string
): Promise<boolean> {
  // nsSlug required for token refresh
  if (!nsSlug) {
    // Try to get from route if not provided
    try {
      nsSlug = useRoute().params.namespace as string;
    } catch {}
  }
  return atraceRequestWithRefresh(async () => {
    await atraceClient.request(MARK_DAY_LEGITIMATE, { userId, date, reason });
    return true;
  }, nsSlug!);
}
