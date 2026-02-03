import { atraceClient } from '@/api/clients';
import { getDeviceHeaders } from '@/utils/device';

// GraphQL document kept inline to avoid codegen coupling
const AtraceRecordsByPostDocument = /* GraphQL */ `
  query AtraceRecordsByPost($filter: GetByPostIdInput!) {
    getRecordByPostId(filter: $filter) {
      records { id postId userId username email timestamp method suspicious timezone localDate }
      paginationInfo { count }
    }
  }
`;

export type AtraceRecord = {
  id: string;
  postId: string;
  userId: string;
  username: string;
  email: string;
  timestamp: number; // unix seconds
  method: string;    // GraphQL enum string
  suspicious: boolean;
  timezone?: string;
  localDate?: string;
};

export type AtraceRecordsByPostParams = {
  postId: string;
  page?: number;
  // Map to DefaultFilterPaginationInput.length
  length?:
    | 'TEN'
    | 'FIFTEEN'
    | 'TWENTY'
    | 'TWENTY_FIVE'
    | 'THIRTY'
    | 'THIRTY_FIVE'
    | 'FORTY'
    | 'FORTY_FIVE'
    | 'FIFTY'
    | 'FIFTY_FIVE'
    | 'SIXTY'
    | 'SIXTY_FIVE'
    | 'SEVENTY'
    | 'SEVENTY_FIVE'
    | 'EIGHTY'
    | 'EIGHTY_FIVE'
    | 'NINETY'
    | 'NINETY_FIVE'
    | 'ONE_HUNDRED';
  sort?: { field?: string; by?: 'ASC' | 'DESC'; nullsFirst?: boolean };
};

export async function atraceRecordsByPost(
  atraceToken: string,
  namespaceSlug: string,
  params: AtraceRecordsByPostParams,
): Promise<{ records: AtraceRecord[]; count: number }>
{
  const filter: any = {
    postId: params.postId,
    pagination: {
      page: params.page ?? 1,
      length: params.length ?? 'TEN',
    },
    sort: {
      field: params.sort?.field ?? 'timestamp',
      by: params.sort?.by ?? 'DESC',
      nullsFirst: params.sort?.nullsFirst ?? false,
    },
  };

  const devHeaders = await getDeviceHeaders();
  const res = await atraceClient.request<{
    getRecordByPostId: { records: AtraceRecord[]; paginationInfo: { count: number } }
  }>(AtraceRecordsByPostDocument, { filter }, {
    headers: {
      AtraceAuthorization: `Bearer ${atraceToken}`,
      Namespace: namespaceSlug,
      ...devHeaders,
    }
  });

  return {
    records: res.getRecordByPostId.records,
    count: res.getRecordByPostId.paginationInfo.count,
  };
}
