import { hubClient, setGlobalAuthToken } from '@/api/clients';

const MEMBERS_QUERY = /* GraphQL */ `
  query Members($namespaceId: ID) {
    members(filter: { namespaceId: $namespaceId }) {
      id
      userId
    }
  }
`;

export async function hubMembersList(token: string, namespaceId?: string) {
  setGlobalAuthToken(token);
  const data = await hubClient.request<any>(MEMBERS_QUERY as any, { namespaceId });
  return data.members as Array<{ id: string; userId: string }>;
}
