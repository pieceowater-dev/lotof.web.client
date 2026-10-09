import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { MenuOrderItem } from '@/api/menu/order/items';
import type { MenuOrderHistoryEntry } from '@/api/menu/order/history';
import type { MenuOrderMember } from '@/api/menu/order/members';

// Combines orderItems + orderHistory + orderMembers into one request — the
// order detail modal always fetches all three together, every time it
// opens (the single most frequent data fetch in the admin app), so this
// replaces 3 round trips with 1.
const OrderDetailsBundleDocument = /* GraphQL */ `
  query OrderDetailsBundle($orderId: String!) {
    orderItems(orderId: $orderId) {
      rows {
        id orderId menuItemId name priceAtPurchase quantity
        modifiers { id orderItemId modifierOptionId name priceAtPurchase }
      }
    }
    orderHistory(orderId: $orderId) {
      rows { id orderId previousStatus newStatus userId comment createdAt }
    }
    orderMembers(orderId: $orderId) {
      rows { id orderId userId role }
    }
  }
`;

export type OrderDetailsBundle = {
  items: MenuOrderItem[];
  history: MenuOrderHistoryEntry[];
  members: MenuOrderMember[];
};

export async function menuOrderDetailsBundle(menuToken: string, namespaceSlug: string, orderId: string): Promise<OrderDetailsBundle> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{
      orderItems: { rows: MenuOrderItem[] };
      orderHistory: { rows: MenuOrderHistoryEntry[] };
      orderMembers: { rows: MenuOrderMember[] };
    }>(
      OrderDetailsBundleDocument,
      { orderId },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return { items: res.orderItems.rows, history: res.orderHistory.rows, members: res.orderMembers.rows };
  }, namespaceSlug);
}
