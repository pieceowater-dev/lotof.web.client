import { hubClient, setGlobalAuthToken } from '@/api/clients';


const MEMBERS_QUERY = /* GraphQL */ `
  query Members($filter: MembersFilter) {
    members(filter: $filter) {
      id
      userId
      username
      email
    }
  }
`;


export async function hubMembersList(
  token: string,
  namespaceId?: string,
  page: number = 1,
  length: 'TEN' | 'TWENTY_FIVE' | 'FIFTY' | 'HUNDRED' = 'TEN'
): Promise<Array<{ id: string; userId: string; username: string; email: string }>> {
  setGlobalAuthToken(token);
  const filter = {
    namespaceId,
    filter: {
      pagination: { page, length }
    }
  };
  const data = await hubClient.request<any>(
    MEMBERS_QUERY as any,
    { filter }
  );
  return data.members as Array<{ id: string; userId: string; username: string; email: string }>;
}
