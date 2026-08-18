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
