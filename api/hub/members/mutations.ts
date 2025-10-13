import { hubClient, setGlobalAuthToken } from '@/api/clients';

const ADD_MEMBER_MUTATION = /* GraphQL */ `
  mutation AddMember($namespaceId: ID!, $userId: ID!) {
    addMemberToNamespace(input: { namespaceId: $namespaceId, userId: $userId }) {
      id
    }
  }
`;

const REMOVE_MEMBER_MUTATION = /* GraphQL */ `
  mutation RemoveMember($namespaceId: ID!, $userId: ID!) {
    removeMemberFromNamespace(input: { namespaceId: $namespaceId, userId: $userId }) {
      id
    }
  }
`;

export async function hubAddMember(token: string, namespaceId: string, userId: string) {
  setGlobalAuthToken(token);
  const data = await hubClient.request<any>(ADD_MEMBER_MUTATION as any, { namespaceId, userId });
  return data?.addMemberToNamespace?.id as string | undefined;
}

export async function hubRemoveMember(token: string, namespaceId: string, userId: string) {
  setGlobalAuthToken(token);
  const data = await hubClient.request<any>(REMOVE_MEMBER_MUTATION as any, { namespaceId, userId });
  return data?.removeMemberFromNamespace?.id as string | undefined;
}
