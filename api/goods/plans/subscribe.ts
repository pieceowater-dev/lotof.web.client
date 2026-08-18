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

export async function subscribeToGoodsPlan(
  namespaceSlug: string,
  planCode: string,
  goodsToken: string,
  appBundle: string = 'pieceowater.goods'
): Promise<Subscription> {
  const res = await goodsClient.request<{
    subscribePlan: Subscription
  }>(SubscribePlanDocument, { planCode, appBundle }, {
    headers: {
      GoodsAuthorization: `Bearer ${goodsToken}`,
      Namespace: namespaceSlug,
    },
  });

  return res.subscribePlan;
}
