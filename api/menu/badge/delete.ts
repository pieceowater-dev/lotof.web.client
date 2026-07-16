import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

const DeleteBadgeDocument = /* GraphQL */ `
  mutation DeleteBadge($id: ID!) {
    deleteBadge(id: $id) { success }
  }
`;

export async function menuDeleteBadge(menuToken: string, namespaceSlug: string, id: string): Promise<boolean> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ deleteBadge: { success: boolean } }>(
      DeleteBadgeDocument,
      { id },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.deleteBadge.success;
  }, namespaceSlug);
}
