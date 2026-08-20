import { goodsClient } from '@/api/clients';
import type { Subscription } from './subscribe';

const GetActiveSubscriptionDocument = /* GraphQL */ `
  query GetActiveGoodsSubscription($appBundle: String!) {
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

export async function getActiveGoodsSubscription(
  namespaceSlug: string,
  goodsToken: string,
  appBundle: string = 'pieceowater.goods'
): Promise<Subscription | null> {
  try {
    const res = await goodsClient.request<{
      getActiveSubscription: Subscription | null
    }>(GetActiveSubscriptionDocument, { appBundle }, {
      headers: {
        GoodsAuthorization: `Bearer ${goodsToken}`,
        Namespace: namespaceSlug,
      },
    });
    return res.getActiveSubscription;
  } catch (e) {
    console.error('Failed to get active goods subscription:', e);
    return null;
  }
}
