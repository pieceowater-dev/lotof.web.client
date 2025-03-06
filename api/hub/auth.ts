import { gql } from "graphql-request";
import { hubClient } from "../clients";

export async function hubLogin(email: string, password: string) {
  const mutation = gql`
    mutation Auth($input: LoginRequest!) {
      login(input: $input) {
        user {
          id
          username
        }
        token
      }
    }
  `;
  return hubClient.request(mutation, { input: { email, password } });
}
