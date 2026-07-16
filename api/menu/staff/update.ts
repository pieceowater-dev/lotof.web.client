import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { MenuStaff, StaffRole } from '@/api/menu/staff/list';

const UpdateStaffRoleDocument = /* GraphQL */ `
  mutation UpdateStaffRole($input: UpdateStaffRoleInput!) {
    updateStaffRole(input: $input) { id userId role }
  }
`;

export async function menuUpdateStaffRole(menuToken: string, namespaceSlug: string, id: string, role: StaffRole): Promise<MenuStaff> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ updateStaffRole: MenuStaff }>(
      UpdateStaffRoleDocument,
      { input: { id, role } },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.updateStaffRole;
  }, namespaceSlug);
}
