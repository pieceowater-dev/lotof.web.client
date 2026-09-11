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

// Object parameter, not positional args (FRONTEND_AUDIT.md D3) -- see the
// comment on tasksSubscribePlan for why.
export async function subscribeToPlan({
  nsSlug,
  planCode,
  appBundle = 'pieceowater.atrace',
  hubToken,
}: {
  nsSlug: string;
  planCode: string;
  appBundle?: string;
  hubToken?: string | null;
}): Promise<Subscription> {
  const resolvedHubToken = hubToken ?? useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value;
  const atraceToken = useCookie<string | null>(CookieKeys.ATRACE_TOKEN, { path: '/' }).value;
  const headers: Record<string, string> = {
    Namespace: nsSlug,
  };
  if (resolvedHubToken) {
    headers.Authorization = `Bearer ${resolvedHubToken}`;
  }
  if (atraceToken) {
    headers.AtraceAuthorization = `Bearer ${atraceToken}`;
  }

  const res = await atraceClient.request<{
    subscribePlan: Subscription
  }>(SubscribePlanDocument, { planCode, appBundle }, {
    headers,
  });

  return res.subscribePlan;
}
