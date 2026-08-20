import { goodsClient } from '@/api/clients';
import { goodsRequestWithRefresh } from '@/api/goods/goodsRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export type GoodsStock = {
  warehouseId: string;
  goodId: string;
  quantity: number;
  reservedQuantity: number;
  available: number;
};

const StockListDocument = /* GraphQL */ `
  query StockList($warehouseId: ID, $lowStockOnly: Boolean, $filter: DefaultFilterInput) {
    stockList(warehouseId: $warehouseId, lowStockOnly: $lowStockOnly, filter: $filter) {
      rows { warehouseId goodId quantity reservedQuantity available }
      info { count }
    }
  }
`;

export async function goodsListStock(
  goodsToken: string,
  namespaceSlug: string,
  opts?: { warehouseId?: string; lowStockOnly?: boolean },
): Promise<{ stock: GoodsStock[]; count: number }> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ stockList: { rows: GoodsStock[]; info: { count: number } } }>(
      StockListDocument,
      { warehouseId: opts?.warehouseId, lowStockOnly: opts?.lowStockOnly, filter: { pagination: { page: 1, length: 'ONE_HUNDRED' } } },
      { headers: { GoodsAuthorization: `Bearer ${goodsToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return { stock: res.stockList.rows, count: res.stockList.info.count };
  }, namespaceSlug);
}
