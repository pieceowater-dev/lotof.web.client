import { gql } from "graphql-request";
import { hubClient } from "../../clients";

type Friend = {
  id: string;
  username: string;
  email: string;
};

type FriendshipsListResponse = {
  rows: {
    id: string;
    userId: string;
    status: string;
    friend: Friend;
  }[];
  info: {
    count: number;
  };
};

type FriendshipStatus = "ACCEPTED" | "PENDING" | "REJECTED";

export async function hubFriendshipsList(
  token: string,
  status: FriendshipStatus
): Promise<FriendshipsListResponse> {
  hubClient.setAuthToken(token);

  const query = gql`
    query MyFriends($status: FriendshipStatus!) {
      myFriends(status: $status) {
        rows {
          friend {
            id
            username
            email
          }
        }
        info {
          count
        }
      }
    }
  `;

  try {
    const data = await hubClient.request<{ myFriends: FriendshipsListResponse }>(query, { status });
    return data.myFriends;
  } catch (error) {
    console.error("GraphQL request failed:", error);
    throw error;
  }
}