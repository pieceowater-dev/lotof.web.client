import { hubClient, setGlobalAuthToken } from '../../clients';
import { type MyFriendsQuery, FriendshipStatus } from '@gql-hub';

// Inline query to ensure we pass the filter and variables regardless of stale codegen
const MY_FRIENDS_QUERY = /* GraphQL */ `
  query MyFriends($status: FriendshipStatus) {
    myFriends(filter: { status: $status }) {
      rows {
        id
        status
        friend { id username email }
      }
      info { count }
    }
  }
`;

export async function hubFriendshipsList(
  token: string,
  status: FriendshipStatus // retained for forward compatibility
): Promise<MyFriendsQuery['myFriends']> {
  setGlobalAuthToken(token);

  const variables: any = { status };
  if (process.client) {
    // eslint-disable-next-line no-console
    console.debug('[hubFriendshipsList] sending status', status);
  }
  const data = await hubClient.request<MyFriendsQuery>(MY_FRIENDS_QUERY as any, variables);
  // TODO: when backend supports filtering by status argument, re-enable passing variable.
  return data.myFriends;
}