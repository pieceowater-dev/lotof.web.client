import { tasksClient } from '@/api/clients';
import { tasksRequestWithRefresh } from '@/api/tasks/tasksRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

const DeleteTaskTypeDocument = /* GraphQL */ `
  mutation DeleteTaskType($id: ID!) {
    deleteTaskType(id: $id) { success }
  }
`;

export async function tasksDeleteTaskType(tasksToken: string, namespaceSlug: string, id: string) {
  const devHeaders = await getDeviceHeaders();
  return tasksRequestWithRefresh(async () => {
    const res = await tasksClient.request<{ deleteTaskType: { success: boolean } }>(
      DeleteTaskTypeDocument,
      { id },
      { headers: { IssuesAuthorization: `Bearer ${tasksToken}`, Namespace: namespaceSlug, ...devHeaders } },
    );
    return res.deleteTaskType.success;
  }, namespaceSlug);
}
