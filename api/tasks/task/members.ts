import { tasksClient } from '@/api/clients';
import { tasksRequestWithRefresh } from '@/api/tasks/tasksRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export interface TaskMember {
  id: string;
  taskId: string;
  userId: string;
  role: string;
  doneAt?: string | null;
}

const TaskMembersDocument = /* GraphQL */ `
  query TaskMembers($taskId: ID!) {
    taskMembers(taskId: $taskId) { id taskId userId role doneAt }
  }
`;
const AddTaskMemberDocument = /* GraphQL */ `
  mutation AddTaskMember($input: AddTaskMemberInput!) {
    addTaskMember(input: $input) { id taskId userId role doneAt }
  }
`;
const RemoveTaskMemberDocument = /* GraphQL */ `
  mutation RemoveTaskMember($id: ID!) {
    removeTaskMember(id: $id) { success }
  }
`;

export async function tasksTaskMembersList(tasksToken: string, namespaceSlug: string, taskId: string) {
  const devHeaders = await getDeviceHeaders();
  return tasksRequestWithRefresh(async () => {
    const res = await tasksClient.request<{ taskMembers: TaskMember[] }>(
      TaskMembersDocument, { taskId },
      { headers: { IssuesAuthorization: `Bearer ${tasksToken}`, Namespace: namespaceSlug, ...devHeaders } },
    );
    return res.taskMembers;
  }, namespaceSlug);
}

export async function tasksAddTaskMember(
  tasksToken: string, namespaceSlug: string,
  input: { taskId: string; userId: string; role: string },
) {
  const devHeaders = await getDeviceHeaders();
  return tasksRequestWithRefresh(async () => {
    const res = await tasksClient.request<{ addTaskMember: TaskMember }>(
      AddTaskMemberDocument, { input },
      { headers: { IssuesAuthorization: `Bearer ${tasksToken}`, Namespace: namespaceSlug, ...devHeaders } },
    );
    return res.addTaskMember;
  }, namespaceSlug);
}

export async function tasksRemoveTaskMember(tasksToken: string, namespaceSlug: string, id: string) {
  const devHeaders = await getDeviceHeaders();
  return tasksRequestWithRefresh(async () => {
    const res = await tasksClient.request<{ removeTaskMember: { success: boolean } }>(
      RemoveTaskMemberDocument, { id },
      { headers: { IssuesAuthorization: `Bearer ${tasksToken}`, Namespace: namespaceSlug, ...devHeaders } },
    );
    return res.removeTaskMember.success;
  }, namespaceSlug);
}

export async function tasksSetTaskMemberDone(tasksToken: string, namespaceSlug: string, taskId: string, done: boolean): Promise<TaskMember> {
  const devHeaders = await getDeviceHeaders();
  return tasksRequestWithRefresh(async () => {
    const res = await tasksClient.request<{ setTaskMemberDone: TaskMember }>(
      /* GraphQL */ `mutation SetTaskMemberDone($taskId: ID!, $done: Boolean!) { setTaskMemberDone(taskId: $taskId, done: $done) { id taskId userId role doneAt } }`,
      { taskId, done },
      { headers: { IssuesAuthorization: `Bearer ${tasksToken}`, Namespace: namespaceSlug, ...devHeaders } },
    );
    return res.setTaskMemberDone;
  }, namespaceSlug);
}
