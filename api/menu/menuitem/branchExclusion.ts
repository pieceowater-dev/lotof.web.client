import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

const AddItemBranchExclusionDocument = /* GraphQL */ `
  mutation AddItemBranchExclusion($input: AddItemBranchExclusionInput!) {
    addItemBranchExclusion(input: $input) { success }
  }
`;

const RemoveItemBranchExclusionDocument = /* GraphQL */ `
  mutation RemoveItemBranchExclusion($input: RemoveItemBranchExclusionInput!) {
    removeItemBranchExclusion(input: $input) { success }
  }
`;

export async function menuAddItemBranchExclusion(menuToken: string, namespaceSlug: string, menuItemId: string, branchId: string): Promise<boolean> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ addItemBranchExclusion: { success: boolean } }>(
      AddItemBranchExclusionDocument,
      { input: { menuItemId, branchId } },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.addItemBranchExclusion.success;
  }, namespaceSlug);
}

export async function menuRemoveItemBranchExclusion(menuToken: string, namespaceSlug: string, menuItemId: string, branchId: string): Promise<boolean> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ removeItemBranchExclusion: { success: boolean } }>(
      RemoveItemBranchExclusionDocument,
      { input: { menuItemId, branchId } },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.removeItemBranchExclusion.success;
  }, namespaceSlug);
}
