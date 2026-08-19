import { goodsClient } from '@/api/clients';
import { goodsRequestWithRefresh } from '@/api/goods/goodsRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export type GoodsUnit = {
  id: string;
  name: string;
  symbol: string;
  isActive: boolean;
};

const UnitsDocument = /* GraphQL */ `
  query Units($filter: DefaultFilterInput) {
    units(filter: $filter) {
      rows { id name symbol isActive }
      info { count }
    }
  }
`;

export async function goodsListUnits(goodsToken: string, namespaceSlug: string): Promise<{ units: GoodsUnit[]; count: number }> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ units: { rows: GoodsUnit[]; info: { count: number } } }>(
      UnitsDocument,
      { filter: { pagination: { page: 1, length: 'ONE_HUNDRED' } } },
      { headers: { GoodsAuthorization: `Bearer ${goodsToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return { units: res.units.rows, count: res.units.info.count };
  }, namespaceSlug);
}

const CreateUnitDocument = /* GraphQL */ `
  mutation CreateUnit($input: CreateUnitInput!) { createUnit(input: $input) { id name symbol isActive } }
`;

export async function goodsCreateUnit(goodsToken: string, namespaceSlug: string, input: { name: string; symbol: string }): Promise<GoodsUnit> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ createUnit: GoodsUnit }>(
      CreateUnitDocument, { input }, { headers: { GoodsAuthorization: `Bearer ${goodsToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.createUnit;
  }, namespaceSlug);
}

const UpdateUnitDocument = /* GraphQL */ `
  mutation UpdateUnit($input: UpdateUnitInput!) { updateUnit(input: $input) { id name symbol isActive } }
`;

export async function goodsUpdateUnit(
  goodsToken: string, namespaceSlug: string, input: { id: string; name: string; symbol: string; isActive: boolean },
): Promise<GoodsUnit> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ updateUnit: GoodsUnit }>(
      UpdateUnitDocument, { input }, { headers: { GoodsAuthorization: `Bearer ${goodsToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.updateUnit;
  }, namespaceSlug);
}

const DeleteUnitDocument = /* GraphQL */ `mutation DeleteUnit($id: ID!) { deleteUnit(id: $id) { success } }`;

export async function goodsDeleteUnit(goodsToken: string, namespaceSlug: string, id: string): Promise<boolean> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ deleteUnit: { success: boolean } }>(
      DeleteUnitDocument, { id }, { headers: { GoodsAuthorization: `Bearer ${goodsToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.deleteUnit.success;
  }, namespaceSlug);
}

const SeedDefaultUnitsDocument = /* GraphQL */ `
  mutation SeedDefaultUnits {
    seedDefaultUnits { id name symbol isActive }
  }
`;

// Seeds a starter set of units (pcs/kg/liter/etc.) -- offered during
// onboarding so a fresh tenant isn't stuck creating every unit by hand.
export async function goodsSeedDefaultUnits(goodsToken: string, namespaceSlug: string): Promise<GoodsUnit[]> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ seedDefaultUnits: GoodsUnit[] }>(
      SeedDefaultUnitsDocument,
      {},
      { headers: { GoodsAuthorization: `Bearer ${goodsToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.seedDefaultUnits;
  }, namespaceSlug);
}
