import { goodsClient } from '@/api/clients';
import { goodsRequestWithRefresh } from '@/api/goods/goodsRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export type GoodsLowStockThreshold = { id: string; goodId: string; warehouseId?: string | null; thresholdQty: number };

function headers(token: string, ns: string, dev: Record<string, string>) {
  return { GoodsAuthorization: `Bearer ${token}`, Namespace: ns, ...dev };
}

const ListDocument = /* GraphQL */ `
  query LowStockThresholds($warehouseId: ID, $filter: DefaultFilterInput) {
    lowStockThresholds(warehouseId: $warehouseId, filter: $filter) { rows { id goodId warehouseId thresholdQty } info { count } }
  }
`;

export async function goodsListLowStockThresholds(token: string, ns: string, warehouseId?: string): Promise<GoodsLowStockThreshold[]> {
  const dev = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ lowStockThresholds: { rows: GoodsLowStockThreshold[] } }>(
      ListDocument, { warehouseId, filter: { pagination: { page: 1, length: 'ONE_HUNDRED' } } }, { headers: headers(token, ns, dev) }
    );
    return res.lowStockThresholds.rows;
  }, ns);
}

const SetDocument = /* GraphQL */ `
  mutation SetLowStockThreshold($input: SetLowStockThresholdInput!) {
    setLowStockThreshold(input: $input) { id goodId warehouseId thresholdQty }
  }
`;

export async function goodsSetLowStockThreshold(token: string, ns: string, goodId: string, thresholdQty: number, warehouseId?: string): Promise<GoodsLowStockThreshold> {
  const dev = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ setLowStockThreshold: GoodsLowStockThreshold }>(
      SetDocument, { input: { goodId, thresholdQty, warehouseId } }, { headers: headers(token, ns, dev) }
    );
    return res.setLowStockThreshold;
  }, ns);
}

const DeleteDocument = /* GraphQL */ `mutation DeleteLowStockThreshold($id: ID!) { deleteLowStockThreshold(id: $id) { success } }`;

export async function goodsDeleteLowStockThreshold(token: string, ns: string, id: string): Promise<boolean> {
  const dev = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ deleteLowStockThreshold: { success: boolean } }>(DeleteDocument, { id }, { headers: headers(token, ns, dev) });
    return res.deleteLowStockThreshold.success;
  }, ns);
}
