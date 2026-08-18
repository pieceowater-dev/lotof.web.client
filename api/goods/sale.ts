import { goodsClient } from '@/api/clients';
import { goodsRequestWithRefresh } from '@/api/goods/goodsRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export type GoodsSaleStatus = 'OPEN' | 'PAID' | 'VOID' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
export type GoodsPaymentMethod = 'CASH' | 'CARD' | 'MIXED' | 'OTHER' | 'GIFT_CERTIFICATE';

export type GoodsSaleItem = {
  id: string;
  goodId: string;
  unitId: string;
  quantity: number;
  priceAtSaleCents: number;
  discountRuleId?: string | null;
  discountCents: number;
  totalCents: number;
};

export type GoodsPayment = {
  id: string;
  saleId: string;
  method: GoodsPaymentMethod;
  amountCents: number;
  createdAt: string;
  giftCertificateCode?: string | null;
};

export type GoodsSale = {
  id: string;
  registerId: string;
  shiftId: string;
  warehouseId: string;
  number: string;
  status: GoodsSaleStatus;
  clientId?: string | null;
  subtotalCents: number;
  discountAmountCents: number;
  taxAmountCents: number;
  totalAmountCents: number;
  clientGeneratedId: string;
  createdBy: string;
  createdAt: string;
  closedAt?: string | null;
  items: GoodsSaleItem[];
  payments: GoodsPayment[];
};

const SALE_FIELDS = `
  id registerId shiftId warehouseId number status clientId subtotalCents discountAmountCents taxAmountCents totalAmountCents
  clientGeneratedId createdBy createdAt closedAt
  items { id goodId unitId quantity priceAtSaleCents discountRuleId discountCents totalCents }
  payments { id saleId method amountCents createdAt giftCertificateCode }
`;

function authHeaders(goodsToken: string, namespaceSlug: string, devHeaders: Record<string, string>) {
  return { GoodsAuthorization: `Bearer ${goodsToken}`, Namespace: namespaceSlug, ...devHeaders };
}

const CreateSaleDocument = /* GraphQL */ `
  mutation CreateSale($input: CreateSaleInput!) {
    createSale(input: $input) { ${SALE_FIELDS} }
  }
`;

export async function goodsCreateSale(
  goodsToken: string,
  namespaceSlug: string,
  input: { registerId: string; shiftId: string; warehouseId: string; clientGeneratedId: string; clientId?: string },
): Promise<GoodsSale> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ createSale: GoodsSale }>(
      CreateSaleDocument, { input }, { headers: authHeaders(goodsToken, namespaceSlug, devHeaders) }
    );
    return res.createSale;
  }, namespaceSlug);
}

const AddSaleItemDocument = /* GraphQL */ `
  mutation AddSaleItem($saleId: ID!, $goodId: ID!, $unitId: ID!, $quantity: Float!) {
    addSaleItem(saleId: $saleId, goodId: $goodId, unitId: $unitId, quantity: $quantity) { ${SALE_FIELDS} }
  }
`;

export async function goodsAddSaleItem(
  goodsToken: string, namespaceSlug: string, saleId: string, goodId: string, unitId: string, quantity: number,
): Promise<GoodsSale> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ addSaleItem: GoodsSale }>(
      AddSaleItemDocument, { saleId, goodId, unitId, quantity }, { headers: authHeaders(goodsToken, namespaceSlug, devHeaders) }
    );
    return res.addSaleItem;
  }, namespaceSlug);
}

const RemoveSaleItemDocument = /* GraphQL */ `
  mutation RemoveSaleItem($saleItemId: ID!) {
    removeSaleItem(saleItemId: $saleItemId) { ${SALE_FIELDS} }
  }
`;

export async function goodsRemoveSaleItem(goodsToken: string, namespaceSlug: string, saleItemId: string): Promise<GoodsSale> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ removeSaleItem: GoodsSale }>(
      RemoveSaleItemDocument, { saleItemId }, { headers: authHeaders(goodsToken, namespaceSlug, devHeaders) }
    );
    return res.removeSaleItem;
  }, namespaceSlug);
}

