import { tasksClient } from '@/api/clients';
import { tasksRequestWithRefresh } from '@/api/tasks/tasksRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

const DeleteBoardDocument = /* GraphQL */ `
  mutation DeleteBoard($id: ID!) {
    deleteBoard(id: $id) { success }
  }
`;

export async function tasksDeleteBoard(tasksToken: string, namespaceSlug: string, id: string) {
  const devHeaders = await getDeviceHeaders();
  return tasksRequestWithRefresh(async () => {
    const res = await tasksClient.request<{ deleteBoard: { success: boolean } }>(
      DeleteBoardDocument,
      { id },
      { headers: { IssuesAuthorization: `Bearer ${tasksToken}`, Namespace: namespaceSlug, ...devHeaders } },
    );
    return res.deleteBoard.success;
  }, namespaceSlug);
}
