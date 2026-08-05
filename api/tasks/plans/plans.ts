import { tasksClient } from '@/api/clients';
import { tasksRequestWithRefresh } from '@/api/tasks/tasksRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export interface TaskPlan {
  id: string;
  code: string;
  name: string;
  description: string;
  currency: string;
  interval: 'MONTH' | 'YEAR';
  amountCents: number;
  trialDays: number;
  includedSeats: number;
  includedUnits: number;
  overagePriceCents: number;
  status: 'PLAN_ACTIVE' | 'PLAN_ARCHIVED';
  metadataJson: string;
}

const PlansDocument = /* GraphQL */ `
  query IssuesPlans($includeArchived: Boolean) {
    issuesPlans(includeArchived: $includeArchived) {
      plans {
        id code name description currency interval amountCents trialDays
        includedSeats includedUnits overagePriceCents status metadataJson
      }
      total
    }
  }
`;

// issuesPlans is public — a namespace browsing plans hasn't necessarily
// installed the Issues app yet, so this call goes out without a tasks token.
export async function tasksPlansList(namespaceSlug: string, includeArchived = false) {
  const devHeaders = await getDeviceHeaders();
  return tasksRequestWithRefresh(async () => {
    const res = await tasksClient.request<{ issuesPlans: { plans: TaskPlan[]; total: number } }>(
      PlansDocument,
      { includeArchived },
      { headers: { Namespace: namespaceSlug, ...devHeaders } },
    );
    return { plans: res.issuesPlans.plans, total: res.issuesPlans.total };
  }, namespaceSlug);
}
