import { hubClient, setGlobalAuthToken } from '@/api/clients';

export type HubReferral = {
  id: string;
  title: string;
  slug: string;
  createdAt?: string | null;
};

const MY_REFERRALS_QUERY = /* GraphQL */ `
  query MyReferrals($namespaceId: ID!) {
    myReferrals(namespaceId: $namespaceId) {
      id
      title
      slug
      createdAt
    }
  }
`;

export async function hubMyReferrals(token: string, namespaceId: string): Promise<HubReferral[]> {
  setGlobalAuthToken(token);
  const data = await hubClient.request<{ myReferrals: HubReferral[] }>(MY_REFERRALS_QUERY as any, { namespaceId });
  return data.myReferrals;
}
