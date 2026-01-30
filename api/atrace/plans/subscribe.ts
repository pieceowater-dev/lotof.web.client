import { atraceClient } from '@/api/clients';
import { CookieKeys } from '@/utils/storageKeys';

const SubscribePlanDocument = /* GraphQL */ `
  mutation SubscribePlan($planCode: String!, $appBundle: String!) {
    subscribePlan(planCode: $planCode, appBundle: $appBundle) {
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

export type Subscription = {
  id: string;
  namespace: string;
  applicationCode: string;
  planId: string;
  planCode: string;
  status: string;
  startDate: string;
  endDate?: string;
  trialEndDate?: string;
};

export async function subscribeToPlan(
  namespaceSlug: string,
  planCode: string,
  appBundle: string = 'pieceowater.atrace',
  hubToken?: string | null
): Promise<Subscription> {
  const resolvedHubToken = hubToken ?? useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value;
  const headers: Record<string, string> = {
    Namespace: namespaceSlug,
  };
  if (resolvedHubToken) {
    headers.Authorization = `Bearer ${resolvedHubToken}`;
  }

  const res = await atraceClient.request<{
    subscribePlan: Subscription
  }>(SubscribePlanDocument, { planCode, appBundle }, {
    headers,
  });

  return res.subscribePlan;
}
