import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

const DeletePromoBannerDocument = /* GraphQL */ `
  mutation DeletePromoBanner($id: ID!) {
    deletePromoBanner(id: $id) { success }
  }
`;

export async function menuDeletePromoBanner(menuToken: string, namespaceSlug: string, id: string): Promise<boolean> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ deletePromoBanner: { success: boolean } }>(
      DeletePromoBannerDocument,
      { id },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.deletePromoBanner.success;
  }, namespaceSlug);
}
