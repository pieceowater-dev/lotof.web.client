import { atraceClient } from '@/api/clients';

const GetPlansDocument = /* GraphQL */ `
  query GetPlans($includeArchived: Boolean!) {
    getPlans(includeArchived: $includeArchived) {
      total
      plans {
        id
        code
        name
        description
        currency
        interval
        amountCents
        trialDays
        includedSeats
        includedUnits
        overagePriceCents
        status
        metadataJson
      }
    }
  }
`;

export type Plan = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  currency: string;
  interval: 'MONTH' | 'YEAR';
  amountCents: number;
  trialDays: number;
  includedSeats: number;
  includedUnits: number;
  overagePriceCents: number;
  status: string;
  metadataJson?: string | null;
};

export async function getPlans(
  namespaceSlug: string,
  includeArchived: boolean = false
): Promise<{ plans: Plan[]; total: number }> {
  const res = await atraceClient.request<{
    getPlans: { plans: Plan[]; total: number }
  }>(GetPlansDocument, { includeArchived }, {
    headers: {
      Namespace: namespaceSlug,
    }
  });
  return { plans: res.getPlans.plans, total: res.getPlans.total };
}
