import { atraceClient } from '@/api/clients';
import { CookieKeys } from '@/utils/storageKeys';
import type { Subscription } from './subscribe';

const GetActiveSubscriptionDocument = /* GraphQL */ `
  query GetActiveSubscription($appBundle: String!) {
    getActiveSubscription(appBundle: $appBundle) {
      id
      namespace
      applicationCode
      planId
      planCode
      status
      startDate
      endDate
      trialEndDate
    }
  }
`;

export async function getActiveSubscription(
  namespaceSlug: string,
  appBundle: string = 'pieceowater.atrace',
  hubToken?: string | null
): Promise<Subscription | null> {
  const resolvedHubToken = hubToken ?? useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value;
  const headers: Record<string, string> = {
    Namespace: namespaceSlug,
  };
  if (resolvedHubToken) {
    headers.Authorization = `Bearer ${resolvedHubToken}`;
  }

  try {
    const res = await atraceClient.request<{
      getActiveSubscription: Subscription | null
    }>(GetActiveSubscriptionDocument, { appBundle }, {
      headers,
    });

    return res.getActiveSubscription;
  } catch (error) {
    // If no active subscription, return null instead of throwing
    console.warn('No active subscription found:', error);
    return null;
  }
}
