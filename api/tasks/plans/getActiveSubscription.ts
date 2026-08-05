import { tasksClient } from '@/api/clients';
import { tasksRequestWithRefresh } from '@/api/tasks/tasksRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export interface TaskBillingSubscription {
  id: string;
  accountId: string;
  planId: string;
  status: string;
  startedAt?: string | null;
  endedAt?: string | null;
  trialEndsAt?: string | null;
}

const ActiveSubscriptionDocument = /* GraphQL */ `
  query IssuesActiveSubscription {
    issuesActiveSubscription {
      id accountId planId status startedAt endedAt trialEndsAt
    }
  }
`;

export async function tasksActiveSubscription(tasksToken: string, namespaceSlug: string) {
  const devHeaders = await getDeviceHeaders();
  return tasksRequestWithRefresh(async () => {
    const res = await tasksClient.request<{ issuesActiveSubscription: TaskBillingSubscription | null }>(
      ActiveSubscriptionDocument,
      {},
      { headers: { IssuesAuthorization: `Bearer ${tasksToken}`, Namespace: namespaceSlug, ...devHeaders } },
    );
    return res.issuesActiveSubscription;
  }, namespaceSlug);
}
