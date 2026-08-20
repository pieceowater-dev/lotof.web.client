import { goodsClient } from '@/api/clients';
import { goodsRequestWithRefresh } from '@/api/goods/goodsRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export type GoodsReceiptItem = {
  id: string; goodId: string; unitId: string; quantity: number; costPriceCents: number;
  batchNumber?: string | null; expiryDate?: string | null;
};
export type GoodsReceipt = {
  id: string; warehouseId: string; supplierId?: string | null; purchaseOrderId?: string | null;
  number: string; createdBy: string; createdAt: string; items: GoodsReceiptItem[];
};

const RECEIPT_FIELDS = `id warehouseId supplierId purchaseOrderId number createdBy createdAt items { id goodId unitId quantity costPriceCents batchNumber expiryDate }`;

function headers(token: string, ns: string, dev: Record<string, string>) {
  return { GoodsAuthorization: `Bearer ${token}`, Namespace: ns, ...dev };
}

const ListDocument = /* GraphQL */ `
  query GoodsReceipts($warehouseId: ID, $filter: DefaultFilterInput) {
    goodsReceipts(warehouseId: $warehouseId, filter: $filter) { rows { ${RECEIPT_FIELDS} } info { count } }
  }
`;

export async function goodsListReceipts(token: string, ns: string, warehouseId?: string): Promise<{ receipts: GoodsReceipt[]; count: number }> {
  const dev = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ goodsReceipts: { rows: GoodsReceipt[]; info: { count: number } } }>(
      ListDocument, { warehouseId, filter: { pagination: { page: 1, length: 'FIFTY' } } }, { headers: headers(token, ns, dev) }
    );
    return { receipts: res.goodsReceipts.rows, count: res.goodsReceipts.info.count };
  }, ns);
}

const CreateDocument = /* GraphQL */ `
  mutation CreateGoodsReceipt($input: CreateGoodsReceiptInput!) {
    createGoodsReceipt(input: $input) { ${RECEIPT_FIELDS} }
  }
`;

export type CreateGoodsReceiptInput = {
  warehouseId: string; supplierId?: string; purchaseOrderId?: string;
  items: { goodId: string; unitId: string; quantity: number; costPriceCents: number; batchNumber?: string; expiryDate?: string }[];
};

export async function goodsCreateReceipt(token: string, ns: string, input: CreateGoodsReceiptInput): Promise<GoodsReceipt> {
  const dev = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ createGoodsReceipt: GoodsReceipt }>(CreateDocument, { input }, { headers: headers(token, ns, dev) });
    return res.createGoodsReceipt;
  }, ns);
}

export type SupplierPriceHistoryEntry = {
  supplierId: string; supplierName: string; goodsReceiptId: string; costPriceCents: number; quantity: number; receivedAt: string;
};

const PriceHistoryDocument = /* GraphQL */ `
  query SupplierPriceHistory($goodId: ID!) {
    supplierPriceHistory(goodId: $goodId) { supplierId supplierName goodsReceiptId costPriceCents quantity receivedAt }
  }
`;

export async function goodsSupplierPriceHistory(token: string, ns: string, goodId: string): Promise<SupplierPriceHistoryEntry[]> {
  const dev = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ supplierPriceHistory: SupplierPriceHistoryEntry[] }>(PriceHistoryDocument, { goodId }, { headers: headers(token, ns, dev) });
    return res.supplierPriceHistory;
  }, ns);
}
