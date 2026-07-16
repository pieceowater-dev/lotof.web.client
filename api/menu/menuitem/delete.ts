import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

const DeleteMenuItemDocument = /* GraphQL */ `
  mutation DeleteMenuItem($id: ID!) {
    deleteMenuItem(id: $id) { success }
  }
`;

export async function menuDeleteMenuItem(menuToken: string, namespaceSlug: string, id: string): Promise<boolean> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ deleteMenuItem: { success: boolean } }>(
      DeleteMenuItemDocument,
      { id },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.deleteMenuItem.success;
  }, namespaceSlug);
}
