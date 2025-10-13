import { hubClient, setGlobalAuthToken } from '@/api/clients';
import { FriendshipStatus } from '@gql-hub';

const SEARCH_ACCEPTED_FRIENDS = /* GraphQL */ `
  query SearchAcceptedFriends($search: String, $page: Int, $length: FilterPaginationLengthEnum) {
    myFriends(
      filter: {
        status: ACCEPTED
        data: { search: $search, pagination: { page: $page, length: $length } }
      }
    ) {
      rows { id status friend { id username email } }
      info { count }
    }
  }
`;

export interface FriendRow { id: string; status: FriendshipStatus; friend: { id: string; username: string; email: string } }

export async function hubSearchAcceptedFriends(token: string, search: string, page: number, length: number = 25) {
  setGlobalAuthToken(token);
  const vars: any = { search: search || undefined, page, length: lengthToEnum(length) };
  const data = await hubClient.request<any>(SEARCH_ACCEPTED_FRIENDS as any, vars);
  const rows = (data?.myFriends?.rows || []) as FriendRow[];
  const count = data?.myFriends?.info?.count ?? 0;
  return { rows, count };
}

function lengthToEnum(length: number) {
  switch (length) {
    case 10: return 'TEN';
    case 15: return 'FIFTEEN';
    case 20: return 'TWENTY';
    case 25: return 'TWENTY_FIVE';
    case 30: return 'THIRTY';
    case 35: return 'THIRTY_FIVE';
    case 40: return 'FORTY';
    case 45: return 'FORTY_FIVE';
    case 50: return 'FIFTY';
    default: return 'TWENTY_FIVE';
  }
}
