import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

const DeleteBranchDocument = /* GraphQL */ `
  mutation DeleteBranch($id: ID!) {
    deleteBranch(id: $id) { success }
  }
`;

export async function menuDeleteBranch(menuToken: string, namespaceSlug: string, id: string): Promise<boolean> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ deleteBranch: { success: boolean } }>(
      DeleteBranchDocument,
      { id },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.deleteBranch.success;
  }, namespaceSlug);
}
