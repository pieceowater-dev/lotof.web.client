import { hubClient, setGlobalAuthToken } from '@/api/clients';

type Friendship = { id: string; status: string; friend: { id: string; username: string; email: string } };

const CREATE_FRIENDSHIP = /* GraphQL */ `
  mutation CreateFriendship($friendId: ID!) {
    createFriendship(friendId: $friendId) { id status friend { id username email } }
  }
`;

const ACCEPT_FRIENDSHIP = /* GraphQL */ `
  mutation AcceptFriendship($friendshipId: ID!) {
    acceptFriendshipRequest(friendshipId: $friendshipId) { id status friend { id username email } }
  }
`;

const REMOVE_FRIENDSHIP = /* GraphQL */ `
  mutation RemoveFriendship($friendshipId: ID!) {
    removeFriendship(friendshipId: $friendshipId)
  }
`;

export async function hubCreateFriendship(token: string, friendId: string) {
  setGlobalAuthToken(token);
  const data = await hubClient.request<{ createFriendship: Friendship }>(CREATE_FRIENDSHIP, { friendId });
  return data.createFriendship;
}

export async function hubAcceptFriendship(token: string, friendshipId: string) {
  setGlobalAuthToken(token);
  const data = await hubClient.request<{ acceptFriendshipRequest: Friendship }>(ACCEPT_FRIENDSHIP, { friendshipId });
  return data.acceptFriendshipRequest;
}

export async function hubRemoveFriendship(token: string, friendshipId: string) {
  setGlobalAuthToken(token);
  const data = await hubClient.request<{ removeFriendship: boolean }>(REMOVE_FRIENDSHIP, { friendshipId });
  return data.removeFriendship;
}
