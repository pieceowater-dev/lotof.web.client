import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { MenuOrder } from '@/api/menu/order/list';

const UpdateOrderStatusDocument = /* GraphQL */ `
  mutation UpdateOrderStatus($input: UpdateOrderStatusInput!) {
    updateOrderStatus(input: $input) {
      id number branchId clientId type status phone customerName deliveryAddress deliveryAt comment sourceTag totalAmount createdAt closedAt customFields warrantyOfOrderId readyAt priceQuotedAt priceQuotedBy priceApprovedAt stageId statusChangedAt isUrgent
    }
  }
`;

export async function menuUpdateOrderStatus(menuToken: string, namespaceSlug: string, orderId: string, status: string, stageId?: string): Promise<MenuOrder> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ updateOrderStatus: MenuOrder }>(
      UpdateOrderStatusDocument,
      { input: { orderId, status, stageId: stageId || undefined } },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.updateOrderStatus;
  }, namespaceSlug);
}
