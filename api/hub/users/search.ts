import { hubClient, setGlobalAuthToken } from '@/api/clients';

type UsersResp = {
  users: {
    rows: Array<{ id: string; email: string; username: string }>;
    info: { count: number };
  };
};

const USERS_BY_EMAIL = /* GraphQL */ `
  query UsersByEmail($search: String!) {
    users(filter: { search: $search, pagination: { page: 1, length: TEN } }) {
      rows { id email username }
      info { count }
    }
  }
`;

export async function hubFindUserByEmail(token: string, email: string) {
  setGlobalAuthToken(token);
  const data = await hubClient.request<UsersResp>(USERS_BY_EMAIL, { search: email });
  // Prefer exact email match if present
  const exact = data.users.rows.find(r => r.email.toLowerCase() === email.toLowerCase());
  return exact || data.users.rows[0] || null;
}
