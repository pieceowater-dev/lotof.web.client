import { tasksClient } from '@/api/clients';
import { tasksRequestWithRefresh } from '@/api/tasks/tasksRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export interface TaskType {
  id: string;
  boardId: string;
  name: string;
  color?: string | null;
  icon?: string | null;
  requiresLocation: boolean;
  slaMinutes?: number | null;
  escalationUserId?: string | null;
  estimationType: string;
}

const TaskTypesDocument = /* GraphQL */ `
  query TaskTypes($boardId: ID!, $filter: DefaultFilterInput) {
    taskTypes(boardId: $boardId, filter: $filter) {
      rows { id boardId name color icon requiresLocation slaMinutes escalationUserId estimationType }
      info { count }
    }
  }
`;

export async function tasksTaskTypesList(tasksToken: string, namespaceSlug: string, boardId: string) {
  const devHeaders = await getDeviceHeaders();
  return tasksRequestWithRefresh(async () => {
    const res = await tasksClient.request<{ taskTypes: { rows: TaskType[]; info: { count: number } } }>(
      TaskTypesDocument,
      { boardId, filter: { pagination: { page: 1, length: 'ONE_HUNDRED' } } },
      { headers: { IssuesAuthorization: `Bearer ${tasksToken}`, Namespace: namespaceSlug, ...devHeaders } },
    );
    return { taskTypes: res.taskTypes.rows, count: res.taskTypes.info.count };
  }, namespaceSlug);
}
