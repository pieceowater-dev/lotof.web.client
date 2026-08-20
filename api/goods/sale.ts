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

const ApplyCheckDiscountDocument = /* GraphQL */ `
  mutation ApplyCheckDiscount($saleId: ID!, $discountRuleId: ID, $manualDiscountCents: Int, $managerPin: String) {
    applyCheckDiscount(saleId: $saleId, discountRuleId: $discountRuleId, manualDiscountCents: $manualDiscountCents, managerPin: $managerPin) { ${SALE_FIELDS} }
  }
`;

export async function goodsApplyCheckDiscount(
  goodsToken: string, namespaceSlug: string,
  args: { saleId: string; discountRuleId?: string; manualDiscountCents?: number; managerPin?: string },
): Promise<GoodsSale> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ applyCheckDiscount: GoodsSale }>(
      ApplyCheckDiscountDocument, args, { headers: authHeaders(goodsToken, namespaceSlug, devHeaders) }
    );
    return res.applyCheckDiscount;
  }, namespaceSlug);
}

// --- Discount rules ---
export type GoodsDiscountType = 'PERCENT' | 'FIXED';
export type GoodsDiscountScope = 'GOOD' | 'CATEGORY' | 'CHECK';

export type GoodsDiscountRule = {
  id: string;
  name: string;
  type: GoodsDiscountType;
  scope: GoodsDiscountScope;
  value: number;
  minCheckAmountCents?: number | null;
  validFrom?: string | null;
  validTo?: string | null;
  isActive: boolean;
};

const DISCOUNT_RULE_FIELDS = `id name type scope value minCheckAmountCents validFrom validTo isActive`;

const ListDiscountRulesDocument = /* GraphQL */ `
  query DiscountRules($filter: DefaultFilterInput) {
    discountRules(filter: $filter) { rows { ${DISCOUNT_RULE_FIELDS} } info { count } }
  }
`;

export async function goodsListDiscountRules(goodsToken: string, namespaceSlug: string): Promise<GoodsDiscountRule[]> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ discountRules: { rows: GoodsDiscountRule[] } }>(
      ListDiscountRulesDocument, { filter: { pagination: { page: 1, length: 'ONE_HUNDRED' } } }, { headers: authHeaders(goodsToken, namespaceSlug, devHeaders) }
    );
    return res.discountRules.rows;
  }, namespaceSlug);
}

const CreateDiscountRuleDocument = /* GraphQL */ `
  mutation CreateDiscountRule($input: CreateDiscountRuleInput!) {
    createDiscountRule(input: $input) { ${DISCOUNT_RULE_FIELDS} }
  }
`;

export type CreateDiscountRuleInput = {
  name: string; type: GoodsDiscountType; scope: GoodsDiscountScope; value: number;
  minCheckAmountCents?: number; validFrom?: string; validTo?: string;
};

export async function goodsCreateDiscountRule(goodsToken: string, namespaceSlug: string, input: CreateDiscountRuleInput): Promise<GoodsDiscountRule> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ createDiscountRule: GoodsDiscountRule }>(
      CreateDiscountRuleDocument, { input }, { headers: authHeaders(goodsToken, namespaceSlug, devHeaders) }
    );
    return res.createDiscountRule;
  }, namespaceSlug);
}

const UpdateDiscountRuleDocument = /* GraphQL */ `
  mutation UpdateDiscountRule($input: UpdateDiscountRuleInput!) {
    updateDiscountRule(input: $input) { ${DISCOUNT_RULE_FIELDS} }
  }
`;

export type UpdateDiscountRuleInput = {
  id: string; name: string; value: number; minCheckAmountCents?: number; validFrom?: string; validTo?: string; isActive: boolean;
};

export async function goodsUpdateDiscountRule(goodsToken: string, namespaceSlug: string, input: UpdateDiscountRuleInput): Promise<GoodsDiscountRule> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ updateDiscountRule: GoodsDiscountRule }>(
      UpdateDiscountRuleDocument, { input }, { headers: authHeaders(goodsToken, namespaceSlug, devHeaders) }
    );
    return res.updateDiscountRule;
  }, namespaceSlug);
}

const DeleteDiscountRuleDocument = /* GraphQL */ `mutation DeleteDiscountRule($id: ID!) { deleteDiscountRule(id: $id) { success } }`;

