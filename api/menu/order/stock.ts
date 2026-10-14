import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export type MenuItemStock = { tracked: boolean; available: number };

const Doc = /* GraphQL */ `
  query MenuItemStock($menuItemId: ID!) {
    menuItemStock(menuItemId: $menuItemId) { tracked available }
  }
`;

// How many units of an item the warehouse can still supply (lota Goods recipe). Never throws:
// when Goods is absent or slow the answer is simply "not tracked".
export async function menuItemStock(menuToken: string, namespaceSlug: string, menuItemId: string): Promise<MenuItemStock> {
  try {
    const devHeaders = await getDeviceHeaders();
    return await menuRequestWithRefresh(async () => {
      const res = await menuClient.request<{ menuItemStock: MenuItemStock }>(
        Doc, { menuItemId }, { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } },
      );
      return res.menuItemStock;
    }, namespaceSlug);
  } catch {
    return { tracked: false, available: 0 };
  }
}
