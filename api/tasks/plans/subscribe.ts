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

// Object parameter, not positional args (FRONTEND_AUDIT.md D3): the same
// "subscribe to a plan" operation across menu/atrace/goods/tasks/plans had
// four different positional argument orders -- goods in particular had
// `token` and `appBundle` swapped relative to atrace/menu, and since both
// are `string`, TypeScript can't catch a mixed-up call. Each function keeps
// its own real parameter set (they genuinely send different auth headers to
// different backends -- see the comments in each file) rather than forcing
// a single shared shape that would misrepresent what's actually sent.
export async function tasksSubscribePlan({
  tasksToken,
  nsSlug,
  planCode,
}: {
  tasksToken: string;
  nsSlug: string;
  planCode: string;
}) {
  const devHeaders = await getDeviceHeaders();
  return tasksRequestWithRefresh(async () => {
    const res = await tasksClient.request<{ issuesSubscribePlan: TaskBillingSubscription }>(
      SubscribePlanDocument,
      { planCode },
      { headers: { IssuesAuthorization: `Bearer ${tasksToken}`, Namespace: nsSlug, ...devHeaders } },
    );
    return res.issuesSubscribePlan;
  }, nsSlug);
}
