import { hubClient, setGlobalAuthToken } from '@/api/clients';

type FindUserByEmailResp = {
  findUserByEmail: { id: string; email: string; username: string } | null;
};

const FIND_USER_BY_EMAIL = /* GraphQL */ `
  query FindUserByEmail($email: String!) {
    findUserByEmail(email: $email) { id email username }
  }
`;

export async function hubFindUserByEmail(token: string, email: string) {
  setGlobalAuthToken(token);
  const data = await hubClient.request<FindUserByEmailResp>(FIND_USER_BY_EMAIL, { email });
  return data.findUserByEmail || null;
}
