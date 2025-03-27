import { gql } from "graphql-request";
import { hubClient } from "../clients";
import { hubMe } from "./me";

type UpdateMeResponse = {
  id: string;
  email: string;
  username: string;
};

export async function hubUpdateMe(token: string, username: string): Promise<UpdateMeResponse> {
  console.log("updateMe called");
  console.log("token", token);
  console.log("username", username);

  hubClient.setAuthToken(token); // Set the token

  // Fetch current user ID
  const currentUser = await hubMe(token);
  const userId = currentUser.id;

  const mutation = gql`
    mutation MutateMe($id: ID!, $username: String!) {
      updateUser(
        id: $id,
        input: {
          username: $username
        }
      ) {
        id
        email
        username
      }
    }
  `;

  try {
    const data = await hubClient.request<{ updateUser: UpdateMeResponse }>(mutation, { id: userId, username });
    return data.updateUser;
  } catch (error) {
    console.error("GraphQL mutation failed:", error);
    throw error;
  }
}
