import { goodsClient } from '@/api/clients';
import { goodsRequestWithRefresh } from '@/api/goods/goodsRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export type GoodsTopGoodsEntry = { goodId: string; goodName: string; quantitySold: number; revenueCents: number };
export type GoodsAbcClass = 'A' | 'B' | 'C';
export type GoodsAbcEntry = {
  goodId: string; goodName: string; revenueCents: number; revenueSharePercent: number; cumulativeSharePercent: number; class: GoodsAbcClass;
};
export type GoodsSalesByPeriodEntry = { periodStart: string; revenueCents: number; salesCount: number };
export type GoodsMarginEntry = { saleId: string; number: string; revenueCents: number; costCents: number; marginCents: number; marginPercent: number };
export type GoodsMarginReport = {
  totalRevenueCents: number; totalCostCents: number; totalMarginCents: number; totalMarginPercent: number; entries: GoodsMarginEntry[];
};

function headers(token: string, ns: string, dev: Record<string, string>) {
  return { GoodsAuthorization: `Bearer ${token}`, Namespace: ns, ...dev };
}

const TopGoodsDocument = /* GraphQL */ `
  query TopGoods($warehouseId: ID, $from: String!, $to: String!, $limit: Int) {
    topGoods(warehouseId: $warehouseId, from: $from, to: $to, limit: $limit) { goodId goodName quantitySold revenueCents }
  }
`;

export async function goodsTopGoods(token: string, ns: string, from: string, to: string, warehouseId?: string, limit = 20): Promise<GoodsTopGoodsEntry[]> {
  const dev = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ topGoods: GoodsTopGoodsEntry[] }>(TopGoodsDocument, { warehouseId, from, to, limit }, { headers: headers(token, ns, dev) });
    return res.topGoods;
  }, ns);
}

const AbcDocument = /* GraphQL */ `
  query AbcAnalysis($warehouseId: ID, $from: String!, $to: String!) {
    abcAnalysis(warehouseId: $warehouseId, from: $from, to: $to) { goodId goodName revenueCents revenueSharePercent cumulativeSharePercent class }
  }
`;

export async function goodsAbcAnalysis(token: string, ns: string, from: string, to: string, warehouseId?: string): Promise<GoodsAbcEntry[]> {
  const dev = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ abcAnalysis: GoodsAbcEntry[] }>(AbcDocument, { warehouseId, from, to }, { headers: headers(token, ns, dev) });
    return res.abcAnalysis;
  }, ns);
}

const SalesByPeriodDocument = /* GraphQL */ `
  query SalesByPeriod($warehouseId: ID, $from: String!, $to: String!, $granularity: PeriodGranularityEnum!) {
    salesByPeriod(warehouseId: $warehouseId, from: $from, to: $to, granularity: $granularity) { periodStart revenueCents salesCount }
  }
`;

export async function goodsSalesByPeriod(token: string, ns: string, from: string, to: string, granularity: 'HOUR' | 'DAY', warehouseId?: string): Promise<GoodsSalesByPeriodEntry[]> {
  const dev = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ salesByPeriod: GoodsSalesByPeriodEntry[] }>(
      SalesByPeriodDocument, { warehouseId, from, to, granularity }, { headers: headers(token, ns, dev) }
    );
    return res.salesByPeriod;
  }, ns);
}

const MarginDocument = /* GraphQL */ `
  query MarginReport($warehouseId: ID, $from: String!, $to: String!) {
    marginReport(warehouseId: $warehouseId, from: $from, to: $to) {
      totalRevenueCents totalCostCents totalMarginCents totalMarginPercent
      entries { saleId number revenueCents costCents marginCents marginPercent }
    }
  }
`;

export async function goodsMarginReport(token: string, ns: string, from: string, to: string, warehouseId?: string): Promise<GoodsMarginReport> {
  const dev = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ marginReport: GoodsMarginReport }>(MarginDocument, { warehouseId, from, to }, { headers: headers(token, ns, dev) });
    return res.marginReport;
  }, ns);
}
