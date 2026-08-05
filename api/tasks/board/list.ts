import { tasksClient } from '@/api/clients';
import { tasksRequestWithRefresh } from '@/api/tasks/tasksRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export interface TaskBoard {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  featureFlags: string;
  integrationFlags: string;
  deliveryConfirmationMode: string;
  defaultTaskTypeId?: string | null;
  statuses: string;
  webhookSecret: string;
}

const BoardsDocument = /* GraphQL */ `
  query Boards($filter: DefaultFilterInput) {
    boards(filter: $filter) {
      rows { id name slug isActive featureFlags integrationFlags deliveryConfirmationMode defaultTaskTypeId statuses webhookSecret }
      info { count }
    }
  }
`;

export async function tasksBoardsList(tasksToken: string, namespaceSlug: string) {
  const devHeaders = await getDeviceHeaders();
  return tasksRequestWithRefresh(async () => {
    const res = await tasksClient.request<{ boards: { rows: TaskBoard[]; info: { count: number } } }>(
      BoardsDocument,
      { filter: { pagination: { page: 1, length: 'ONE_HUNDRED' } } },
      { headers: { IssuesAuthorization: `Bearer ${tasksToken}`, Namespace: namespaceSlug, ...devHeaders } },
    );
    return { boards: res.boards.rows, count: res.boards.info.count };
  }, namespaceSlug);
}
