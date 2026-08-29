import { tasksClient } from '@/api/clients';
import { tasksRequestWithRefresh } from '@/api/tasks/tasksRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import { getApiBaseUrl } from '@/utils/api-base';
import { buildGraphqlUploadBody } from '@/utils/graphqlMultipartUpload';
import { assertUploadSize } from '@/utils/imageCompression';
import type { TaskItem } from '@/api/tasks/task/list';

const TASK_FIELDS = `
  id boardId taskTypeId title description status assigneeUserId priority
  textAddress lat lng clientNameSnapshot clientPhoneSnapshot dueAt createdAt closedAt
  orderId clientId clientIsVipSnapshot shortId deliveryPhotoUrl taskNumber sortOrder cycleId
  escalatedAt estimateValue visitedStatuses
`;

const UpdateTaskDocument = /* GraphQL */ `
  mutation UpdateTask($input: UpdateTaskInput!) { updateTask(input: $input) { ${TASK_FIELDS} } }
`;
const UpdateTaskStatusDocument = /* GraphQL */ `
  mutation UpdateTaskStatus($input: UpdateTaskStatusInput!) { updateTaskStatus(input: $input) { ${TASK_FIELDS} } }
`;
const AssignTaskDocument = /* GraphQL */ `
  mutation AssignTask($input: AssignTaskInput!) { assignTask(input: $input) { ${TASK_FIELDS} } }
`;
const UpdateTaskLocationDocument = /* GraphQL */ `
  mutation UpdateTaskLocation($input: UpdateTaskLocationInput!) { updateTaskLocation(input: $input) { ${TASK_FIELDS} } }
`;
const UpdateTaskOrderDocument = /* GraphQL */ `
  mutation UpdateTaskOrder($taskId: ID!, $sortOrder: Float!) { updateTaskOrder(taskId: $taskId, sortOrder: $sortOrder) { ${TASK_FIELDS} } }
`;
const UpdateTaskCycleDocument = /* GraphQL */ `
  mutation UpdateTaskCycle($taskId: ID!, $cycleId: ID) { updateTaskCycle(taskId: $taskId, cycleId: $cycleId) { ${TASK_FIELDS} } }
`;
const RefreshClientSnapshotDocument = /* GraphQL */ `
  mutation RefreshClientSnapshot($taskId: ID!) { refreshClientSnapshot(taskId: $taskId) { ${TASK_FIELDS} } }
`;
const UploadTaskDeliveryPhotoDocument = /* GraphQL */ `
  mutation UploadTaskDeliveryPhoto($taskId: ID!, $file: Upload!) {
    uploadTaskDeliveryPhoto(taskId: $taskId, file: $file) { ${TASK_FIELDS} }
  }
`;

export interface UpdateTaskInput {
  id: string;
  taskTypeId: string;
  title: string;
  description?: string;
  priority?: number;
  clientNameSnapshot?: string;
  clientPhoneSnapshot?: string;
  dueAt?: string;
  estimateValue?: number;
}

export async function tasksUpdateTask(tasksToken: string, namespaceSlug: string, input: UpdateTaskInput) {
  const devHeaders = await getDeviceHeaders();
  return tasksRequestWithRefresh(async () => {
    const res = await tasksClient.request<{ updateTask: TaskItem }>(
      UpdateTaskDocument, { input },
      { headers: { IssuesAuthorization: `Bearer ${tasksToken}`, Namespace: namespaceSlug, ...devHeaders } },
    );
    return res.updateTask;
  }, namespaceSlug);
}

export async function tasksUpdateTaskStatus(
  tasksToken: string, namespaceSlug: string,
  input: { taskId: string; status: string; comment?: string; isTerminal: boolean },
) {
  const devHeaders = await getDeviceHeaders();
  return tasksRequestWithRefresh(async () => {
    const res = await tasksClient.request<{ updateTaskStatus: TaskItem }>(
      UpdateTaskStatusDocument, { input },
      { headers: { IssuesAuthorization: `Bearer ${tasksToken}`, Namespace: namespaceSlug, ...devHeaders } },
    );
    return res.updateTaskStatus;
  }, namespaceSlug);
}

