import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { MenuItem } from '@/api/menu/menuitem/list';

const MenuItemDocument = /* GraphQL */ `
  query MenuItem($id: ID!) {
    menuItem(id: $id) {
      id categoryId name description price imageUrl isActive sortOrder imageAlt seoTitle seoDescription badgeIds excludedBranchIds
    }
  }
`;

export async function menuGetMenuItem(menuToken: string, namespaceSlug: string, id: string): Promise<MenuItem | null> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ menuItem: MenuItem | null }>(
      MenuItemDocument,
      { id },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.menuItem;
  }, namespaceSlug);
}
