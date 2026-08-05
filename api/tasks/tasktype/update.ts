import { tasksClient } from '@/api/clients';
import { tasksRequestWithRefresh } from '@/api/tasks/tasksRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { TaskType } from '@/api/tasks/tasktype/list';

const UpdateTaskTypeDocument = /* GraphQL */ `
  mutation UpdateTaskType($input: UpdateTaskTypeInput!) {
    updateTaskType(input: $input) { id boardId name color icon requiresLocation slaMinutes escalationUserId estimationType }
  }
`;

export interface UpdateTaskTypeInput {
  id: string;
  name?: string;
  color?: string;
  icon?: string;
  requiresLocation?: boolean;
  slaMinutes?: number;
  escalationUserId?: string;
  estimationType?: string;
}

export async function tasksUpdateTaskType(tasksToken: string, namespaceSlug: string, input: UpdateTaskTypeInput) {
  const devHeaders = await getDeviceHeaders();
  return tasksRequestWithRefresh(async () => {
    const res = await tasksClient.request<{ updateTaskType: TaskType }>(
      UpdateTaskTypeDocument,
      { input },
      { headers: { IssuesAuthorization: `Bearer ${tasksToken}`, Namespace: namespaceSlug, ...devHeaders } },
    );
    return res.updateTaskType;
  }, namespaceSlug);
}
