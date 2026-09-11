import { hubClient, setGlobalAuthToken } from '@/api/clients';
import {
  FriendshipStatus,
  PeopleBootstrapDocument,
  type PeopleBootstrapQuery,
  type FilterPaginationLengthEnum,
} from '@gql-hub';

// D2/D4: was an inline query string + a hand-maintained PeopleBootstrapResult
// type (see deeplinks.ts/admin.ts/bootstrap.ts for the same conversion, done
// first -- full rationale there). Combined bootstrap query for the people
// page to reduce duplicate requests; the `friendsForDropdown: myFriends(...)`
// aliased field carries through to the generated type unchanged.
export type PeopleBootstrapResult = PeopleBootstrapQuery;

export async function hubPeopleBootstrap(
  token: string,
  selectedNamespaceId?: string
): Promise<PeopleBootstrapResult> {
  setGlobalAuthToken(token);

  const variables = {
    namespacesFilter: {
      pagination: { page: 1, length: 'ONE_HUNDRED' as FilterPaginationLengthEnum }
    },
    friendsStatus: FriendshipStatus.Accepted,
    membersFilter: {
      namespaceId: selectedNamespaceId,
      filter: {
        pagination: { page: 1, length: 'ONE_HUNDRED' as FilterPaginationLengthEnum }
      }
    },
    friendSearchSearch: undefined,
    friendSearchPage: 1,
    friendSearchLength: 'TWENTY_FIVE' as FilterPaginationLengthEnum
  };

  const data = await hubClient.request<PeopleBootstrapQuery>(PeopleBootstrapDocument, variables);

  return data;
}