export async function goodsDeleteDiscountRule(goodsToken: string, namespaceSlug: string, id: string): Promise<boolean> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ deleteDiscountRule: { success: boolean } }>(
      DeleteDiscountRuleDocument, { id }, { headers: authHeaders(goodsToken, namespaceSlug, devHeaders) }
    );
    return res.deleteDiscountRule.success;
  }, namespaceSlug);
}

// --- Cash movements (инкассация) ---
export type GoodsCashMovementType = 'SALE' | 'REFUND' | 'CASH_IN' | 'CASH_OUT';

export type GoodsCashMovement = {
  id: string; registerId: string; shiftId: string; type: GoodsCashMovementType;
  amountCents: number; reason: string; actorId: string; createdAt: string;
};

const CASH_MOVEMENT_FIELDS = `id registerId shiftId type amountCents reason actorId createdAt`;

const ListCashMovementsDocument = /* GraphQL */ `
  query CashMovements($shiftId: ID!, $filter: DefaultFilterInput) {
    cashMovements(shiftId: $shiftId, filter: $filter) { rows { ${CASH_MOVEMENT_FIELDS} } info { count } }
  }
`;

export async function goodsListCashMovements(goodsToken: string, namespaceSlug: string, shiftId: string): Promise<GoodsCashMovement[]> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ cashMovements: { rows: GoodsCashMovement[] } }>(
      ListCashMovementsDocument, { shiftId, filter: { pagination: { page: 1, length: 'ONE_HUNDRED' } } }, { headers: authHeaders(goodsToken, namespaceSlug, devHeaders) }
    );
    return res.cashMovements.rows;
  }, namespaceSlug);
}

const RecordCashMovementDocument = /* GraphQL */ `
  mutation RecordCashMovement($input: RecordCashMovementInput!) {
    recordCashMovement(input: $input) { ${CASH_MOVEMENT_FIELDS} }
  }
`;

export async function goodsRecordCashMovement(
  goodsToken: string, namespaceSlug: string,
  input: { registerId: string; shiftId: string; type: 'CASH_IN' | 'CASH_OUT'; amountCents: number; reason: string },
): Promise<GoodsCashMovement> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ recordCashMovement: GoodsCashMovement }>(
      RecordCashMovementDocument, { input }, { headers: authHeaders(goodsToken, namespaceSlug, devHeaders) }
    );
    return res.recordCashMovement;
  }, namespaceSlug);
}

// --- Returns ---
export type GoodsReturnItem = { id: string; goodId: string; quantity: number; amountCents: number };

export type GoodsReturn = {
  id: string; registerId: string; shiftId: string; originalSaleId?: string | null; isConfirmed: boolean;
  reason: string; refundedAmountCents: number; actorId: string; createdAt: string; items: GoodsReturnItem[];
};

const RETURN_FIELDS = `id registerId shiftId originalSaleId isConfirmed reason refundedAmountCents actorId createdAt items { id goodId quantity amountCents }`;

const ListReturnsDocument = /* GraphQL */ `
  query Returns($registerId: ID, $shiftId: ID, $filter: DefaultFilterInput) {
    returns(registerId: $registerId, shiftId: $shiftId, filter: $filter) { rows { ${RETURN_FIELDS} } info { count } }
  }
`;

export async function goodsListReturns(goodsToken: string, namespaceSlug: string, opts?: { registerId?: string; shiftId?: string }): Promise<GoodsReturn[]> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ returns: { rows: GoodsReturn[] } }>(
      ListReturnsDocument, { registerId: opts?.registerId, shiftId: opts?.shiftId, filter: { pagination: { page: 1, length: 'FIFTY' } } }, { headers: authHeaders(goodsToken, namespaceSlug, devHeaders) }
    );
    return res.returns.rows;
  }, namespaceSlug);
}

const CreateReturnDocument = /* GraphQL */ `
  mutation CreateReturn($input: CreateReturnInput!) {
    createReturn(input: $input) { ${RETURN_FIELDS} }
  }
`;

export type CreateReturnInput = {
  registerId: string; shiftId: string; originalSaleId?: string; reason: string;
  items: { goodId: string; quantity: number; amountCents: number }[]; managerPin?: string;
};

export async function goodsCreateReturn(goodsToken: string, namespaceSlug: string, input: CreateReturnInput): Promise<GoodsReturn> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ createReturn: GoodsReturn }>(
      CreateReturnDocument, { input }, { headers: authHeaders(goodsToken, namespaceSlug, devHeaders) }
    );
    return res.createReturn;
  }, namespaceSlug);
}
