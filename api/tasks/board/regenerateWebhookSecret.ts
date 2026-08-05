import { tasksClient } from '@/api/clients';
import { tasksRequestWithRefresh } from '@/api/tasks/tasksRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { TaskBoard } from '@/api/tasks/board/list';

const RegenerateBoardWebhookSecretDocument = /* GraphQL */ `
  mutation RegenerateBoardWebhookSecret($id: ID!) {
    regenerateBoardWebhookSecret(id: $id) {
      id name isActive featureFlags integrationFlags deliveryConfirmationMode defaultTaskTypeId statuses webhookSecret
    }
  }
`;

export async function tasksRegenerateBoardWebhookSecret(tasksToken: string, namespaceSlug: string, id: string) {
  const devHeaders = await getDeviceHeaders();
  return tasksRequestWithRefresh(async () => {
    const res = await tasksClient.request<{ regenerateBoardWebhookSecret: TaskBoard }>(
      RegenerateBoardWebhookSecretDocument,
      { id },
      { headers: { IssuesAuthorization: `Bearer ${tasksToken}`, Namespace: namespaceSlug, ...devHeaders } },
    );
    return res.regenerateBoardWebhookSecret;
  }, namespaceSlug);
}
