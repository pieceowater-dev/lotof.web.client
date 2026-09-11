import { goodsClient } from '@/api/clients';

const SubscribePlanDocument = /* GraphQL */ `
  mutation SubscribeGoodsPlan($planCode: String!, $appBundle: String!) {
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

// Object parameter, not positional args (FRONTEND_AUDIT.md D3): this one in
// particular used to have `goodsToken` and `appBundle` in the opposite
// order from atrace's/menu's equivalent (token before bundle here, bundle
// before token there) -- both are plain `string`, so a call written by
// pattern-matching one of those would silently send the bundle name as the
// token and vice versa. Named fields make that impossible.
export async function subscribeToGoodsPlan({
  nsSlug,
  planCode,
  goodsToken,
  appBundle = 'pieceowater.goods',
}: {
  nsSlug: string;
  planCode: string;
  goodsToken: string;
  appBundle?: string;
}): Promise<Subscription> {
  const res = await goodsClient.request<{
    subscribePlan: Subscription
  }>(SubscribePlanDocument, { planCode, appBundle }, {
    headers: {
      GoodsAuthorization: `Bearer ${goodsToken}`,
      Namespace: nsSlug,
    },
  });

  return res.subscribePlan;
}