const UpdateSaleItemDocument = /* GraphQL */ `
  mutation UpdateSaleItem($saleItemId: ID!, $quantity: Float!, $discountRuleId: ID, $manualDiscountCents: Int, $managerPin: String) {
    updateSaleItem(saleItemId: $saleItemId, quantity: $quantity, discountRuleId: $discountRuleId, manualDiscountCents: $manualDiscountCents, managerPin: $managerPin) { ${SALE_FIELDS} }
  }
`;

export async function goodsUpdateSaleItem(
  goodsToken: string, namespaceSlug: string,
  args: { saleItemId: string; quantity: number; discountRuleId?: string; manualDiscountCents?: number; managerPin?: string },
): Promise<GoodsSale> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ updateSaleItem: GoodsSale }>(
      UpdateSaleItemDocument, args, { headers: authHeaders(goodsToken, namespaceSlug, devHeaders) }
    );
    return res.updateSaleItem;
  }, namespaceSlug);
}

const PaySaleDocument = /* GraphQL */ `
  mutation PaySale($saleId: ID!, $payments: [PaymentInput!]!) {
    paySale(saleId: $saleId, payments: $payments) { ${SALE_FIELDS} }
  }
`;

export type PaymentInput = { method: GoodsPaymentMethod; amountCents: number; giftCertificateCode?: string };

export async function goodsPaySale(goodsToken: string, namespaceSlug: string, saleId: string, payments: PaymentInput[]): Promise<GoodsSale> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ paySale: GoodsSale }>(
      PaySaleDocument, { saleId, payments }, { headers: authHeaders(goodsToken, namespaceSlug, devHeaders) }
    );
    return res.paySale;
  }, namespaceSlug);
}

const VoidSaleDocument = /* GraphQL */ `
  mutation VoidSale($saleId: ID!) {
    voidSale(saleId: $saleId) { ${SALE_FIELDS} }
  }
`;

export async function goodsVoidSale(goodsToken: string, namespaceSlug: string, saleId: string): Promise<GoodsSale> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ voidSale: GoodsSale }>(
      VoidSaleDocument, { saleId }, { headers: authHeaders(goodsToken, namespaceSlug, devHeaders) }
    );
    return res.voidSale;
  }, namespaceSlug);
}

const CancelPaidSaleDocument = /* GraphQL */ `
  mutation CancelPaidSale($saleId: ID!, $managerPin: String!) {
    cancelPaidSale(saleId: $saleId, managerPin: $managerPin) { ${SALE_FIELDS} }
  }
`;

export async function goodsCancelPaidSale(goodsToken: string, namespaceSlug: string, saleId: string, managerPin: string): Promise<GoodsSale> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ cancelPaidSale: GoodsSale }>(
      CancelPaidSaleDocument, { saleId, managerPin }, { headers: authHeaders(goodsToken, namespaceSlug, devHeaders) }
    );
    return res.cancelPaidSale;
  }, namespaceSlug);
}

const SalesListDocument = /* GraphQL */ `
  query Sales($registerId: ID, $shiftId: ID, $filter: DefaultFilterInput) {
    sales(registerId: $registerId, shiftId: $shiftId, filter: $filter) {
      rows { ${SALE_FIELDS} }
      info { count }
    }
  }
`;

export async function goodsListSales(
  goodsToken: string, namespaceSlug: string, opts?: { registerId?: string; shiftId?: string },
): Promise<{ sales: GoodsSale[]; count: number }> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ sales: { rows: GoodsSale[]; info: { count: number } } }>(
      SalesListDocument,
      { registerId: opts?.registerId, shiftId: opts?.shiftId, filter: { pagination: { page: 1, length: 'FIFTY' } } },
      { headers: authHeaders(goodsToken, namespaceSlug, devHeaders) }
    );
    return { sales: res.sales.rows, count: res.sales.info.count };
  }, namespaceSlug);
}

const GetSaleDocument = /* GraphQL */ `
  query GetSale($id: ID!) {
    sale(id: $id) { ${SALE_FIELDS} }
  }
`;

export async function goodsGetSale(goodsToken: string, namespaceSlug: string, id: string): Promise<GoodsSale | null> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ sale: GoodsSale | null }>(
      GetSaleDocument, { id }, { headers: authHeaders(goodsToken, namespaceSlug, devHeaders) }
    );
    return res.sale;
  }, namespaceSlug);
}
