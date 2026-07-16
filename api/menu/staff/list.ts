import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export type StaffRole = 'OWNER' | 'MANAGER' | 'COOK' | 'OPERATOR' | 'COURIER';

export type MenuStaff = {
  id: string;
  userId: string;
  role: StaffRole;
};

const StaffListDocument = /* GraphQL */ `
  query StaffList($filter: DefaultFilterInput) {
    staffList(filter: $filter) {
      rows { id userId role }
      info { count }
    }
  }
`;

export async function menuStaffList(menuToken: string, namespaceSlug: string): Promise<{ staff: MenuStaff[]; count: number }> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ staffList: { rows: MenuStaff[]; info: { count: number } } }>(
      StaffListDocument,
      { filter: { pagination: { page: 1, length: 'ONE_HUNDRED' } } },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return { staff: res.staffList.rows, count: res.staffList.info.count };
  }, namespaceSlug);
}
