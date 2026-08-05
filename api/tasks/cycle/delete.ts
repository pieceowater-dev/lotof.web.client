import { tasksClient } from '@/api/clients';
import { tasksRequestWithRefresh } from '@/api/tasks/tasksRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

const DeleteCycleDocument = /* GraphQL */ `
  mutation DeleteCycle($id: ID!) {
    deleteCycle(id: $id) { success }
  }
`;

export async function tasksDeleteCycle(tasksToken: string, namespaceSlug: string, id: string) {
  const devHeaders = await getDeviceHeaders();
  return tasksRequestWithRefresh(async () => {
    const res = await tasksClient.request<{ deleteCycle: { success: boolean } }>(
      DeleteCycleDocument,
      { id },
      { headers: { IssuesAuthorization: `Bearer ${tasksToken}`, Namespace: namespaceSlug, ...devHeaders } },
    );
    return res.deleteCycle.success;
  }, namespaceSlug);
}
