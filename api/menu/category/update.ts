import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { MenuCategory } from '@/api/menu/category/list';

export type UpdateCategoryInput = {
  id: string;
  parentId?: string;
  name?: string;
  sortOrder?: number;
  isActive?: boolean;
  availableFrom?: string;
  availableTo?: string;
  availableDays?: string;
};

const UpdateCategoryDocument = /* GraphQL */ `
  mutation UpdateCategory($input: UpdateCategoryInput!) {
    updateCategory(input: $input) {
      id parentId name sortOrder isActive availableFrom availableTo availableDays
    }
  }
`;

export async function menuUpdateCategory(menuToken: string, namespaceSlug: string, input: UpdateCategoryInput): Promise<MenuCategory> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ updateCategory: MenuCategory }>(
      UpdateCategoryDocument,
      { input },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.updateCategory;
  }, namespaceSlug);
}
