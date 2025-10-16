import { atraceClient } from '@/api/clients';

// Keep it schema-agnostic without relying on generated types (atrace optional)
const AtracePostsDocument = /* GraphQL */ `
  query AtracePosts($filter: DefaultFilterInput!) {
    getPosts(filter: $filter) {
      posts { id title description location { comment country city address latitude longitude } }
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
  } | null;
};

export async function atracePostsList(
  atraceToken: string,
  namespaceSlug: string,
  params: { search?: string; page?: number; length?: 'TEN' | 'TWENTY_FIVE' | 'FIFTY' | 'HUNDRED' } = {}
): Promise<{ posts: AtracePost[]; count: number }>
{
  const filter: any = { pagination: { page: params.page ?? 1, length: params.length ?? 'TWENTY_FIVE' } };
  if (params.search) filter.search = params.search;

  const res = await atraceClient.request<{
    getPosts: { posts: AtracePost[]; paginationInfo: { count: number } }
  }>(AtracePostsDocument, { filter }, {
    headers: {
      AtraceAuthorization: `Bearer ${atraceToken}`,
      Namespace: namespaceSlug,
    }
  });
  return { posts: res.getPosts.posts, count: res.getPosts.paginationInfo.count };
}
