import { tasksClient } from '@/api/clients';
import { tasksRequestWithRefresh } from '@/api/tasks/tasksRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export type TasksStaffRoleValue = 'OWNER' | 'MANAGER' | 'ASSIGNEE' | 'VIEWER';

export interface TasksStaff {
  id: string;
  userId: string;
  role: TasksStaffRoleValue;
}

const StaffDocument = /* GraphQL */ `
  query Staff($filter: DefaultFilterInput) {
    staff(filter: $filter) {
      rows { id userId role }
      info { count }
    }
  }
`;

export async function tasksStaffList(tasksToken: string, namespaceSlug: string) {
  const devHeaders = await getDeviceHeaders();
  return tasksRequestWithRefresh(async () => {
    const res = await tasksClient.request<{ staff: { rows: TasksStaff[]; info: { count: number } } }>(
      StaffDocument,
      { filter: { pagination: { page: 1, length: 'ONE_HUNDRED' } } },
      { headers: { IssuesAuthorization: `Bearer ${tasksToken}`, Namespace: namespaceSlug, ...devHeaders } },
    );
    return { staff: res.staff.rows, count: res.staff.info.count };
  }, namespaceSlug);
}
