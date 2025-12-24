import { hubClient, setGlobalAuthToken } from '@/api/clients';

const CREATE_INVITE_MUTATION = /* GraphQL */ `
  mutation CreateInvite($input: CreateInviteInput!) {
    createInvite(input: $input) {
      id
      email
      expiresAt
    }
  }
`;

export type CreateInviteInput = {
  namespaceSlug: string;
  email: string;
  actions: string; // JSON string per server contract
  expiresAt?: number; // unix seconds
};

export async function hubCreateInvite(token: string, input: CreateInviteInput) {
  setGlobalAuthToken(token);
  const res = await hubClient.request<{ createInvite: { id: string; email: string; expiresAt: number } }>(
    CREATE_INVITE_MUTATION,
    { input }
  );
  return res.createInvite;
}
