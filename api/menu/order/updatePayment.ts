import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { MenuOrder } from '@/api/menu/order/list';

const UpdateOrderPaymentDocument = /* GraphQL */ `
  mutation UpdateOrderPayment($input: UpdateOrderPaymentInput!) {
    updateOrderPayment(input: $input) {
      id number branchId clientId type status phone customerName deliveryAddress deliveryAt comment sourceTag totalAmount createdAt closedAt discountAmount paidAmount
    }
  }
`;

export async function menuUpdateOrderPayment(
  menuToken: string,
  namespaceSlug: string,
  orderId: string,
  discountAmount: number,
  paidAmount: number
): Promise<MenuOrder> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ updateOrderPayment: MenuOrder }>(
      UpdateOrderPaymentDocument,
      { input: { orderId, discountAmount, paidAmount } },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.updateOrderPayment;
  }, namespaceSlug);
}
