import { tasksClient } from '@/api/clients';
import { tasksRequestWithRefresh } from '@/api/tasks/tasksRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { TaskBoard } from '@/api/tasks/board/list';

const CreateBoardDocument = /* GraphQL */ `
  mutation CreateBoard($input: CreateBoardInput!) {
    createBoard(input: $input) {
      id name slug isActive featureFlags integrationFlags deliveryConfirmationMode defaultTaskTypeId statuses webhookSecret
    }
  }
`;

export interface CreateBoardInput {
  name: string;
  featureFlags?: string;
  integrationFlags?: string;
  deliveryConfirmationMode?: string;
  statuses?: string;
  businessType?: string;
  locale?: string;
}

export async function tasksCreateBoard(tasksToken: string, namespaceSlug: string, input: CreateBoardInput) {
  const devHeaders = await getDeviceHeaders();
  return tasksRequestWithRefresh(async () => {
    const res = await tasksClient.request<{ createBoard: TaskBoard }>(
      CreateBoardDocument,
      { input },
      { headers: { IssuesAuthorization: `Bearer ${tasksToken}`, Namespace: namespaceSlug, ...devHeaders } },
    );
    return res.createBoard;
  }, namespaceSlug);
}
