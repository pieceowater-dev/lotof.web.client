import { hubClient, setGlobalAuthToken } from '@/api/clients';
import type { BusinessType } from '@/config/businessTypes';

const GET_QUERY = /* GraphQL */ `
  query NamespaceBusinessType($id: ID!) {
    namespace(id: $id) {
      id
      businessType
    }
  }
`;

const SET_MUTATION = /* GraphQL */ `
  mutation SetNamespaceBusinessType($namespaceId: ID!, $businessType: String!) {
    setNamespaceBusinessType(namespaceId: $namespaceId, businessType: $businessType) {
      id
      businessType
    }
  }
`;

export async function hubGetNamespaceBusinessType(token: string, namespaceId: string): Promise<BusinessType | null> {
  setGlobalAuthToken(token);
  const res = await hubClient.request<{ namespace: { businessType?: string | null } | null }>(GET_QUERY, { id: namespaceId });
  return (res.namespace?.businessType as BusinessType) || null;
}

export async function hubSetNamespaceBusinessType(token: string, namespaceId: string, businessType: BusinessType): Promise<void> {
  setGlobalAuthToken(token);
  await hubClient.request(SET_MUTATION, { namespaceId, businessType });
}
