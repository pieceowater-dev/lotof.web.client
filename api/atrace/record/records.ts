import { atraceClient, setAtraceAppToken } from '@/api/clients';
import { atraceGetAppToken } from '@/api/atrace/auth/getAppToken';
import { CookieKeys } from '@/utils/storageKeys';
import { useAuth } from '@/composables/useAuth';
import { resolveAtraceNsSlug } from '@/api/atrace/atraceRequestWithRefresh';

export type AtraceRecord = {
  id: string;
  postId: string;
  userId: string;
  username?: string;
  email?: string;
  timestamp: number;
  method: string;
  suspicious: boolean;
  geoConfirmed?: boolean;
  timezone?: string;
  localDate?: string;
};

export type PaginatedRecordList = {
  records: AtraceRecord[];
  paginationInfo: { count: number };
};

const GET_RECORD_BY_POST_ID = `
  query GetRecordByPostId($postId: ID!, $userId: ID, $page: Int, $length: FilterPaginationLengthEnum, $sortField: String, $sortBy: FilterSortByEnum) {
    getRecordByPostId(
      filter: {
        postId: $postId
        userId: $userId
        pagination: { page: $page, length: $length }
        sort: { field: $sortField, by: $sortBy }
      }
    ) {
      records {
        id
        postId
        userId
        username
        email
        timestamp
        method
        suspicious
        geoConfirmed
        timezone
        localDate
      }
      paginationInfo { count }
    }
  }
`;

// getRecords (unlike getRecordByPostId) isn't scoped to one location -- it's
// permission-aware server-side: a caller without tracker.record.view is
// force-narrowed to their own records regardless of what search is passed,
// and a caller *with* it gets exactly what search asks for -- so always
// passing search=<own userId> here is what makes this safely return "my
// records" for a manager/owner too, not the whole namespace's.
const GET_RECORDS = `
  query GetRecords($search: String, $page: Int, $length: FilterPaginationLengthEnum, $sortField: String, $sortBy: FilterSortByEnum) {
    getRecords(
      filter: {
        search: $search
        pagination: { page: $page, length: $length }
        sort: { field: $sortField, by: $sortBy }
      }
    ) {
      records {
        id
        postId
        userId
        username
        email
        timestamp
        method
        suspicious
        geoConfirmed
        timezone
        localDate
      }
      paginationInfo { count }
    }
  }
`;

// Helper: robust atraceClient request with auto-refresh on unauthorized
async function atraceRequestWithRefresh<T>(fn: () => Promise<T>, nsSlug: string): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isUnauthorized = error?.response?.errors?.some((e: any) =>
      typeof e.message === 'string' && e.message.includes('AtraceAuthorization token is invalid')
    );
    if (isUnauthorized) {
      try { useCookie(CookieKeys.ATRACE_TOKEN).value = null as any; } catch {}
      setAtraceAppToken(null);
      const { token } = useAuth();
      const hubToken = token.value;
      if (!hubToken) throw error;
      const newToken = await atraceGetAppToken(hubToken, nsSlug);
      if (newToken) {
        useCookie(CookieKeys.ATRACE_TOKEN, { path: '/' }).value = newToken;
        setAtraceAppToken(newToken);
        return await fn();
      }
    }
    throw error;
  }
}

export async function atraceGetRecordsByPostId(
  postId: string,
  options?: {
    userId?: string;
    page?: number;
    length?: 'TEN' | 'FIFTEEN' | 'TWENTY' | 'TWENTY_FIVE' | 'THIRTY' | 'THIRTY_FIVE' | 'FORTY' | 'FORTY_FIVE' | 'FIFTY' | 'FIFTY_FIVE' | 'SIXTY' | 'SIXTY_FIVE' | 'SEVENTY' | 'SEVENTY_FIVE' | 'EIGHTY' | 'EIGHTY_FIVE' | 'NINETY' | 'NINETY_FIVE' | 'ONE_HUNDRED';
    sortField?: string;
    sortBy?: 'ASC' | 'DESC';
    nsSlug?: string;
  }
): Promise<PaginatedRecordList> {
  const nsSlug = resolveAtraceNsSlug(options?.nsSlug);
  const userId = options?.userId ?? null;
  const page = options?.page ?? 1;
  const length = options?.length ?? 'TEN';
  const sortField = options?.sortField ?? 'timestamp';
  const sortBy = options?.sortBy ?? 'DESC';

  return atraceRequestWithRefresh(async () => {
    const response = await atraceClient.request<{ getRecordByPostId: PaginatedRecordList }>(
      GET_RECORD_BY_POST_ID,
      { postId, userId, page, length, sortField, sortBy },
      {
        headers: {
          Namespace: nsSlug || '',
        }
      }
    );
    return response.getRecordByPostId;
  }, nsSlug);
}

export async function atraceGetMyRecords(
  userId: string,
  options?: {
    page?: number;
    length?: 'TEN' | 'FIFTEEN' | 'TWENTY' | 'TWENTY_FIVE' | 'THIRTY' | 'THIRTY_FIVE' | 'FORTY' | 'FORTY_FIVE' | 'FIFTY' | 'FIFTY_FIVE' | 'SIXTY' | 'SIXTY_FIVE' | 'SEVENTY' | 'SEVENTY_FIVE' | 'EIGHTY' | 'EIGHTY_FIVE' | 'NINETY' | 'NINETY_FIVE' | 'ONE_HUNDRED';
    sortField?: string;
    sortBy?: 'ASC' | 'DESC';
    nsSlug?: string;
  }
): Promise<PaginatedRecordList> {
  const nsSlug = resolveAtraceNsSlug(options?.nsSlug);
  const page = options?.page ?? 1;
  const length = options?.length ?? 'FIFTY';
  const sortField = options?.sortField ?? 'timestamp';
  const sortBy = options?.sortBy ?? 'DESC';

  return atraceRequestWithRefresh(async () => {
    const response = await atraceClient.request<{ getRecords: PaginatedRecordList }>(
      GET_RECORDS,
      { search: userId, page, length, sortField, sortBy },
      {
        headers: {
          Namespace: nsSlug || '',
        }
      }
    );
    return response.getRecords;
  }, nsSlug);
}
