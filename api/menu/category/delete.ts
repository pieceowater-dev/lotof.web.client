import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

const DeleteCategoryDocument = /* GraphQL */ `
  mutation DeleteCategory($id: ID!) {
    deleteCategory(id: $id) { success }
  }
`;

export async function menuDeleteCategory(menuToken: string, namespaceSlug: string, id: string): Promise<boolean> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ deleteCategory: { success: boolean } }>(
      DeleteCategoryDocument,
      { id },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.deleteCategory.success;
  }, namespaceSlug);
}
