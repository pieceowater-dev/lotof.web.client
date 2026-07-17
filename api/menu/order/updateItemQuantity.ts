import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { MenuOrder } from '@/api/menu/order/list';

const UpdateOrderItemQuantityDocument = /* GraphQL */ `
  mutation UpdateOrderItemQuantity($id: ID!, $quantity: Int!) {
    updateOrderItemQuantity(id: $id, quantity: $quantity) {
      id number branchId clientId type status phone customerName deliveryAddress deliveryAt comment sourceTag totalAmount createdAt closedAt
    }
  }
`;

export async function menuUpdateOrderItemQuantity(menuToken: string, namespaceSlug: string, id: string, quantity: number): Promise<MenuOrder> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ updateOrderItemQuantity: MenuOrder }>(
      UpdateOrderItemQuantityDocument,
      { id, quantity },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.updateOrderItemQuantity;
  }, namespaceSlug);
}
