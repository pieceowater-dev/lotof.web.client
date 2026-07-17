import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { MenuOrder } from '@/api/menu/order/list';

const RemoveOrderItemDocument = /* GraphQL */ `
  mutation RemoveOrderItem($id: ID!) {
    removeOrderItem(id: $id) {
      id number branchId clientId type status phone customerName deliveryAddress deliveryAt comment sourceTag totalAmount createdAt closedAt
    }
  }
`;

export async function menuRemoveOrderItem(menuToken: string, namespaceSlug: string, id: string): Promise<MenuOrder> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ removeOrderItem: MenuOrder }>(
      RemoveOrderItemDocument,
      { id },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.removeOrderItem;
  }, namespaceSlug);
}
