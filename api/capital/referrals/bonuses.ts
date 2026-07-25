import { capitalClient, setGlobalAuthToken } from '@/api/clients';

export type ReferralBonusGrant = {
  id: string;
  referredNamespaceId: string;
  applicationCode: string;
  planCode: string;
  monthsGranted: number;
  grantedAt: string;
  status: 'applied' | 'banked' | string;
  expiresAt?: string | null;
  appliedAt?: string | null;
};

const MY_REFERRAL_BONUSES_QUERY = /* GraphQL */ `
  query MyReferralBonuses($namespace: String!) {
    myReferralBonuses(namespace: $namespace) {
      id
      referredNamespaceId
      applicationCode
      planCode
      monthsGranted
      grantedAt
      status
      expiresAt
      appliedAt
    }
  }
`;

export async function capitalMyReferralBonuses(token: string, namespace: string): Promise<ReferralBonusGrant[]> {
  setGlobalAuthToken(token);
  const data = await capitalClient.request<{ myReferralBonuses: ReferralBonusGrant[] }>(
    MY_REFERRAL_BONUSES_QUERY as any,
    { namespace }
  );
  return data.myReferralBonuses;
}
