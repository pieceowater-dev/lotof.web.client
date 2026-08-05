import { tasksClient } from '@/api/clients';
import { tasksRequestWithRefresh } from '@/api/tasks/tasksRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { TaskType } from '@/api/tasks/tasktype/list';

const CreateTaskTypeDocument = /* GraphQL */ `
  mutation CreateTaskType($input: CreateTaskTypeInput!) {
    createTaskType(input: $input) { id boardId name color icon requiresLocation slaMinutes escalationUserId estimationType }
  }
`;

export interface CreateTaskTypeInput {
  boardId: string;
  name: string;
  color?: string;
  icon?: string;
  requiresLocation?: boolean;
  slaMinutes?: number;
  escalationUserId?: string;
  estimationType?: string;
}

export async function tasksCreateTaskType(tasksToken: string, namespaceSlug: string, input: CreateTaskTypeInput) {
  const devHeaders = await getDeviceHeaders();
  return tasksRequestWithRefresh(async () => {
    const res = await tasksClient.request<{ createTaskType: TaskType }>(
      CreateTaskTypeDocument,
      { input },
      { headers: { IssuesAuthorization: `Bearer ${tasksToken}`, Namespace: namespaceSlug, ...devHeaders } },
    );
    return res.createTaskType;
  }, namespaceSlug);
}
