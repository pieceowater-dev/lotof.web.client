import { goodsClient } from '@/api/clients';
import { goodsRequestWithRefresh } from '@/api/goods/goodsRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export interface GoodsPlanLimits {
  limitsJson: string;
  planCode: string;
  planName: string;
  subscriptionStatus: string;
  trialEndsAt?: string | null;
  currentPeriodEnd: string;
  isSubscriptionActive: boolean;
}

const GetGoodsPlanLimitsDocument = /* GraphQL */ `
  query GetGoodsPlanLimits($appBundle: String!) {
    getPlanLimits(appBundle: $appBundle) {
      limitsJson
      planCode
      planName
      subscriptionStatus
      trialEndsAt
      currentPeriodEnd
      isSubscriptionActive
    }
  }
`;

export async function getGoodsPlanLimits(goodsToken: string, namespaceSlug: string): Promise<GoodsPlanLimits | null> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ getPlanLimits: GoodsPlanLimits | null }>(
      GetGoodsPlanLimitsDocument,
      { appBundle: 'pieceowater.goods' },
      { headers: { GoodsAuthorization: `Bearer ${goodsToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.getPlanLimits;
  }, namespaceSlug);
}
