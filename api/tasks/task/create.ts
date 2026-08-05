import { tasksClient } from '@/api/clients';
import { tasksRequestWithRefresh } from '@/api/tasks/tasksRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { TaskItem } from '@/api/tasks/task/list';

const CreateTaskDocument = /* GraphQL */ `
  mutation CreateTask($input: CreateTaskInput!) {
    createTask(input: $input) {
      id boardId taskTypeId title description status assigneeUserId priority
      textAddress lat lng clientNameSnapshot clientPhoneSnapshot dueAt createdAt closedAt
      orderId clientId clientIsVipSnapshot shortId deliveryPhotoUrl taskNumber sortOrder cycleId
      escalatedAt estimateValue visitedStatuses
    }
  }
`;

export interface CreateTaskInput {
  boardId: string;
  taskTypeId: string;
  title: string;
  description?: string;
  status?: string;
  assigneeUserId?: string;
  priority?: number;
  textAddress?: string;
  lat?: number;
  lng?: number;
  clientNameSnapshot?: string;
  clientPhoneSnapshot?: string;
  // Optional manual link to a Contacts client — the snapshot above is
  // resolved automatically from this id once, at creation, if Contacts is
  // installed and reachable (plan §6.3).
  clientId?: string;
  dueAt?: string;
  // Omit to leave the task in the backlog (no cycle).
  cycleId?: string;
  estimateValue?: number;
}

export async function tasksCreateTask(tasksToken: string, namespaceSlug: string, input: CreateTaskInput) {
  const devHeaders = await getDeviceHeaders();
  return tasksRequestWithRefresh(async () => {
    const res = await tasksClient.request<{ createTask: TaskItem }>(
      CreateTaskDocument,
      { input },
      { headers: { IssuesAuthorization: `Bearer ${tasksToken}`, Namespace: namespaceSlug, ...devHeaders } },
    );
    return res.createTask;
  }, namespaceSlug);
}
