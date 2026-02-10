import { atraceClient } from '@/api/clients';
import { getDeviceHeaders } from '@/utils/device';

export type SubscriptionStatus = 
  | 'SUBSCRIPTION_TRIALING'
  | 'SUBSCRIPTION_ACTIVE'
  | 'SUBSCRIPTION_PAST_DUE'
  | 'SUBSCRIPTION_EXPIRED'
  | 'SUBSCRIPTION_CANCELED'
  | 'SUBSCRIPTION_INCOMPLETE';

export type PlanLimits = {
  limitsJson: string;
  planCode: string;
  planName: string;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt?: string | null;
  currentPeriodEnd: string;
  isSubscriptionActive: boolean;
};

const GET_PLAN_LIMITS = /* GraphQL */ `
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

/**
 * Fetch plan limits and subscription status for the given app bundle.
 * This query requires hub authentication (hubAuth directive).
 */
export async function atraceGetPlanLimits(
  atraceToken: string,
  hubToken: string,
  appBundle: string,
  namespaceSlug: string
): Promise<PlanLimits> {
  const devHeaders = await getDeviceHeaders();
  const res = await atraceClient.request<{ getPlanLimits: PlanLimits }>(
    GET_PLAN_LIMITS,
    { appBundle },
    {
      headers: {
        Namespace: namespaceSlug,
        AtraceAuthorization: `Bearer ${atraceToken}`,
        Authorization: `Bearer ${hubToken}`,
        ...devHeaders,
      },
    },
  );
  return res.getPlanLimits;
}

export type BillingSubscription = {
  id: string;
  namespace: string;
  applicationCode: string;
  planId: string;
  planCode: string;
  status: string;
  startDate: string;
  endDate?: string | null;
  trialEndDate?: string | null;
};

const GET_ACTIVE_SUBSCRIPTION = /* GraphQL */ `
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

/**
 * Fetch the active subscription for the given app bundle.
 * This query requires hub authentication (hubAuth directive).
 */
export async function atraceGetActiveSubscription(
  atraceToken: string,
  hubToken: string,
  appBundle: string,
  namespaceSlug: string
): Promise<BillingSubscription | null> {
  const devHeaders = await getDeviceHeaders();
  try {
    const res = await atraceClient.request<{ getActiveSubscription: BillingSubscription | null }>(
      GET_ACTIVE_SUBSCRIPTION,
      { appBundle },
      {
        headers: {
          Namespace: namespaceSlug,
          AtraceAuthorization: `Bearer ${atraceToken}`,
          Authorization: `Bearer ${hubToken}`,
          ...devHeaders,
        },
      },
    );
    return res.getActiveSubscription || null;
  } catch {
    return null;
  }
}
