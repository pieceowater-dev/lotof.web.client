import { hubClient, setGlobalAuthToken } from '@/api/clients';
import type { Namespace } from '@/api/hub/namespaces/get';

const NAMESPACE_AND_MEMBERS_QUERY = /* GraphQL */ `
  query NamespaceAndMembers($slug: String!, $filter: MembersFilter) {
    namespaces(filter: { search: $slug, pagination: { page: 1, length: TEN } }) {
      rows {
        id
        title
        slug
        description
        owner
      }
    }
    members(filter: $filter) {
      id
      userId
      username
      email
    }
  }
`;

export type RouteDataResponse = {
  namespace: Namespace | null;
  members: Array<{ id: string; userId: string; username: string; email: string }>;
};

export async function hubGetNamespaceAndMembers(
  token: string,
  slug: string,
  page: number = 1,
  length: 'TEN' | 'TWENTY_FIVE' | 'FIFTY' | 'HUNDRED' = 'FIFTY'
): Promise<RouteDataResponse> {
  setGlobalAuthToken(token);
  
  // First get namespace to get its ID
  const firstCall = await hubClient.request<any>(
    `query NamespaceBySlug($slug: String!) {
      namespaces(filter: { search: $slug, pagination: { page: 1, length: TEN } }) {
        rows {
          id
          title
          slug
          description
          owner
        }
      }
    }`,
    { slug }
  );
  
  const rows = firstCall?.namespaces?.rows || [];
  const exact = rows.find((ns: Namespace) => ns.slug === slug);
  const namespace = exact || rows[0] || null;
  
  if (!namespace) {
    return { namespace: null, members: [] };
  }
  
  // Now get members with the namespace ID - combine in single query
  const data = await hubClient.request<any>(NAMESPACE_AND_MEMBERS_QUERY, { 
    slug,
    filter: {
      namespaceId: namespace.id,
      filter: {
        pagination: { page, length }
      }
    }
  });
  
  return {
    namespace,
    members: data.members || []
  };
}
