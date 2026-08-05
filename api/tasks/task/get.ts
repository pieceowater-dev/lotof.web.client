import { tasksClient } from '@/api/clients';
import { tasksRequestWithRefresh } from '@/api/tasks/tasksRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { TaskItem } from '@/api/tasks/task/list';

const TaskDocument = /* GraphQL */ `
  query Task($id: ID!) {
    task(id: $id) {
      id boardId taskTypeId title description status assigneeUserId priority
      textAddress lat lng clientNameSnapshot clientPhoneSnapshot dueAt createdAt closedAt
      orderId clientId clientIsVipSnapshot shortId deliveryPhotoUrl
    }
  }
`;

export async function tasksGetTask(tasksToken: string, namespaceSlug: string, id: string) {
  const devHeaders = await getDeviceHeaders();
  return tasksRequestWithRefresh(async () => {
    const res = await tasksClient.request<{ task: TaskItem | null }>(
      TaskDocument,
      { id },
      { headers: { IssuesAuthorization: `Bearer ${tasksToken}`, Namespace: namespaceSlug, ...devHeaders } },
    );
    return res.task;
  }, namespaceSlug);
}
