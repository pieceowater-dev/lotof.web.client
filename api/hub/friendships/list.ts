import { hubClient, setGlobalAuthToken } from '../../clients';
import { MyFriendsDocument, type MyFriendsQuery, FriendshipStatus } from '@gql-hub';

export async function hubFriendshipsList(
  token: string,
  status: FriendshipStatus // retained for forward compatibility
): Promise<MyFriendsQuery['myFriends']> {
  setGlobalAuthToken(token);

  const data = await hubClient.request<MyFriendsQuery>(MyFriendsDocument);
  // TODO: when backend supports filtering by status argument, re-enable passing variable.
  return data.myFriends;
}