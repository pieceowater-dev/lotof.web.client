import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

// A lota Issues task linked to an order, with its status already resolved
// through the owning board's own labels (see menu.gtw's orderTasks).
export type MenuOrderTask = {
  taskId: string;
  shortId: string;
  taskNumber: number;
  title: string;
  statusKey: string;
  statusLabel: string;
  isTerminal: boolean;
  assigneeUserId?: string | null;
  boardId: string;
  boardName: string;
  boardSlug: string;
};

const OrderTasksDocument = /* GraphQL */ `
  query OrderTasks($orderId: ID!) {
    orderTasks(orderId: $orderId) {
      taskId shortId taskNumber title statusKey statusLabel isTerminal assigneeUserId boardId boardName boardSlug
    }
  }
`;

export async function menuOrderTasks(menuToken: string, namespaceSlug: string, orderId: string): Promise<MenuOrderTask[]> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ orderTasks: MenuOrderTask[] }>(
      OrderTasksDocument,
      { orderId },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.orderTasks;
  }, namespaceSlug);
}
