import { tasksClient } from '@/api/clients';
import { tasksRequestWithRefresh } from '@/api/tasks/tasksRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { Cycle } from '@/api/tasks/cycle/list';

const CreateCycleDocument = /* GraphQL */ `
  mutation CreateCycle($input: CreateCycleInput!) {
    createCycle(input: $input) { id boardId name startsAt endsAt isClosed createdAt }
  }
`;

export interface CreateCycleInput {
  boardId: string;
  name: string;
  startsAt?: string;
  endsAt?: string;
}

export async function tasksCreateCycle(tasksToken: string, namespaceSlug: string, input: CreateCycleInput) {
  const devHeaders = await getDeviceHeaders();
  return tasksRequestWithRefresh(async () => {
    const res = await tasksClient.request<{ createCycle: Cycle }>(
      CreateCycleDocument,
      { input },
      { headers: { IssuesAuthorization: `Bearer ${tasksToken}`, Namespace: namespaceSlug, ...devHeaders } },
    );
    return res.createCycle;
  }, namespaceSlug);
}
