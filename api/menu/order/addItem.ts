import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { MenuOrder } from '@/api/menu/order/list';

export type AddOrderItemInput = {
  orderId: string;
  menuItemId: string;
  name: string;
  priceAtPurchase: number;
  quantity: number;
};

const AddOrderItemDocument = /* GraphQL */ `
  mutation AddOrderItem($input: AddOrderItemInput!) {
    addOrderItem(input: $input) {
      id number branchId clientId type status phone customerName deliveryAddress deliveryAt comment sourceTag totalAmount createdAt
    }
  }
`;

export async function menuAddOrderItem(menuToken: string, namespaceSlug: string, input: AddOrderItemInput): Promise<MenuOrder> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ addOrderItem: MenuOrder }>(
      AddOrderItemDocument,
      { input },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.addOrderItem;
  }, namespaceSlug);
}
