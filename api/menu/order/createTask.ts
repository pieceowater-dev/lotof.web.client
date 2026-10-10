import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export type CreateOrderTaskInput = {
  orderId: string;
  title?: string;
  description?: string;
  assigneeUserId?: string;
  // RFC 3339.
  dueAt?: string;
  // 0 low, 1 medium (default), 2 high.
  priority?: number;
  issuesBoardId?: string;
};

export type CreateOrderTaskResult = {
  success: boolean;
  taskId?: string | null;
  // Why Issues could not create it (not installed, no board with the Menu
  // integration, ...); the order itself is never affected.
  message?: string | null;
};

const CreateOrderTaskDocument = /* GraphQL */ `
  mutation CreateOrderTask($input: CreateOrderTaskInput!) {
    createOrderTask(input: $input) { success taskId message }
  }
`;

export async function menuCreateOrderTask(menuToken: string, namespaceSlug: string, input: CreateOrderTaskInput): Promise<CreateOrderTaskResult> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ createOrderTask: CreateOrderTaskResult }>(
      CreateOrderTaskDocument,
      { input },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.createOrderTask;
  }, namespaceSlug);
}
