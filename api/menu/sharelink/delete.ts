import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

const DeleteShareLinkDocument = /* GraphQL */ `
  mutation DeleteShareLink($id: ID!) {
    deleteShareLink(id: $id) { success }
  }
`;

export async function menuDeleteShareLink(menuToken: string, namespaceSlug: string, id: string): Promise<boolean> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ deleteShareLink: { success: boolean } }>(
      DeleteShareLinkDocument,
      { id },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.deleteShareLink.success;
  }, namespaceSlug);
}
