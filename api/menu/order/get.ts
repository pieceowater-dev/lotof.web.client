import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { MenuOrder } from '@/api/menu/order/list';

const OrderDocument = /* GraphQL */ `
  query Order($id: ID!) {
    order(id: $id) {
      id number branchId clientId type status phone customerName deliveryAddress deliveryAt comment sourceTag totalAmount createdAt
    }
  }
`;

export async function menuGetOrder(menuToken: string, namespaceSlug: string, id: string): Promise<MenuOrder | null> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ order: MenuOrder | null }>(
      OrderDocument,
      { id },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.order;
  }, namespaceSlug);
}