export async function tasksAssignTask(
  tasksToken: string, namespaceSlug: string,
  input: { taskId: string; assigneeUserId?: string | null },
) {
  const devHeaders = await getDeviceHeaders();
  return tasksRequestWithRefresh(async () => {
    const res = await tasksClient.request<{ assignTask: TaskItem }>(
      AssignTaskDocument, { input },
      { headers: { IssuesAuthorization: `Bearer ${tasksToken}`, Namespace: namespaceSlug, ...devHeaders } },
    );
    return res.assignTask;
  }, namespaceSlug);
}

export async function tasksUpdateTaskLocation(
  tasksToken: string, namespaceSlug: string,
  input: { taskId: string; textAddress?: string; lat?: number; lng?: number },
) {
  const devHeaders = await getDeviceHeaders();
  return tasksRequestWithRefresh(async () => {
    const res = await tasksClient.request<{ updateTaskLocation: TaskItem }>(
      UpdateTaskLocationDocument, { input },
      { headers: { IssuesAuthorization: `Bearer ${tasksToken}`, Namespace: namespaceSlug, ...devHeaders } },
    );
    return res.updateTaskLocation;
  }, namespaceSlug);
}

export async function tasksUpdateTaskOrder(tasksToken: string, namespaceSlug: string, taskId: string, sortOrder: number) {
  const devHeaders = await getDeviceHeaders();
  return tasksRequestWithRefresh(async () => {
    const res = await tasksClient.request<{ updateTaskOrder: TaskItem }>(
      UpdateTaskOrderDocument, { taskId, sortOrder },
      { headers: { IssuesAuthorization: `Bearer ${tasksToken}`, Namespace: namespaceSlug, ...devHeaders } },
    );
    return res.updateTaskOrder;
  }, namespaceSlug);
}

export async function tasksUpdateTaskCycle(tasksToken: string, namespaceSlug: string, taskId: string, cycleId: string | null) {
  const devHeaders = await getDeviceHeaders();
  return tasksRequestWithRefresh(async () => {
    const res = await tasksClient.request<{ updateTaskCycle: TaskItem }>(
      UpdateTaskCycleDocument, { taskId, cycleId },
      { headers: { IssuesAuthorization: `Bearer ${tasksToken}`, Namespace: namespaceSlug, ...devHeaders } },
    );
    return res.updateTaskCycle;
  }, namespaceSlug);
}

// Re-fetches name/phone/VIP tag from Contacts for a task that already has a
// clientId (plan §6.3) — a no-op returning the task unchanged if Contacts
// isn't reachable or the task has no clientId.
export async function tasksRefreshClientSnapshot(tasksToken: string, namespaceSlug: string, taskId: string) {
  const devHeaders = await getDeviceHeaders();
  return tasksRequestWithRefresh(async () => {
    const res = await tasksClient.request<{ refreshClientSnapshot: TaskItem }>(
      RefreshClientSnapshotDocument, { taskId },
      { headers: { IssuesAuthorization: `Bearer ${tasksToken}`, Namespace: namespaceSlug, ...devHeaders } },
    );
    return res.refreshClientSnapshot;
  }, namespaceSlug);
}

// Uses a plain multipart fetch (graphql-request has no file-upload support)
// — mirrors menuUploadImage's exact pattern, following the GraphQL
// multipart-request spec by hand.
export async function tasksUploadTaskDeliveryPhoto(tasksToken: string, namespaceSlug: string, taskId: string, file: File): Promise<TaskItem> {
  assertUploadSize(file);
  const operations = {
    query: UploadTaskDeliveryPhotoDocument,
    variables: { taskId, file: null },
  };

  const { body, contentType } = await buildGraphqlUploadBody(operations, { file: ['variables.file'] }, 'file', file);

  const uploadUrl = `${getApiBaseUrl('tasks')}/query`;
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      IssuesAuthorization: `Bearer ${tasksToken}`,
      Namespace: namespaceSlug,
      'Content-Type': contentType,
    },
    body,
  });

  const result: any = await response.json().catch(() => ({}));
  if (!response.ok || result?.errors?.length) {
    throw new Error(String(result?.errors?.[0]?.message || `Upload failed with status ${response.status}`));
  }

  const task = result?.data?.uploadTaskDeliveryPhoto;
  if (!task) throw new Error('Upload did not return a task');
  return task as TaskItem;
}
