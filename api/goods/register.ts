import { goodsClient } from '@/api/clients';
import { goodsRequestWithRefresh } from '@/api/goods/goodsRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export type GoodsRegister = {
  id: string;
  name: string;
  defaultWarehouseId: string;
  isMobile: boolean;
  receiptPrinterEnabled: boolean;
  isActive: boolean;
};

export type GoodsCashShiftStatus = 'OPEN' | 'CLOSED';

export type GoodsCashShift = {
  id: string;
  registerId: string;
  openedBy: string;
  openedAt: string;
  closedBy?: string | null;
  closedAt?: string | null;
  openingCashAmountCents: number;
  expectedCashAmountCents: number;
  closingCashAmountCents?: number | null;
  discrepancyCents: number;
  status: GoodsCashShiftStatus;
};

const RegistersDocument = /* GraphQL */ `
  query Registers($filter: DefaultFilterInput) {
    registers(filter: $filter) {
      rows { id name defaultWarehouseId isMobile receiptPrinterEnabled isActive }
      info { count }
    }
  }
`;

export async function goodsListRegisters(goodsToken: string, namespaceSlug: string): Promise<{ registers: GoodsRegister[]; count: number }> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ registers: { rows: GoodsRegister[]; info: { count: number } } }>(
      RegistersDocument,
      { filter: { pagination: { page: 1, length: 'ONE_HUNDRED' } } },
      { headers: { GoodsAuthorization: `Bearer ${goodsToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return { registers: res.registers.rows, count: res.registers.info.count };
  }, namespaceSlug);
}

const CreateRegisterDocument = /* GraphQL */ `
  mutation CreateRegister($input: CreateRegisterInput!) {
    createRegister(input: $input) { id name defaultWarehouseId isMobile receiptPrinterEnabled isActive }
  }
`;

export async function goodsCreateRegister(
  goodsToken: string,
  namespaceSlug: string,
  input: { name: string; defaultWarehouseId: string; isMobile: boolean; receiptPrinterEnabled: boolean },
): Promise<GoodsRegister> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ createRegister: GoodsRegister }>(
      CreateRegisterDocument,
      { input },
      { headers: { GoodsAuthorization: `Bearer ${goodsToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.createRegister;
  }, namespaceSlug);
}

const CurrentShiftDocument = /* GraphQL */ `
  query CurrentShift($registerId: ID!) {
    currentShift(registerId: $registerId) {
      id registerId openedBy openedAt closedBy closedAt openingCashAmountCents expectedCashAmountCents closingCashAmountCents discrepancyCents status
    }
  }
`;

export async function goodsCurrentShift(goodsToken: string, namespaceSlug: string, registerId: string): Promise<GoodsCashShift | null> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ currentShift: GoodsCashShift | null }>(
      CurrentShiftDocument,
      { registerId },
      { headers: { GoodsAuthorization: `Bearer ${goodsToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.currentShift;
  }, namespaceSlug);
}

const OpenShiftDocument = /* GraphQL */ `
  mutation OpenShift($registerId: ID!, $openingCashAmountCents: Int!) {
    openShift(registerId: $registerId, openingCashAmountCents: $openingCashAmountCents) {
      id registerId openedBy openedAt closedBy closedAt openingCashAmountCents expectedCashAmountCents closingCashAmountCents discrepancyCents status
    }
  }
`;

export async function goodsOpenShift(goodsToken: string, namespaceSlug: string, registerId: string, openingCashAmountCents: number): Promise<GoodsCashShift> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ openShift: GoodsCashShift }>(
      OpenShiftDocument,
      { registerId, openingCashAmountCents },
      { headers: { GoodsAuthorization: `Bearer ${goodsToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.openShift;
  }, namespaceSlug);
}

const CloseShiftDocument = /* GraphQL */ `
  mutation CloseShift($id: ID!, $closingCashAmountCents: Int!) {
    closeShift(id: $id, closingCashAmountCents: $closingCashAmountCents) {
      id registerId openedBy openedAt closedBy closedAt openingCashAmountCents expectedCashAmountCents closingCashAmountCents discrepancyCents status
    }
  }
`;

export async function goodsCloseShift(goodsToken: string, namespaceSlug: string, id: string, closingCashAmountCents: number): Promise<GoodsCashShift> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ closeShift: GoodsCashShift }>(
      CloseShiftDocument,
      { id, closingCashAmountCents },
      { headers: { GoodsAuthorization: `Bearer ${goodsToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.closeShift;
  }, namespaceSlug);
}
