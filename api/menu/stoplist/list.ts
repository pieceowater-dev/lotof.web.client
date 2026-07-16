import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export type StopListEntry = {
  id: string;
  branchId: string;
  menuItemId: string;
  createdAt: string;
};

const StopListDocument = /* GraphQL */ `
  query StopList($branchId: String) {
    stopList(branchId: $branchId) {
      rows { id branchId menuItemId createdAt }
    }
  }
`;

export async function menuStopList(menuToken: string, namespaceSlug: string, branchId?: string): Promise<StopListEntry[]> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ stopList: { rows: StopListEntry[] } }>(
      StopListDocument,
      { branchId: branchId || undefined },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.stopList.rows;
  }, namespaceSlug);
}
