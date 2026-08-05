import { tasksClient } from '@/api/clients';
import { tasksRequestWithRefresh } from '@/api/tasks/tasksRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export interface TaskActivity {
  id: string;
  taskId: string;
  actorId?: string | null;
  actorType: string;
  action: string;
  beforeState?: string | null;
  afterState?: string | null;
  comment?: string | null;
  createdAt: string;
}

const TaskActivityDocument = /* GraphQL */ `
  query TaskActivity($taskId: ID!, $filter: DefaultFilterInput) {
    taskActivity(taskId: $taskId, filter: $filter) {
      rows { id taskId actorId actorType action beforeState afterState comment createdAt }
      info { count }
    }
  }
`;

export async function tasksTaskActivityList(tasksToken: string, namespaceSlug: string, taskId: string) {
  const devHeaders = await getDeviceHeaders();
  return tasksRequestWithRefresh(async () => {
    const res = await tasksClient.request<{ taskActivity: { rows: TaskActivity[]; info: { count: number } } }>(
      TaskActivityDocument,
      { taskId, filter: { pagination: { page: 1, length: 'ONE_HUNDRED' } } },
      { headers: { IssuesAuthorization: `Bearer ${tasksToken}`, Namespace: namespaceSlug, ...devHeaders } },
    );
    return { activities: res.taskActivity.rows, count: res.taskActivity.info.count };
  }, namespaceSlug);
}
