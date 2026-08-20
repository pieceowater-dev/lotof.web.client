import { goodsClient } from '@/api/clients';
import { goodsRequestWithRefresh } from '@/api/goods/goodsRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export type GoodsInventoryCountStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED';
export type GoodsInventoryCountItem = { id: string; inventoryCountId: string; goodId: string; expectedQty: number; countedQty?: number | null; discrepancy: number };
export type GoodsInventoryCount = {
  id: string; warehouseId: string; status: GoodsInventoryCountStatus; startedBy: string; startedAt: string;
  completedAt?: string | null; items: GoodsInventoryCountItem[];
};

const COUNT_FIELDS = `id warehouseId status startedBy startedAt completedAt items { id inventoryCountId goodId expectedQty countedQty discrepancy }`;

function headers(token: string, ns: string, dev: Record<string, string>) {
  return { GoodsAuthorization: `Bearer ${token}`, Namespace: ns, ...dev };
}

const ListDocument = /* GraphQL */ `
  query InventoryCounts($warehouseId: ID, $filter: DefaultFilterInput) {
    inventoryCounts(warehouseId: $warehouseId, filter: $filter) { rows { ${COUNT_FIELDS} } info { count } }
  }
`;

export async function goodsListInventoryCounts(token: string, ns: string, warehouseId?: string): Promise<{ counts: GoodsInventoryCount[]; count: number }> {
  const dev = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ inventoryCounts: { rows: GoodsInventoryCount[]; info: { count: number } } }>(
      ListDocument, { warehouseId, filter: { pagination: { page: 1, length: 'FIFTY' } } }, { headers: headers(token, ns, dev) }
    );
    return { counts: res.inventoryCounts.rows, count: res.inventoryCounts.info.count };
  }, ns);
}

const StartDocument = /* GraphQL */ `mutation StartInventoryCount($warehouseId: ID!) { startInventoryCount(warehouseId: $warehouseId) { ${COUNT_FIELDS} } }`;

export async function goodsStartInventoryCount(token: string, ns: string, warehouseId: string): Promise<GoodsInventoryCount> {
  const dev = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ startInventoryCount: GoodsInventoryCount }>(StartDocument, { warehouseId }, { headers: headers(token, ns, dev) });
    return res.startInventoryCount;
  }, ns);
}

const SubmitDocument = /* GraphQL */ `
  mutation SubmitInventoryCount($inventoryCountId: ID!, $goodId: ID!, $countedQty: Float!) {
    submitInventoryCount(inventoryCountId: $inventoryCountId, goodId: $goodId, countedQty: $countedQty) {
      id inventoryCountId goodId expectedQty countedQty discrepancy
    }
  }
`;

export async function goodsSubmitInventoryCount(token: string, ns: string, inventoryCountId: string, goodId: string, countedQty: number): Promise<GoodsInventoryCountItem> {
  const dev = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ submitInventoryCount: GoodsInventoryCountItem }>(
      SubmitDocument, { inventoryCountId, goodId, countedQty }, { headers: headers(token, ns, dev) }
    );
    return res.submitInventoryCount;
  }, ns);
}

const CompleteDocument = /* GraphQL */ `mutation CompleteInventoryCount($id: ID!) { completeInventoryCount(id: $id) { ${COUNT_FIELDS} } }`;

export async function goodsCompleteInventoryCount(token: string, ns: string, id: string): Promise<GoodsInventoryCount> {
  const dev = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ completeInventoryCount: GoodsInventoryCount }>(CompleteDocument, { id }, { headers: headers(token, ns, dev) });
    return res.completeInventoryCount;
  }, ns);
}
