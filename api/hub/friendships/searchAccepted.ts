import { hubClient, setGlobalAuthToken } from '@/api/clients';
import { FriendshipStatus } from '@gql-hub';
import { PaginationLength } from '@/utils/constants';

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

function lengthToEnum(length: number): PaginationLength {
  switch (length) {
    case 10: return PaginationLength.TEN;
    case 15: return PaginationLength.FIFTEEN;
    case 20: return PaginationLength.TWENTY;
    case 25: return PaginationLength.TWENTY_FIVE;
    case 30: return PaginationLength.THIRTY;
    case 35: return PaginationLength.THIRTY_FIVE;
    case 40: return PaginationLength.FORTY;
    case 45: return PaginationLength.FORTY_FIVE;
    case 50: return PaginationLength.FIFTY;
    default: return PaginationLength.TWENTY_FIVE;
  }
}
