import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

const DeleteModifierOptionDocument = /* GraphQL */ `
  mutation DeleteModifierOption($id: ID!) {
    deleteModifierOption(id: $id) { success }
  }
`;

export async function menuDeleteModifierOption(menuToken: string, namespaceSlug: string, id: string): Promise<boolean> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ deleteModifierOption: { success: boolean } }>(
      DeleteModifierOptionDocument,
      { id },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.deleteModifierOption.success;
  }, namespaceSlug);
}
