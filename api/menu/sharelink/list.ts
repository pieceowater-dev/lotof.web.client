import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export type MenuShareLink = {
  id: string;
  branchId?: string | null;
  label: string;
  sourceTag: string;
  createdAt: string;
};

const ShareLinksDocument = /* GraphQL */ `
  query ShareLinks {
    shareLinks {
      rows { id branchId label sourceTag createdAt }
    }
  }
`;

export async function menuShareLinksList(menuToken: string, namespaceSlug: string): Promise<MenuShareLink[]> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ shareLinks: { rows: MenuShareLink[] } }>(
      ShareLinksDocument,
      {},
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.shareLinks.rows;
  }, namespaceSlug);
}
