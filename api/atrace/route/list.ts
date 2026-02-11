import { atraceClient } from '@/api/clients';
import { atraceRequestWithRefresh } from '@/api/atrace/atraceRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

const GET_ROUTES = /* GraphQL */ `
  query GetRoutes($filter: DefaultFilterInput!) {
    getRoutes(filter: $filter) {
      routes {
        id
        title
        milestones { postId priority }
      }
      paginationInfo { count }
    }
  }
`;

export type RouteMilestone = {
  postId: string;
  priority: number;
};

export type Route = {
  id: string;
  title: string;
  milestones: RouteMilestone[];
};

export async function atraceGetRoutes(
  atraceToken: string,
  namespaceSlug: string,
  params: { search?: string; page?: number; length?: 'TEN' | 'TWENTY_FIVE' | 'FIFTY' | 'ONE_HUNDRED' } = {}
): Promise<{ routes: Route[]; count: number }> {
  const filter: any = {
    pagination: { page: params.page ?? 1, length: params.length ?? 'ONE_HUNDRED' },
    sort: { by: 'ASC', field: 'title' }
  };
  if (params.search) filter.search = params.search;

  const devHeaders = await getDeviceHeaders();
  return atraceRequestWithRefresh(async () => {
    const res = await atraceClient.request<{
      getRoutes: { routes: Route[]; paginationInfo: { count: number } }
    }>(GET_ROUTES, { filter }, {
      headers: {
        AtraceAuthorization: `Bearer ${atraceToken}`,
        Namespace: namespaceSlug,
        ...devHeaders,
      }
    });
    return { routes: res.getRoutes.routes, count: res.getRoutes.paginationInfo.count };
  }, namespaceSlug);
}
