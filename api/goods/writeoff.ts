import { goodsClient } from '@/api/clients';
import { goodsRequestWithRefresh } from '@/api/goods/goodsRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export type GoodsWriteOffReason = 'DAMAGE' | 'EXPIRED' | 'LOST' | 'OTHER';
export type GoodsWriteOffItem = { id: string; goodId: string; unitId: string; quantity: number };
export type GoodsWriteOff = {
  id: string; warehouseId: string; reason: GoodsWriteOffReason; number: string; createdBy: string; createdAt: string;
  items: GoodsWriteOffItem[];
};

const WRITEOFF_FIELDS = `id warehouseId reason number createdBy createdAt items { id goodId unitId quantity }`;

function headers(token: string, ns: string, dev: Record<string, string>) {
  return { GoodsAuthorization: `Bearer ${token}`, Namespace: ns, ...dev };
}

const ListDocument = /* GraphQL */ `
  query WriteOffs($warehouseId: ID, $filter: DefaultFilterInput) {
    writeOffs(warehouseId: $warehouseId, filter: $filter) { rows { ${WRITEOFF_FIELDS} } info { count } }
  }
`;

export async function goodsListWriteOffs(token: string, ns: string, warehouseId?: string): Promise<{ writeOffs: GoodsWriteOff[]; count: number }> {
  const dev = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ writeOffs: { rows: GoodsWriteOff[]; info: { count: number } } }>(
      ListDocument, { warehouseId, filter: { pagination: { page: 1, length: 'FIFTY' } } }, { headers: headers(token, ns, dev) }
    );
    return { writeOffs: res.writeOffs.rows, count: res.writeOffs.info.count };
  }, ns);
}

const CreateDocument = /* GraphQL */ `
  mutation CreateWriteOff($input: CreateWriteOffInput!) {
    createWriteOff(input: $input) { ${WRITEOFF_FIELDS} }
  }
`;

export type CreateWriteOffInput = { warehouseId: string; reason: GoodsWriteOffReason; items: { goodId: string; unitId: string; quantity: number }[] };

export async function goodsCreateWriteOff(token: string, ns: string, input: CreateWriteOffInput): Promise<GoodsWriteOff> {
  const dev = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ createWriteOff: GoodsWriteOff }>(CreateDocument, { input }, { headers: headers(token, ns, dev) });
    return res.createWriteOff;
  }, ns);
}
