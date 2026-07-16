import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export type MenuOrderItem = {
  id: string;
  orderId: string;
  menuItemId: string;
  name: string;
  priceAtPurchase: number;
  quantity: number;
};

const OrderItemsDocument = /* GraphQL */ `
  query OrderItems($orderId: String!) {
    orderItems(orderId: $orderId) {
      rows { id orderId menuItemId name priceAtPurchase quantity }
    }
  }
`;

export async function menuOrderItems(menuToken: string, namespaceSlug: string, orderId: string): Promise<MenuOrderItem[]> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ orderItems: { rows: MenuOrderItem[] } }>(
      OrderItemsDocument,
      { orderId },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.orderItems.rows;
  }, namespaceSlug);
}
