import { goodsClient } from '@/api/clients';
import { goodsRequestWithRefresh } from '@/api/goods/goodsRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export type GoodsSupplierReturnItem = { id: string; goodId: string; unitId: string; quantity: number; costPriceCents: number };
export type GoodsSupplierReturn = {
  id: string; goodsReceiptId: string; warehouseId: string; supplierId?: string | null; number: string; comment: string;
  createdBy: string; createdAt: string; totalCents: number; items: GoodsSupplierReturnItem[];
};

const FIELDS = `id goodsReceiptId warehouseId supplierId number comment createdBy createdAt totalCents items { id goodId unitId quantity costPriceCents }`;

function headers(token: string, ns: string, dev: Record<string, string>) {
  return { GoodsAuthorization: `Bearer ${token}`, Namespace: ns, ...dev };
}

const ListDocument = /* GraphQL */ `
  query SupplierReturns($warehouseId: ID, $goodsReceiptId: ID, $filter: DefaultFilterInput) {
    supplierReturns(warehouseId: $warehouseId, goodsReceiptId: $goodsReceiptId, filter: $filter) { rows { ${FIELDS} } info { count } }
  }
`;

export async function goodsListSupplierReturns(token: string, ns: string, warehouseId?: string): Promise<{ returns: GoodsSupplierReturn[]; count: number }> {
  const dev = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ supplierReturns: { rows: GoodsSupplierReturn[]; info: { count: number } } }>(
      ListDocument, { warehouseId, filter: { pagination: { page: 1, length: 'FIFTY' } } }, { headers: headers(token, ns, dev) }
    );
    return { returns: res.supplierReturns.rows, count: res.supplierReturns.info.count };
  }, ns);
}

const CreateDocument = /* GraphQL */ `
  mutation CreateSupplierReturn($input: CreateSupplierReturnInput!) {
    createSupplierReturn(input: $input) { ${FIELDS} }
  }
`;

export type CreateSupplierReturnInput = { goodsReceiptId: string; comment?: string; items: { goodId: string; quantity: number }[] };

export async function goodsCreateSupplierReturn(token: string, ns: string, input: CreateSupplierReturnInput): Promise<GoodsSupplierReturn> {
  const dev = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ createSupplierReturn: GoodsSupplierReturn }>(CreateDocument, { input }, { headers: headers(token, ns, dev) });
    return res.createSupplierReturn;
  }, ns);
}
