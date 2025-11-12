import { atraceClient, setAtraceAppToken } from '@/api/clients';
import { atraceGetAppToken } from '@/api/atrace/auth/getAppToken';
import { CookieKeys } from '@/utils/storageKeys';
import { useAuth } from '@/composables/useAuth';

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
  query GetAllUsersStats($startDate: String!, $endDate: String!) {
    getAllUsersStats(input: { startDate: $startDate, endDate: $endDate }) {
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

const GET_USERS_BY_IDS = `
  query GetUsersByIDs($ids: [ID!]!) {
    getUsersByIDs(ids: $ids) {
      id
      username
      email
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
    }>(GET_ALL_USERS_STATS, { startDate, endDate });

    return response.getAllUsersStats;
  }, nsSlug!);
}
