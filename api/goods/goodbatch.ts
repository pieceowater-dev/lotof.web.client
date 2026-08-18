import { goodsClient } from '@/api/clients';
import { goodsRequestWithRefresh } from '@/api/goods/goodsRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export type GoodsBatch = {
  id: string; goodId: string; warehouseId: string; goodsReceiptId?: string | null;
  batchNumber?: string | null; expiryDate?: string | null; quantityReceived: number; receivedAt: string;
};

function headers(token: string, ns: string, dev: Record<string, string>) {
  return { GoodsAuthorization: `Bearer ${token}`, Namespace: ns, ...dev };
}

const BATCH_FIELDS = `id goodId warehouseId goodsReceiptId batchNumber expiryDate quantityReceived receivedAt`;

const ExpiringDocument = /* GraphQL */ `
  query ExpiringGoodBatches($warehouseId: ID, $withinDays: Int) {
    expiringGoodBatches(warehouseId: $warehouseId, withinDays: $withinDays) { ${BATCH_FIELDS} }
  }
`;

export async function goodsListExpiringBatches(token: string, ns: string, warehouseId?: string, withinDays = 14): Promise<GoodsBatch[]> {
  const dev = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ expiringGoodBatches: GoodsBatch[] }>(ExpiringDocument, { warehouseId, withinDays }, { headers: headers(token, ns, dev) });
    return res.expiringGoodBatches;
  }, ns);
}

const ListDocument = /* GraphQL */ `
  query GoodBatches($goodId: ID, $warehouseId: ID, $filter: DefaultFilterInput) {
    goodBatches(goodId: $goodId, warehouseId: $warehouseId, filter: $filter) { rows { ${BATCH_FIELDS} } info { count } }
  }
`;

export async function goodsListBatches(token: string, ns: string, opts?: { goodId?: string; warehouseId?: string }): Promise<GoodsBatch[]> {
  const dev = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ goodBatches: { rows: GoodsBatch[] } }>(
      ListDocument, { goodId: opts?.goodId, warehouseId: opts?.warehouseId, filter: { pagination: { page: 1, length: 'ONE_HUNDRED' } } }, { headers: headers(token, ns, dev) }
    );
    return res.goodBatches.rows;
  }, ns);
}
