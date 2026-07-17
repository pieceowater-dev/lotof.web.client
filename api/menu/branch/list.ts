import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export type MenuBranch = {
  id: string;
  name: string;
  address: string;
  phone?: string | null;
  lat?: number | null;
  lng?: number | null;
  workingHours: string;
  isActive: boolean;
  city?: string | null;
  isPrimary: boolean;
  slug: string;
};

const BranchesDocument = /* GraphQL */ `
  query Branches($filter: DefaultFilterInput) {
    branches(filter: $filter) {
      rows {
        id name address phone lat lng workingHours isActive city isPrimary slug
      }
      info { count }
    }
  }
`;

export async function menuBranchesList(menuToken: string, namespaceSlug: string): Promise<{ branches: MenuBranch[]; count: number }> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ branches: { rows: MenuBranch[]; info: { count: number } } }>(
      BranchesDocument,
      { filter: { pagination: { page: 1, length: 'ONE_HUNDRED' } } },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return { branches: res.branches.rows, count: res.branches.info.count };
  }, namespaceSlug);
}
