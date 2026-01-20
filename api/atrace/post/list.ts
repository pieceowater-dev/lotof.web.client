import { atraceClient } from '@/api/clients';
import { atraceRequestWithRefresh } from '@/api/atrace/atraceRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

// Keep it schema-agnostic without relying on generated types (atrace optional)
const AtracePostsDocument = /* GraphQL */ `
  query AtracePosts($filter: DefaultFilterInput!) {
    getPosts(filter: $filter) {
      posts { id title description location { comment country city address latitude longitude timezone } }
      paginationInfo { count }
    }
  }
`;

export type AtracePost = {
  id: string;
  title: string;
  description?: string | null;
  location?: {
    comment?: string | null;
    country?: string | null;
    city?: string | null;
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    timezone?: string | null;
  } | null;
};

export async function atracePostsList(
  atraceToken: string,
  namespaceSlug: string,
  params: { search?: string; page?: number; length?: 'TEN' | 'TWENTY_FIVE' | 'FIFTY' | 'HUNDRED' } = {}
): Promise<{ posts: AtracePost[]; count: number }> {
  const filter: any = {
    pagination: { page: params.page ?? 1, length: params.length ?? 'TWENTY_FIVE' },
    sort: { by: 'ASC', field: 'title' }
  };
  if (params.search) filter.search = params.search;

  const devHeaders = await getDeviceHeaders();
  return atraceRequestWithRefresh(async () => {
    const res = await atraceClient.request<{
      getPosts: { posts: AtracePost[]; paginationInfo: { count: number } }
    }>(AtracePostsDocument, { filter }, {
      headers: {
        AtraceAuthorization: `Bearer ${atraceToken}`,
        Namespace: namespaceSlug,
        ...devHeaders,
      }
    });
    return { posts: res.getPosts.posts, count: res.getPosts.paginationInfo.count };
  }, namespaceSlug);
}
