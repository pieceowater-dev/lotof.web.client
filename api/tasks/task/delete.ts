import { tasksClient } from '@/api/clients';
import { tasksRequestWithRefresh } from '@/api/tasks/tasksRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

const DeleteTaskDocument = /* GraphQL */ `
  mutation DeleteTask($id: ID!) {
    deleteTask(id: $id) { success }
  }
`;

export async function tasksDeleteTask(tasksToken: string, namespaceSlug: string, id: string) {
  const devHeaders = await getDeviceHeaders();
  return tasksRequestWithRefresh(async () => {
    const res = await tasksClient.request<{ deleteTask: { success: boolean } }>(
      DeleteTaskDocument,
      { id },
      { headers: { IssuesAuthorization: `Bearer ${tasksToken}`, Namespace: namespaceSlug, ...devHeaders } },
    );
    return res.deleteTask.success;
  }, namespaceSlug);
}
