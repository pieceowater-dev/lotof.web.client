import { hubClient, setGlobalAuthToken } from '@/api/clients';
import { BootstrapDocument, type BootstrapQuery, type FilterPaginationLengthEnum } from '@gql-hub';

// D2/D4: was an inline query string + a hand-maintained BootstrapResponse
// type (see deeplinks.ts/admin.ts for the same conversion, done first --
// full rationale there). This is the hottest path of the three converted so
// far: hubBootstrap runs on every hub page load, not just in the admin
// console, so the live schema check below mattered more here than usual.
export type BootstrapResponse = BootstrapQuery;

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
  return hubClient.request<BootstrapQuery>(BootstrapDocument, variables);
}
