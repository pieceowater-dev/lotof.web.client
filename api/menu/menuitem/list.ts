import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export type MenuItem = {
  id: string;
  categoryId: string;
  name: string;
  description?: string | null;
  price: number;
  imageUrl?: string | null;
  isActive: boolean;
  sortOrder: number;
  imageAlt?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  badgeIds: string[];
  excludedBranchIds: string[];
};

const MenuItemsDocument = /* GraphQL */ `
  query MenuItems($categoryId: String, $filter: DefaultFilterInput) {
    menuItems(categoryId: $categoryId, filter: $filter) {
      rows { id categoryId name description price imageUrl isActive sortOrder imageAlt seoTitle seoDescription badgeIds excludedBranchIds }
      info { count }
    }
  }
`;

export async function menuMenuItemsList(menuToken: string, namespaceSlug: string, categoryId?: string): Promise<{ items: MenuItem[]; count: number }> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ menuItems: { rows: MenuItem[]; info: { count: number } } }>(
      MenuItemsDocument,
      { categoryId, filter: { pagination: { page: 1, length: 'ONE_HUNDRED' } } },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return { items: res.menuItems.rows, count: res.menuItems.info.count };
  }, namespaceSlug);
}
