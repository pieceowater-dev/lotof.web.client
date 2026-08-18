import { goodsClient } from '@/api/clients';
import { goodsRequestWithRefresh } from '@/api/goods/goodsRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export type GoodsStockTransferStatus = 'DRAFT' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED';
export type GoodsStockTransferItem = { id: string; goodId: string; unitId: string; quantity: number };
export type GoodsStockTransfer = {
  id: string; fromWarehouseId: string; toWarehouseId: string; number: string; status: GoodsStockTransferStatus;
  createdBy: string; createdAt: string; items: GoodsStockTransferItem[];
};

const TRANSFER_FIELDS = `id fromWarehouseId toWarehouseId number status createdBy createdAt items { id goodId unitId quantity }`;

function headers(token: string, ns: string, dev: Record<string, string>) {
  return { GoodsAuthorization: `Bearer ${token}`, Namespace: ns, ...dev };
}

const ListDocument = /* GraphQL */ `
  query StockTransfers($warehouseId: ID, $filter: DefaultFilterInput) {
    stockTransfers(warehouseId: $warehouseId, filter: $filter) { rows { ${TRANSFER_FIELDS} } info { count } }
  }
`;

export async function goodsListStockTransfers(token: string, ns: string, warehouseId?: string): Promise<{ transfers: GoodsStockTransfer[]; count: number }> {
  const dev = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ stockTransfers: { rows: GoodsStockTransfer[]; info: { count: number } } }>(
      ListDocument, { warehouseId, filter: { pagination: { page: 1, length: 'FIFTY' } } }, { headers: headers(token, ns, dev) }
    );
    return { transfers: res.stockTransfers.rows, count: res.stockTransfers.info.count };
  }, ns);
}

const CreateDocument = /* GraphQL */ `
  mutation CreateStockTransfer($input: CreateStockTransferInput!) {
    createStockTransfer(input: $input) { ${TRANSFER_FIELDS} }
  }
`;

export type CreateStockTransferInput = {
  fromWarehouseId: string; toWarehouseId: string; items: { goodId: string; unitId: string; quantity: number }[];
};

export async function goodsCreateStockTransfer(token: string, ns: string, input: CreateStockTransferInput): Promise<GoodsStockTransfer> {
  const dev = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ createStockTransfer: GoodsStockTransfer }>(CreateDocument, { input }, { headers: headers(token, ns, dev) });
    return res.createStockTransfer;
  }, ns);
}

const SendDocument = /* GraphQL */ `mutation SendStockTransfer($id: ID!) { sendStockTransfer(id: $id) { ${TRANSFER_FIELDS} } }`;
const ReceiveDocument = /* GraphQL */ `mutation ReceiveStockTransfer($id: ID!) { receiveStockTransfer(id: $id) { ${TRANSFER_FIELDS} } }`;
const CancelDocument = /* GraphQL */ `mutation CancelStockTransfer($id: ID!) { cancelStockTransfer(id: $id) { ${TRANSFER_FIELDS} } }`;

export async function goodsSendStockTransfer(token: string, ns: string, id: string): Promise<GoodsStockTransfer> {
  const dev = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ sendStockTransfer: GoodsStockTransfer }>(SendDocument, { id }, { headers: headers(token, ns, dev) });
    return res.sendStockTransfer;
  }, ns);
}

export async function goodsReceiveStockTransfer(token: string, ns: string, id: string): Promise<GoodsStockTransfer> {
  const dev = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ receiveStockTransfer: GoodsStockTransfer }>(ReceiveDocument, { id }, { headers: headers(token, ns, dev) });
    return res.receiveStockTransfer;
  }, ns);
}

export async function goodsCancelStockTransfer(token: string, ns: string, id: string): Promise<GoodsStockTransfer> {
  const dev = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ cancelStockTransfer: GoodsStockTransfer }>(CancelDocument, { id }, { headers: headers(token, ns, dev) });
    return res.cancelStockTransfer;
  }, ns);
}
