import { tasksClient } from '@/api/clients';
import { tasksRequestWithRefresh } from '@/api/tasks/tasksRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export interface Cycle {
  id: string;
  boardId: string;
  name: string;
  startsAt?: string | null;
  endsAt?: string | null;
  isClosed: boolean;
  createdAt: string;
}

const CyclesDocument = /* GraphQL */ `
  query Cycles($boardId: ID!, $filter: DefaultFilterInput) {
    cycles(boardId: $boardId, filter: $filter) {
      rows { id boardId name startsAt endsAt isClosed createdAt }
      info { count }
    }
  }
`;

export async function tasksCyclesList(tasksToken: string, namespaceSlug: string, boardId: string) {
  const devHeaders = await getDeviceHeaders();
  return tasksRequestWithRefresh(async () => {
    const res = await tasksClient.request<{ cycles: { rows: Cycle[]; info: { count: number } } }>(
      CyclesDocument,
      { boardId, filter: { pagination: { page: 1, length: 'ONE_HUNDRED' } } },
      { headers: { IssuesAuthorization: `Bearer ${tasksToken}`, Namespace: namespaceSlug, ...devHeaders } },
    );
    return { cycles: res.cycles.rows, count: res.cycles.info.count };
  }, namespaceSlug);
}
