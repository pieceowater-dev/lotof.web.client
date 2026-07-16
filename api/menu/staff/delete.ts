import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

const DeleteStaffDocument = /* GraphQL */ `
  mutation DeleteStaff($id: ID!) {
    deleteStaff(id: $id) { success }
  }
`;

export async function menuDeleteStaff(menuToken: string, namespaceSlug: string, id: string): Promise<boolean> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ deleteStaff: { success: boolean } }>(
      DeleteStaffDocument,
      { id },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.deleteStaff.success;
  }, namespaceSlug);
}
