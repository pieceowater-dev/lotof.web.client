import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export type CreateOrderItemInput = {
  menuItemId: string;
  name: string;
  priceAtPurchase: number;
  quantity: number;
};

export type CreateOrderInput = {
  branchId?: string;
  phone: string;
  customerName?: string;
  type: 'delivery' | 'pickup';
  deliveryAddress?: string;
  comment?: string;
  sourceTag?: string;
  totalAmount: number;
  items: CreateOrderItemInput[];
};

const CreateOrderDocument = /* GraphQL */ `
  mutation CreateOrder($input: CreateOrderInput!) {
    createOrder(input: $input) {
      id number status
    }
  }
`;

export async function menuCreateOrder(menuToken: string, namespaceSlug: string, input: CreateOrderInput): Promise<{ id: string; number: number; status: string }> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ createOrder: { id: string; number: number; status: string } }>(
      CreateOrderDocument,
      {
        input: {
          branchId: input.branchId,
          phone: input.phone,
          customerName: input.customerName,
          type: input.type,
          deliveryAddress: input.deliveryAddress,
          comment: input.comment,
          sourceTag: input.sourceTag,
          totalAmount: input.totalAmount,
          items: input.items,
        },
      },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.createOrder;
  }, namespaceSlug);
}
