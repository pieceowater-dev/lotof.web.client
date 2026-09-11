import { plansClient } from '@/api/clients';
import { CookieKeys } from '@/utils/storageKeys';

export type Plan = {
  id: string; code: string; name: string; description?: string | null; currency: string;
  interval: 'MONTH' | 'YEAR'; amountCents: number; trialDays: number; includedSeats: number;
  includedUnits: number; overagePriceCents: number; status: string; metadataJson?: string | null;
};
export type Subscription = {
  id: string; namespace: string; applicationCode: string; planId: string; planCode: string;
  status: string; startDate: string; endDate?: string; trialEndDate?: string;
};

const APP = 'pieceowater.plans';

function hubHeaders(ns: string, hubToken?: string | null): Record<string, string> {
  const h: Record<string, string> = { Namespace: ns };
  const tk = hubToken ?? useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value;
  if (tk) h.Authorization = `Bearer ${tk}`;
  return h;
}

export async function getPlansPlans(ns: string, includeArchived = false): Promise<{ plans: Plan[]; total: number }> {
  const doc = /* GraphQL */ `query($includeArchived:Boolean!){ getPlans(includeArchived:$includeArchived){ total plans { id code name description currency interval amountCents trialDays includedSeats includedUnits overagePriceCents status metadataJson } } }`;
  const res = await plansClient.request<{ getPlans: { plans: Plan[]; total: number } }>(doc, { includeArchived }, { headers: { Namespace: ns } });
  return res.getPlans;
}

// Object parameter, not positional args (FRONTEND_AUDIT.md D3) -- see the
// comment on tasksSubscribePlan in api/tasks/plans/subscribe.ts for why.
export async function subscribeToPlansPlan({
  nsSlug,
  planCode,
  hubToken,
}: {
  nsSlug: string;
  planCode: string;
  hubToken?: string | null;
}): Promise<Subscription> {
  const doc = /* GraphQL */ `mutation($planCode:String!,$appBundle:String!){ subscribePlan(planCode:$planCode,appBundle:$appBundle){ id namespace applicationCode planId planCode status startDate endDate trialEndDate } }`;
  const res = await plansClient.request<{ subscribePlan: Subscription }>(doc, { planCode, appBundle: APP }, { headers: hubHeaders(nsSlug, hubToken) });
  return res.subscribePlan;
}

export async function getActivePlansSubscription(ns: string, hubToken?: string | null): Promise<Subscription | null> {
  const doc = /* GraphQL */ `query($appBundle:String!){ getActiveSubscription(appBundle:$appBundle){ id namespace applicationCode planId planCode status startDate endDate trialEndDate } }`;
  try {
    const res = await plansClient.request<{ getActiveSubscription: Subscription | null }>(doc, { appBundle: APP }, { headers: hubHeaders(ns, hubToken) });
    return res.getActiveSubscription;
  } catch {
    return null;
  }
}
