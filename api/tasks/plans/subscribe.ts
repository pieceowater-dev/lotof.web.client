import { tasksClient } from '@/api/clients';
import { tasksRequestWithRefresh } from '@/api/tasks/tasksRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { TaskBillingSubscription } from '@/api/tasks/plans/getActiveSubscription';

const SubscribePlanDocument = /* GraphQL */ `
  mutation IssuesSubscribePlan($planCode: String!) {
    issuesSubscribePlan(planCode: $planCode) {
      id accountId planId status startedAt endedAt trialEndsAt
    }
  }
`;

export async function tasksSubscribePlan(tasksToken: string, namespaceSlug: string, planCode: string) {
  const devHeaders = await getDeviceHeaders();
  return tasksRequestWithRefresh(async () => {
    const res = await tasksClient.request<{ issuesSubscribePlan: TaskBillingSubscription }>(
      SubscribePlanDocument,
      { planCode },
      { headers: { IssuesAuthorization: `Bearer ${tasksToken}`, Namespace: namespaceSlug, ...devHeaders } },
    );
    return res.issuesSubscribePlan;
  }, namespaceSlug);
}
