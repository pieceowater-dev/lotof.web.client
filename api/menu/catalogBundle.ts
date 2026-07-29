import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { MenuItem } from '@/api/menu/menuitem/list';
import type { MenuCategory } from '@/api/menu/category/list';
import type { MenuBadge } from '@/api/menu/badge/list';

// Combines menuItems + categories + badges into one request — the tenant's
// whole catalog, fetched together every time the create-order modal or the
// order detail modal (for its "add item"/quick-create UI) opens. Both used
// to fire 2-3 separate requests for this; now it's 1. A caller that only
// needs items+categories (CreateOrderModal) just ignores the badges field.
const CatalogBundleDocument = /* GraphQL */ `
  query CatalogBundle {
    menuItems(filter: { pagination: { page: 1, length: ONE_HUNDRED } }) {
      rows { id categoryId name description price imageUrl isActive sortOrder imageAlt seoTitle seoDescription badgeIds excludedBranchIds modifierGroupIds }
    }
    categories(filter: { pagination: { page: 1, length: ONE_HUNDRED } }) {
      rows { id parentId name sortOrder isActive availableFrom availableTo availableDays }
    }
    badges(filter: { pagination: { page: 1, length: ONE_HUNDRED } }) {
      rows { id text bgColor textColor icon }
    }
  }
`;

export type CatalogBundle = {
  items: MenuItem[];
  categories: MenuCategory[];
  badges: MenuBadge[];
};

export async function menuCatalogBundle(menuToken: string, namespaceSlug: string): Promise<CatalogBundle> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{
      menuItems: { rows: MenuItem[] };
      categories: { rows: MenuCategory[] };
      badges: { rows: MenuBadge[] };
    }>(
      CatalogBundleDocument,
      {},
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return { items: res.menuItems.rows, categories: res.categories.rows, badges: res.badges.rows };
  }, namespaceSlug);
}
