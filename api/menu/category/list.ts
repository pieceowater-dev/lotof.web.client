import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export type MenuCategory = {
  id: string;
  parentId?: string | null;
  name: string;
  sortOrder: number;
  isActive: boolean;
  availableFrom?: string | null;
  availableTo?: string | null;
  availableDays?: string | null;
};

const CategoriesDocument = /* GraphQL */ `
  query Categories($filter: DefaultFilterInput) {
    categories(filter: $filter) {
      rows { id parentId name sortOrder isActive availableFrom availableTo availableDays }
      info { count }
    }
  }
`;

export async function menuCategoriesList(menuToken: string, namespaceSlug: string): Promise<{ categories: MenuCategory[]; count: number }> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ categories: { rows: MenuCategory[]; info: { count: number } } }>(
      CategoriesDocument,
      { filter: { pagination: { page: 1, length: 'ONE_HUNDRED' } } },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return { categories: res.categories.rows, count: res.categories.info.count };
  }, namespaceSlug);
}
