import { goodsClient } from '@/api/clients';
import { goodsRequestWithRefresh } from '@/api/goods/goodsRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export type GoodsGoodUnit = {
  id: string;
  goodId: string;
  unitId: string;
  conversionToBase: number;
  barcode: string;
  isBase: boolean;
  isDefaultSaleUnit: boolean;
  isDefaultPurchaseUnit: boolean;
  priceOverrideCents?: number | null;
};

export type GoodsGood = {
  id: string;
  categoryId?: string | null;
  name: string;
  sku: string;
  baseUnitId: string;
  costPriceCents: number;
  salePriceCents: number;
  trackStock: boolean;
  isWeighted: boolean;
  imageUrl: string;
  isActive: boolean;
  units: GoodsGoodUnit[];
};

const GOOD_FIELDS = `
  id categoryId name sku baseUnitId costPriceCents salePriceCents trackStock isWeighted imageUrl isActive
  units { id goodId unitId conversionToBase barcode isBase isDefaultSaleUnit isDefaultPurchaseUnit priceOverrideCents }
`;

const GoodsDocument = /* GraphQL */ `
  query Goods($filter: DefaultFilterInput, $categoryId: ID, $search: String) {
    goods(filter: $filter, categoryId: $categoryId, search: $search) {
      rows { ${GOOD_FIELDS} }
      info { count }
    }
  }
`;

export async function goodsListGoods(
  goodsToken: string,
  namespaceSlug: string,
  opts?: { categoryId?: string; search?: string },
): Promise<{ goods: GoodsGood[]; count: number }> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ goods: { rows: GoodsGood[]; info: { count: number } } }>(
      GoodsDocument,
      { filter: { pagination: { page: 1, length: 'ONE_HUNDRED' } }, categoryId: opts?.categoryId, search: opts?.search },
      { headers: { GoodsAuthorization: `Bearer ${goodsToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return { goods: res.goods.rows, count: res.goods.info.count };
  }, namespaceSlug);
}

const FindGoodByBarcodeDocument = /* GraphQL */ `
  query FindGoodByBarcode($barcode: String!) {
    findGoodByBarcode(barcode: $barcode) {
      found
      weightedQuantityGrams
      good { ${GOOD_FIELDS} }
      unit { id goodId unitId conversionToBase barcode isBase isDefaultSaleUnit isDefaultPurchaseUnit priceOverrideCents }
    }
  }
`;

export type FindGoodByBarcodeResult = {
  found: boolean;
  weightedQuantityGrams?: number | null;
  good?: GoodsGood | null;
  unit?: GoodsGoodUnit | null;
};

export async function goodsFindByBarcode(goodsToken: string, namespaceSlug: string, barcode: string): Promise<FindGoodByBarcodeResult> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ findGoodByBarcode: FindGoodByBarcodeResult }>(
      FindGoodByBarcodeDocument,
      { barcode },
      { headers: { GoodsAuthorization: `Bearer ${goodsToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.findGoodByBarcode;
  }, namespaceSlug);
}

const CreateGoodDocument = /* GraphQL */ `
  mutation CreateGood($input: CreateGoodInput!) {
    createGood(input: $input) { ${GOOD_FIELDS} }
  }
`;

export type CreateGoodInput = {
  categoryId?: string;
  name: string;
  sku: string;
  baseUnitId: string;
  costPriceCents: number;
  salePriceCents: number;
  trackStock: boolean;
  isWeighted: boolean;
  imageUrl: string;
};

export async function goodsCreateGood(goodsToken: string, namespaceSlug: string, input: CreateGoodInput): Promise<GoodsGood> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ createGood: GoodsGood }>(
      CreateGoodDocument,
      { input },
      { headers: { GoodsAuthorization: `Bearer ${goodsToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.createGood;
  }, namespaceSlug);
}

const UpdateGoodDocument = /* GraphQL */ `
  mutation UpdateGood($input: UpdateGoodInput!) {
    updateGood(input: $input) { ${GOOD_FIELDS} }
  }
`;

export type UpdateGoodInput = {
  id: string; categoryId?: string; name: string; sku: string; baseUnitId: string;
  salePriceCents: number; trackStock: boolean; isWeighted: boolean; imageUrl: string; isActive: boolean;
};

export async function goodsUpdateGood(goodsToken: string, namespaceSlug: string, input: UpdateGoodInput): Promise<GoodsGood> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ updateGood: GoodsGood }>(
      UpdateGoodDocument, { input }, { headers: { GoodsAuthorization: `Bearer ${goodsToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.updateGood;
  }, namespaceSlug);
}

const DeleteGoodDocument = /* GraphQL */ `mutation DeleteGood($id: ID!) { deleteGood(id: $id) { success } }`;

export async function goodsDeleteGood(goodsToken: string, namespaceSlug: string, id: string): Promise<boolean> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ deleteGood: { success: boolean } }>(
      DeleteGoodDocument, { id }, { headers: { GoodsAuthorization: `Bearer ${goodsToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.deleteGood.success;
  }, namespaceSlug);
}

const CreateGoodUnitDocument = /* GraphQL */ `
  mutation CreateGoodUnit($input: CreateGoodUnitInput!) {
    createGoodUnit(input: $input) { id goodId unitId conversionToBase barcode isBase isDefaultSaleUnit isDefaultPurchaseUnit priceOverrideCents }
  }
`;

export type CreateGoodUnitInput = {
  goodId: string;
  unitId: string;
  conversionToBase: number;
  barcode: string;
  isDefaultSaleUnit: boolean;
  isDefaultPurchaseUnit: boolean;
  priceOverrideCents?: number;
};

export async function goodsCreateGoodUnit(goodsToken: string, namespaceSlug: string, input: CreateGoodUnitInput): Promise<GoodsGoodUnit> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ createGoodUnit: GoodsGoodUnit }>(
      CreateGoodUnitDocument,
      { input },
      { headers: { GoodsAuthorization: `Bearer ${goodsToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.createGoodUnit;
  }, namespaceSlug);
}

const GenerateBarcodeDocument = /* GraphQL */ `
  mutation GenerateBarcode($goodUnitId: ID!) {
    generateBarcode(goodUnitId: $goodUnitId) { id goodId unitId conversionToBase barcode isBase isDefaultSaleUnit isDefaultPurchaseUnit priceOverrideCents }
  }
`;

export async function goodsGenerateBarcode(goodsToken: string, namespaceSlug: string, goodUnitId: string): Promise<GoodsGoodUnit> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ generateBarcode: GoodsGoodUnit }>(
      GenerateBarcodeDocument,
      { goodUnitId },
      { headers: { GoodsAuthorization: `Bearer ${goodsToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.generateBarcode;
  }, namespaceSlug);
}
