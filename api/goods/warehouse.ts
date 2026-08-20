import { goodsClient } from '@/api/clients';
import { goodsRequestWithRefresh } from '@/api/goods/goodsRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export type GoodsWarehouseType = 'SHOP' | 'STORAGE' | 'BOTH';

export type GoodsWarehouse = {
  id: string;
  name: string;
  address: string;
  type: GoodsWarehouseType;
  isActive: boolean;
};

const WarehousesDocument = /* GraphQL */ `
  query Warehouses($filter: DefaultFilterInput) {
    warehouses(filter: $filter) {
      rows { id name address type isActive }
      info { count }
    }
  }
`;

export async function goodsListWarehouses(goodsToken: string, namespaceSlug: string): Promise<{ warehouses: GoodsWarehouse[]; count: number }> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ warehouses: { rows: GoodsWarehouse[]; info: { count: number } } }>(
      WarehousesDocument,
      { filter: { pagination: { page: 1, length: 'ONE_HUNDRED' } } },
      { headers: { GoodsAuthorization: `Bearer ${goodsToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return { warehouses: res.warehouses.rows, count: res.warehouses.info.count };
  }, namespaceSlug);
}

const CreateWarehouseDocument = /* GraphQL */ `
  mutation CreateWarehouse($input: CreateWarehouseInput!) {
    createWarehouse(input: $input) { id name address type isActive }
  }
`;

export async function goodsCreateWarehouse(
  goodsToken: string,
  namespaceSlug: string,
  input: { name: string; address: string; type: GoodsWarehouseType },
): Promise<GoodsWarehouse> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ createWarehouse: GoodsWarehouse }>(
      CreateWarehouseDocument,
      { input },
      { headers: { GoodsAuthorization: `Bearer ${goodsToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.createWarehouse;
  }, namespaceSlug);
}

const UpdateWarehouseDocument = /* GraphQL */ `
  mutation UpdateWarehouse($input: UpdateWarehouseInput!) {
    updateWarehouse(input: $input) { id name address type isActive }
  }
`;

export async function goodsUpdateWarehouse(
  goodsToken: string,
  namespaceSlug: string,
  input: { id: string; name: string; address: string; type: GoodsWarehouseType; isActive: boolean },
): Promise<GoodsWarehouse> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ updateWarehouse: GoodsWarehouse }>(
      UpdateWarehouseDocument,
      { input },
      { headers: { GoodsAuthorization: `Bearer ${goodsToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.updateWarehouse;
  }, namespaceSlug);
}
