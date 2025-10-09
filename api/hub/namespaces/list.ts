import { hubClient, setGlobalAuthToken } from '@/api/clients';
import { NamespacesDocument, type NamespacesQuery, type NamespacesQueryVariables, FilterPaginationLengthEnum } from '@/api/__generated__/hub-types';

export async function hubNamespacesList(token: string, search?: string, page = 1, length: FilterPaginationLengthEnum = FilterPaginationLengthEnum.TwentyFive) {
  const variables: NamespacesQueryVariables = {
    filter: {
      search: search ?? undefined,
      pagination: { page, length },
    },
  };

  setGlobalAuthToken(token);
  const data = await hubClient.request<NamespacesQuery>(NamespacesDocument, variables);
  return data.namespaces;
}
