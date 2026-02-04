import { hubClient, setGlobalAuthToken } from '@/api/clients';
import { FriendshipStatus } from '@gql-hub';
import type { FilterPaginationLengthEnum } from '@/api/__generated__/hub-types';

// Combined bootstrap query for people page to reduce duplicate requests
const PEOPLE_BOOTSTRAP_QUERY = /* GraphQL */ `
  query PeopleBootstrap(
    $namespacesFilter: DefaultFilterInput
    $friendsStatus: FriendshipStatus
    $membersFilter: MembersFilter
    $friendSearchSearch: String
    $friendSearchPage: Int
    $friendSearchLength: FilterPaginationLengthEnum
  ) {
    namespaces(filter: $namespacesFilter) {
      rows { id title slug description owner }
      info { count }
    }
    myFriends(filter: { status: $friendsStatus }) {
      rows {
        id
        status
        friend { id username email }
      }
      info { count }
    }
    members(filter: $membersFilter) {
      id
      userId
      username
      email
    }
    friendsForDropdown: myFriends(
      filter: {
        status: ACCEPTED
        data: { search: $friendSearchSearch, pagination: { page: $friendSearchPage, length: $friendSearchLength } }
      }
    ) {
      rows { id status friend { id username email } }
      info { count }
    }
  }
`;

export interface PeopleBootstrapResult {
  namespaces: {
    rows: Array<{ id: string; title: string; slug: string; description: string; owner: string }>;
    info: { count: number };
  };
  myFriends: {
    rows: Array<{
      id: string;
      status: FriendshipStatus;
      friend: { id: string; username: string; email: string };
    }>;
    info: { count: number };
  };
  members: Array<{ id: string; userId: string; username: string; email: string }>;
  friendsForDropdown: {
    rows: Array<{
      id: string;
      status: FriendshipStatus;
      friend: { id: string; username: string; email: string };
    }>;
    info: { count: number };
  };
}

export async function hubPeopleBootstrap(
  token: string,
  selectedNamespaceId?: string
): Promise<PeopleBootstrapResult> {
  setGlobalAuthToken(token);
  
  const variables = {
    namespacesFilter: {
      pagination: { page: 1, length: 'TEN' as FilterPaginationLengthEnum }
    },
    friendsStatus: FriendshipStatus.Accepted,
    membersFilter: {
      namespaceId: selectedNamespaceId,
      filter: {
        pagination: { page: 1, length: 'TEN' as FilterPaginationLengthEnum }
      }
    },
    friendSearchSearch: undefined,
    friendSearchPage: 1,
    friendSearchLength: 'TWENTY_FIVE' as FilterPaginationLengthEnum
  };

  const data = await hubClient.request<PeopleBootstrapResult>(
    PEOPLE_BOOTSTRAP_QUERY as any,
    variables
  );

  return data;
}
