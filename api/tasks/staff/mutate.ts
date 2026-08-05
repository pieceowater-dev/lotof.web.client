import { tasksClient } from '@/api/clients';
import { tasksRequestWithRefresh } from '@/api/tasks/tasksRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { TasksStaff, TasksStaffRoleValue } from '@/api/tasks/staff/list';

const CreateStaffDocument = /* GraphQL */ `
  mutation CreateStaff($input: CreateStaffInput!) { createStaff(input: $input) { id userId role } }
`;
const UpdateStaffRoleDocument = /* GraphQL */ `
  mutation UpdateStaffRole($input: UpdateStaffRoleInput!) { updateStaffRole(input: $input) { id userId role } }
`;
const DeleteStaffDocument = /* GraphQL */ `
  mutation DeleteStaff($id: ID!) { deleteStaff(id: $id) { success } }
`;

export async function tasksCreateStaff(
  tasksToken: string, namespaceSlug: string,
  input: { userId: string; role: TasksStaffRoleValue },
) {
  const devHeaders = await getDeviceHeaders();
  return tasksRequestWithRefresh(async () => {
    const res = await tasksClient.request<{ createStaff: TasksStaff }>(
      CreateStaffDocument, { input },
      { headers: { IssuesAuthorization: `Bearer ${tasksToken}`, Namespace: namespaceSlug, ...devHeaders } },
    );
    return res.createStaff;
  }, namespaceSlug);
}

export async function tasksUpdateStaffRole(
  tasksToken: string, namespaceSlug: string,
  input: { id: string; role: TasksStaffRoleValue },
) {
  const devHeaders = await getDeviceHeaders();
  return tasksRequestWithRefresh(async () => {
    const res = await tasksClient.request<{ updateStaffRole: TasksStaff }>(
      UpdateStaffRoleDocument, { input },
      { headers: { IssuesAuthorization: `Bearer ${tasksToken}`, Namespace: namespaceSlug, ...devHeaders } },
    );
    return res.updateStaffRole;
  }, namespaceSlug);
}

export async function tasksDeleteStaff(tasksToken: string, namespaceSlug: string, id: string) {
  const devHeaders = await getDeviceHeaders();
  return tasksRequestWithRefresh(async () => {
    const res = await tasksClient.request<{ deleteStaff: { success: boolean } }>(
      DeleteStaffDocument, { id },
      { headers: { IssuesAuthorization: `Bearer ${tasksToken}`, Namespace: namespaceSlug, ...devHeaders } },
    );
    return res.deleteStaff.success;
  }, namespaceSlug);
}
