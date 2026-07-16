import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { MenuOrder } from '@/api/menu/order/list';

export type UpdateOrderInput = {
  orderId: string;
  phone: string;
  customerName?: string;
  deliveryAddress?: string;
  comment?: string;
  userId?: string;
};

const UpdateOrderDocument = /* GraphQL */ `
  mutation UpdateOrder($input: UpdateOrderInput!) {
    updateOrder(input: $input) {
      id number branchId clientId type status phone customerName deliveryAddress deliveryAt comment sourceTag totalAmount createdAt
    }
  }
`;

export async function menuUpdateOrder(menuToken: string, namespaceSlug: string, input: UpdateOrderInput): Promise<MenuOrder> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ updateOrder: MenuOrder }>(
      UpdateOrderDocument,
      { input },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.updateOrder;
  }, namespaceSlug);
}
