import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { MenuStaff, StaffRole } from '@/api/menu/staff/list';

const CreateStaffDocument = /* GraphQL */ `
  mutation CreateStaff($input: CreateStaffInput!) {
    createStaff(input: $input) { id userId role }
  }
`;

export async function menuCreateStaff(menuToken: string, namespaceSlug: string, userId: string, role: StaffRole): Promise<MenuStaff> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ createStaff: MenuStaff }>(
      CreateStaffDocument,
      { input: { userId, role } },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.createStaff;
  }, namespaceSlug);
}
