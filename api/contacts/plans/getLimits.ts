import { contactsClient } from '@/api/clients';
import { CookieKeys } from '@/utils/storageKeys';

export interface ContactsPlanLimits {
  limitsJson: string;
  planCode: string;
  planName: string;
  subscriptionStatus: string;
  trialEndsAt?: string | null;
  currentPeriodEnd: string;
  isSubscriptionActive: boolean;
}

const GetPlanLimitsDocument = /* GraphQL */ `
  query GetPlanLimits($appBundle: String!) {
    getPlanLimits(appBundle: $appBundle) {
      limitsJson
      planCode
      planName
      subscriptionStatus
      trialEndsAt
      currentPeriodEnd
      isSubscriptionActive
    }
  }
`;

export async function getContactsPlanLimits(
  namespaceSlug: string,
  appBundle: string = 'pieceowater.contacts',
  hubToken?: string | null
): Promise<ContactsPlanLimits | null> {
  const resolvedHubToken = hubToken ?? useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value;
  const headers: Record<string, string> = {
    Namespace: namespaceSlug,
  };

  if (resolvedHubToken) {
    headers.Authorization = `Bearer ${resolvedHubToken}`;
  }

  try {
    const res = await contactsClient.request<{
      getPlanLimits: ContactsPlanLimits | null
    }>(GetPlanLimitsDocument, { appBundle }, { headers });

    return res.getPlanLimits;
  } catch (error) {
    console.error('Failed to get contacts plan limits:', error);
    return null;
  }
}
