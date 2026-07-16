import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { MenuCategory } from '@/api/menu/category/list';

export type CreateCategoryInput = {
  parentId?: string;
  name: string;
  sortOrder?: number;
  availableFrom?: string;
  availableTo?: string;
  availableDays?: string;
};

const CreateCategoryDocument = /* GraphQL */ `
  mutation CreateCategory($input: CreateCategoryInput!) {
    createCategory(input: $input) {
      id parentId name sortOrder isActive availableFrom availableTo availableDays
    }
  }
`;

export async function menuCreateCategory(menuToken: string, namespaceSlug: string, input: CreateCategoryInput): Promise<MenuCategory> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ createCategory: MenuCategory }>(
      CreateCategoryDocument,
      { input },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.createCategory;
  }, namespaceSlug);
}
