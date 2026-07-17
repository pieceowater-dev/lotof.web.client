import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { MenuBranch } from '@/api/menu/branch/list';

export type UpdateBranchInput = {
  id: string;
  name?: string;
  address?: string;
  phone?: string;
  lat?: number;
  lng?: number;
  workingHours?: string;
  isActive?: boolean;
  city?: string;
  isPrimary?: boolean;
  slug?: string;
};

const UpdateBranchDocument = /* GraphQL */ `
  mutation UpdateBranch($input: UpdateBranchInput!) {
    updateBranch(input: $input) {
      id name address phone lat lng workingHours isActive city isPrimary slug
    }
  }
`;

export async function menuUpdateBranch(menuToken: string, namespaceSlug: string, input: UpdateBranchInput): Promise<MenuBranch> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ updateBranch: MenuBranch }>(
      UpdateBranchDocument,
      { input },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.updateBranch;
  }, namespaceSlug);
}
