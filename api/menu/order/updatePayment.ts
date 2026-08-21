import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { MenuOrder } from '@/api/menu/order/list';

const UpdateOrderPaymentDocument = /* GraphQL */ `
  mutation UpdateOrderPayment($input: UpdateOrderPaymentInput!) {
    updateOrderPayment(input: $input) {
      id number branchId clientId type status phone customerName deliveryAddress deliveryAt comment sourceTag totalAmount createdAt closedAt discountAmount discountType discountValue discountItemId paidAmount
    }
  }
`;

export type UpdateOrderPaymentInput = {
  orderId: string;
  discountType: string; // "" | "ORDER_AMOUNT" | "ORDER_PERCENT" | "ITEM_AMOUNT" | "ITEM_PERCENT"
  discountValue: number;
  discountItemId?: string | null; // required when discountType is ITEM_AMOUNT or ITEM_PERCENT
  paidAmount: number;
};

export async function menuUpdateOrderPayment(menuToken: string, namespaceSlug: string, input: UpdateOrderPaymentInput): Promise<MenuOrder> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ updateOrderPayment: MenuOrder }>(
      UpdateOrderPaymentDocument,
      { input },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.updateOrderPayment;
  }, namespaceSlug);
}
