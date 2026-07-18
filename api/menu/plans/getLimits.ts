import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export interface MenuPlanLimits {
  limitsJson: string;
  planCode: string;
  planName: string;
  subscriptionStatus: string;
  trialEndsAt?: string | null;
  currentPeriodEnd: string;
  isSubscriptionActive: boolean;
}

const GetMenuPlanLimitsDocument = /* GraphQL */ `
  query GetMenuPlanLimits($appBundle: String!) {
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

export async function getMenuPlanLimits(menuToken: string, namespaceSlug: string): Promise<MenuPlanLimits | null> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ getPlanLimits: MenuPlanLimits | null }>(
      GetMenuPlanLimitsDocument,
      { appBundle: 'pieceowater.menu' },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.getPlanLimits;
  }, namespaceSlug);
}
