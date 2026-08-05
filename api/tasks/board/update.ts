import { tasksClient } from '@/api/clients';
import { tasksRequestWithRefresh } from '@/api/tasks/tasksRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { TaskBoard } from '@/api/tasks/board/list';

const UpdateBoardDocument = /* GraphQL */ `
  mutation UpdateBoard($input: UpdateBoardInput!) {
    updateBoard(input: $input) {
      id name slug isActive featureFlags integrationFlags deliveryConfirmationMode defaultTaskTypeId statuses webhookSecret
    }
  }
`;

export interface UpdateBoardInput {
  id: string;
  name?: string;
  isActive?: boolean;
  featureFlags?: string;
  integrationFlags?: string;
  deliveryConfirmationMode?: string;
  defaultTaskTypeId?: string;
  statuses?: string;
}

export async function tasksUpdateBoard(tasksToken: string, namespaceSlug: string, input: UpdateBoardInput) {
  const devHeaders = await getDeviceHeaders();
  return tasksRequestWithRefresh(async () => {
    const res = await tasksClient.request<{ updateBoard: TaskBoard }>(
      UpdateBoardDocument,
      { input },
      { headers: { IssuesAuthorization: `Bearer ${tasksToken}`, Namespace: namespaceSlug, ...devHeaders } },
    );
    return res.updateBoard;
  }, namespaceSlug);
}
