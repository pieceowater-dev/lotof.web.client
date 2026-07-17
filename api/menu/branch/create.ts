import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { MenuBranch } from '@/api/menu/branch/list';

export type CreateBranchInput = {
  name: string;
  address: string;
  phone?: string;
  lat?: number;
  lng?: number;
  workingHours?: string;
  city?: string;
  isPrimary?: boolean;
  slug?: string;
};

const CreateBranchDocument = /* GraphQL */ `
  mutation CreateBranch($input: CreateBranchInput!) {
    createBranch(input: $input) {
      id name address phone lat lng workingHours isActive city isPrimary slug
    }
  }
`;

export async function menuCreateBranch(menuToken: string, namespaceSlug: string, input: CreateBranchInput): Promise<MenuBranch> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ createBranch: MenuBranch }>(
      CreateBranchDocument,
      { input },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.createBranch;
  }, namespaceSlug);
}
