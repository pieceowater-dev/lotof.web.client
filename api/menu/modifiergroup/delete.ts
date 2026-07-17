import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

const DeleteModifierGroupDocument = /* GraphQL */ `
  mutation DeleteModifierGroup($id: ID!) {
    deleteModifierGroup(id: $id) { success }
  }
`;

export async function menuDeleteModifierGroup(menuToken: string, namespaceSlug: string, id: string): Promise<boolean> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ deleteModifierGroup: { success: boolean } }>(
      DeleteModifierGroupDocument,
      { id },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.deleteModifierGroup.success;
  }, namespaceSlug);
}
