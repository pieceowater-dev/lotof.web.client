import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

const DeleteOrderFieldDocument = /* GraphQL */ `
  mutation DeleteOrderField($id: ID!) {
    deleteOrderField(id: $id) { success }
  }
`;

export async function menuDeleteOrderField(menuToken: string, namespaceSlug: string, id: string): Promise<boolean> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ deleteOrderField: { success: boolean } }>(
      DeleteOrderFieldDocument,
      { id },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.deleteOrderField.success;
  }, namespaceSlug);
}
