import { goodsClient } from '@/api/clients';
import { goodsRequestWithRefresh } from '@/api/goods/goodsRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export type GoodsPurchaseOrderStatus = 'DRAFT' | 'SENT' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';

export type GoodsPurchaseOrderItem = { id: string; goodId: string; unitId: string; quantity: number; priceCents: number };
export type GoodsPurchaseOrder = {
  id: string; warehouseId: string; supplierId: string; number: string; status: GoodsPurchaseOrderStatus;
  expectedDate?: string | null; createdBy: string; createdAt: string; items: GoodsPurchaseOrderItem[];
};

const PO_FIELDS = `id warehouseId supplierId number status expectedDate createdBy createdAt items { id goodId unitId quantity priceCents }`;

function headers(token: string, ns: string, dev: Record<string, string>) {
  return { GoodsAuthorization: `Bearer ${token}`, Namespace: ns, ...dev };
}

const ListDocument = /* GraphQL */ `
  query PurchaseOrders($warehouseId: ID, $filter: DefaultFilterInput) {
    purchaseOrders(warehouseId: $warehouseId, filter: $filter) { rows { ${PO_FIELDS} } info { count } }
  }
`;

export async function goodsListPurchaseOrders(token: string, ns: string, warehouseId?: string): Promise<{ purchaseOrders: GoodsPurchaseOrder[]; count: number }> {
  const dev = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ purchaseOrders: { rows: GoodsPurchaseOrder[]; info: { count: number } } }>(
      ListDocument, { warehouseId, filter: { pagination: { page: 1, length: 'FIFTY' } } }, { headers: headers(token, ns, dev) }
    );
    return { purchaseOrders: res.purchaseOrders.rows, count: res.purchaseOrders.info.count };
  }, ns);
}

const CreateDocument = /* GraphQL */ `
  mutation CreatePurchaseOrder($input: CreatePurchaseOrderInput!) {
    createPurchaseOrder(input: $input) { ${PO_FIELDS} }
  }
`;

export type CreatePurchaseOrderInput = {
  warehouseId: string; supplierId: string; expectedDate?: string;
  items: { goodId: string; unitId: string; quantity: number; priceCents: number }[];
};

export async function goodsCreatePurchaseOrder(token: string, ns: string, input: CreatePurchaseOrderInput): Promise<GoodsPurchaseOrder> {
  const dev = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ createPurchaseOrder: GoodsPurchaseOrder }>(CreateDocument, { input }, { headers: headers(token, ns, dev) });
    return res.createPurchaseOrder;
  }, ns);
}

const UpdateStatusDocument = /* GraphQL */ `
  mutation UpdatePurchaseOrderStatus($id: ID!, $status: PurchaseOrderStatusEnum!) {
    updatePurchaseOrderStatus(id: $id, status: $status) { ${PO_FIELDS} }
  }
`;

export async function goodsUpdatePurchaseOrderStatus(token: string, ns: string, id: string, status: GoodsPurchaseOrderStatus): Promise<GoodsPurchaseOrder> {
  const dev = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ updatePurchaseOrderStatus: GoodsPurchaseOrder }>(UpdateStatusDocument, { id, status }, { headers: headers(token, ns, dev) });
    return res.updatePurchaseOrderStatus;
  }, ns);
}
