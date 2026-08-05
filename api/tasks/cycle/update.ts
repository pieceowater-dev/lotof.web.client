import { tasksClient } from '@/api/clients';
import { tasksRequestWithRefresh } from '@/api/tasks/tasksRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { Cycle } from '@/api/tasks/cycle/list';

const UpdateCycleDocument = /* GraphQL */ `
  mutation UpdateCycle($input: UpdateCycleInput!) {
    updateCycle(input: $input) { id boardId name startsAt endsAt isClosed createdAt }
  }
`;

export interface UpdateCycleInput {
  id: string;
  name?: string;
  startsAt?: string;
  endsAt?: string;
}

export async function tasksUpdateCycle(tasksToken: string, namespaceSlug: string, input: UpdateCycleInput) {
  const devHeaders = await getDeviceHeaders();
  return tasksRequestWithRefresh(async () => {
    const res = await tasksClient.request<{ updateCycle: Cycle }>(
      UpdateCycleDocument,
      { input },
      { headers: { IssuesAuthorization: `Bearer ${tasksToken}`, Namespace: namespaceSlug, ...devHeaders } },
    );
    return res.updateCycle;
  }, namespaceSlug);
}

const CloseCycleDocument = /* GraphQL */ `
  mutation CloseCycle($id: ID!) {
    closeCycle(id: $id) { id boardId name startsAt endsAt isClosed createdAt }
  }
`;

export async function tasksCloseCycle(tasksToken: string, namespaceSlug: string, id: string) {
  const devHeaders = await getDeviceHeaders();
  return tasksRequestWithRefresh(async () => {
    const res = await tasksClient.request<{ closeCycle: Cycle }>(
      CloseCycleDocument,
      { id },
      { headers: { IssuesAuthorization: `Bearer ${tasksToken}`, Namespace: namespaceSlug, ...devHeaders } },
    );
    return res.closeCycle;
  }, namespaceSlug);
}
