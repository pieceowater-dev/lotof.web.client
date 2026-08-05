import { tasksClient } from '@/api/clients';
import { tasksRequestWithRefresh } from '@/api/tasks/tasksRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export interface TaskPlanLimits {
  limitsJson: string;
  planCode: string;
  planName: string;
  subscriptionStatus:
    | 'SUBSCRIPTION_TRIALING'
    | 'SUBSCRIPTION_ACTIVE'
    | 'SUBSCRIPTION_PAST_DUE'
    | 'SUBSCRIPTION_CANCELED'
    | 'SUBSCRIPTION_EXPIRED'
    | 'SUBSCRIPTION_INCOMPLETE';
  trialEndsAt?: string | null;
  currentPeriodEnd?: string | null;
  isSubscriptionActive: boolean;
}

const PlanLimitsDocument = /* GraphQL */ `
  query IssuesPlanLimits {
    issuesPlanLimits {
      limitsJson planCode planName subscriptionStatus trialEndsAt currentPeriodEnd isSubscriptionActive
    }
  }
`;

export async function tasksPlanLimits(tasksToken: string, namespaceSlug: string) {
  const devHeaders = await getDeviceHeaders();
  return tasksRequestWithRefresh(async () => {
    const res = await tasksClient.request<{ issuesPlanLimits: TaskPlanLimits | null }>(
      PlanLimitsDocument,
      {},
      { headers: { IssuesAuthorization: `Bearer ${tasksToken}`, Namespace: namespaceSlug, ...devHeaders } },
    );
    return res.issuesPlanLimits;
  }, namespaceSlug);
}
