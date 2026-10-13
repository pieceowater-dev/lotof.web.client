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

export type GoodsStockMovement = {
  id: string; warehouseId: string; goodId: string; type: string; quantityDelta: number; quantityInUnit: number;
  beforeQty: number; afterQty: number; relatedDocumentType: string; relatedDocumentId?: string | null;
  actorId?: string | null; actorType: string; reason: string; createdAt: string;
};

const MovementsDocument = /* GraphQL */ `
  query StockMovements($warehouseId: ID, $goodId: ID, $filter: DefaultFilterInput) {
    stockMovements(warehouseId: $warehouseId, goodId: $goodId, filter: $filter) {
      rows { id warehouseId goodId type quantityDelta quantityInUnit beforeQty afterQty relatedDocumentType relatedDocumentId actorId actorType reason createdAt }
      info { count }
    }
  }
`;

/** The ledger of one good: every receipt, sale, write-off, transfer and count, newest first. */
export async function goodsListMovements(
  goodsToken: string,
  namespaceSlug: string,
  opts: { goodId: string; warehouseId?: string },
): Promise<{ movements: GoodsStockMovement[]; count: number }> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ stockMovements: { rows: GoodsStockMovement[]; info: { count: number } } }>(
      MovementsDocument,
      { warehouseId: opts.warehouseId, goodId: opts.goodId, filter: { pagination: { page: 1, length: 'ONE_HUNDRED' } } },
      { headers: { GoodsAuthorization: `Bearer ${goodsToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return { movements: res.stockMovements.rows, count: res.stockMovements.info.count };
  }, namespaceSlug);
}
