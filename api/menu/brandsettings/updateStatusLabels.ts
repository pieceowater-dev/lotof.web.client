import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { MenuBrandSettings } from '@/api/menu/brandsettings/get';

const UpdateOrderStatusLabelsDocument = /* GraphQL */ `
  mutation UpdateOrderStatusLabels($labels: String!) {
    updateOrderStatusLabels(labels: $labels) {
      id name logoUrl primaryColor secondaryColor welcomeMessage currencyCode socialLinks logoAlt seoTitle seoDescription autoAcceptOrders showcaseViewOnly listedInCatalog statusLabels
    }
  }
`;

// Replaces the business's own status names (JSON, see utils/orderStatusLabels).
// A separate mutation so renaming never goes through the brand form's full save.
export async function menuUpdateOrderStatusLabels(menuToken: string, namespaceSlug: string, labelsJson: string): Promise<MenuBrandSettings> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ updateOrderStatusLabels: MenuBrandSettings }>(
      UpdateOrderStatusLabelsDocument,
      { labels: labelsJson },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.updateOrderStatusLabels;
  }, namespaceSlug);
}
