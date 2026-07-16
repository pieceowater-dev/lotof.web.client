import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { StopListEntry } from '@/api/menu/stoplist/list';

const AddToStopListDocument = /* GraphQL */ `
  mutation AddToStopList($input: AddToStopListInput!) {
    addToStopList(input: $input) { id branchId menuItemId createdAt }
  }
`;

const RemoveFromStopListDocument = /* GraphQL */ `
  mutation RemoveFromStopList($id: ID!) {
    removeFromStopList(id: $id) { success }
  }
`;

export async function menuAddToStopList(menuToken: string, namespaceSlug: string, branchId: string, menuItemId: string): Promise<StopListEntry> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ addToStopList: StopListEntry }>(
      AddToStopListDocument,
      { input: { branchId, menuItemId } },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.addToStopList;
  }, namespaceSlug);
}

export async function menuRemoveFromStopList(menuToken: string, namespaceSlug: string, id: string): Promise<boolean> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ removeFromStopList: { success: boolean } }>(
      RemoveFromStopListDocument,
      { id },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.removeFromStopList.success;
  }, namespaceSlug);
}
