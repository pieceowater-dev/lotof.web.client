import { hubClient, setGlobalAuthToken } from '@/api/clients';
import type { FilterPaginationLengthEnum } from '@/api/__generated__/hub-types';

const BOOTSTRAP_QUERY = /* GraphQL */ `
  query Bootstrap($filter: DefaultFilterInput) {
    me {
      id
      username
      email
    }
    namespaces(filter: $filter) {
      rows {
        id
        title
        slug
        description
        owner
      }
      info {
        count
      }
    }
  }
`;

export type BootstrapResponse = {
  me: { id: string; username: string; email: string } | null;
  namespaces: {
    rows: Array<{ id: string; title: string; slug: string; description?: string | null; owner: string }>;
    info?: { count?: number | null } | null;
  } | null;
};

export async function hubBootstrap(
  token: string,
  search?: string,
  page = 1,
  length: FilterPaginationLengthEnum = 'TWENTY_FIVE' as FilterPaginationLengthEnum
): Promise<BootstrapResponse> {
  const variables = {
    filter: {
      search: search ?? undefined,
      pagination: { page, length },
    },
  };

  setGlobalAuthToken(token);
  return hubClient.request<BootstrapResponse>(BOOTSTRAP_QUERY, variables);
}
