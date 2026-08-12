import { hubClient, setGlobalAuthToken } from '@/api/clients';
import { FilterPaginationLengthEnum } from '@/api/__generated__/hub-types';


const MEMBERS_QUERY = /* GraphQL */ `
  query Members($filter: MembersFilter) {
    members(filter: $filter) {
      id
      userId
      username
      email
      nickname
    }
  }
`;

export type HubMember = { id: string; userId: string; username: string; email: string; nickname?: string | null };

export async function hubMembersList(
  token: string,
  namespaceId?: string,
  page: number = 1,
  length: FilterPaginationLengthEnum = FilterPaginationLengthEnum.Ten
): Promise<HubMember[]> {
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
  return data.members as HubMember[];
}

const SET_MEMBER_NICKNAME_MUTATION = /* GraphQL */ `
  mutation SetMemberNickname($input: SetMemberNicknameInput!) {
    setMemberNickname(input: $input) {
      id
      userId
      username
      email
      nickname
    }
  }
`;

// Empty nickname clears the override back to the account's own username.
export async function hubSetMemberNickname(
  token: string,
  namespaceId: string,
  userId: string,
  nickname: string
): Promise<HubMember> {
  setGlobalAuthToken(token);
  const data = await hubClient.request<{ setMemberNickname: HubMember }>(
    SET_MEMBER_NICKNAME_MUTATION as any,
    { input: { namespaceId, userId, nickname } }
  );
  return data.setMemberNickname;
}
