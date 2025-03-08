import { gql } from "graphql-request";
import { hubClient } from "../clients";

type MeResponse = {
  username: string;
  email: string;
};

export async function hubMe(token: string): Promise<MeResponse> {
  console.log("hubMe called");
  console.log("token", token);

  hubClient.setAuthToken(token); // Устанавливаем токен

  const query = gql`
    query Me {
      me {
        username
        email
      }
    }
  `;

  try {
    const data = await hubClient.request<{ me: MeResponse }>(query);
    return data.me;
  } catch (error) {
    console.error("GraphQL request failed:", error);
    throw error;
  }
}