import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export type MenuOrderHistoryEntry = {
  id: string;
  orderId: string;
  previousStatus: string;
  newStatus: string;
  userId?: string | null;
  comment?: string | null;
  createdAt: string;
};

const OrderHistoryDocument = /* GraphQL */ `
  query OrderHistory($orderId: String!) {
    orderHistory(orderId: $orderId) {
      rows { id orderId previousStatus newStatus userId comment createdAt }
    }
  }
`;

export async function menuOrderHistory(menuToken: string, namespaceSlug: string, orderId: string): Promise<MenuOrderHistoryEntry[]> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ orderHistory: { rows: MenuOrderHistoryEntry[] } }>(
      OrderHistoryDocument,
      { orderId },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.orderHistory.rows;
  }, namespaceSlug);
}
