import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { MenuCategory } from '@/api/menu/category/list';

export type MenuItemPreset = {
  id: string;
  categoryId: string;
  name: string;
  price: number;
};

const ApplyCatalogPresetDocument = /* GraphQL */ `
  mutation ApplyCatalogPreset($businessType: String!, $locale: String!) {
    applyCatalogPreset(businessType: $businessType, locale: $locale) {
      categories { id parentId name sortOrder isActive availableFrom availableTo availableDays }
      items { id categoryId name price }
    }
  }
`;

export async function menuApplyCatalogPreset(
  menuToken: string,
  namespaceSlug: string,
  businessType: string,
  locale: string
): Promise<{ categories: MenuCategory[]; items: MenuItemPreset[] }> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ applyCatalogPreset: { categories: MenuCategory[]; items: MenuItemPreset[] } }>(
      ApplyCatalogPresetDocument,
      { businessType, locale },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.applyCatalogPreset;
  }, namespaceSlug);
}
