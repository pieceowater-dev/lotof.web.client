import { goodsClient } from '@/api/clients';
import { goodsRequestWithRefresh } from '@/api/goods/goodsRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export type GoodsSettings = {
  currency: string;
  defaultWarehouseId?: string | null;
  maxCashierDiscountPercent: number;
  openSaleReservationTimeoutMinutes: number;
  receiptFooterText: string;
  barcodeLabelSize: string;
};

const GoodsSettingsDocument = /* GraphQL */ `
  query GoodsSettings {
    goodsSettings { currency defaultWarehouseId maxCashierDiscountPercent openSaleReservationTimeoutMinutes receiptFooterText barcodeLabelSize }
  }
`;

export async function goodsGetSettings(goodsToken: string, namespaceSlug: string): Promise<GoodsSettings> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ goodsSettings: GoodsSettings }>(
      GoodsSettingsDocument,
      {},
      { headers: { GoodsAuthorization: `Bearer ${goodsToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.goodsSettings;
  }, namespaceSlug);
}

const UpdateGoodsSettingsDocument = /* GraphQL */ `
  mutation UpdateGoodsSettings($input: UpdateGoodsSettingsInput!) {
    updateGoodsSettings(input: $input) { currency defaultWarehouseId maxCashierDiscountPercent openSaleReservationTimeoutMinutes receiptFooterText barcodeLabelSize }
  }
`;

export async function goodsUpdateSettings(goodsToken: string, namespaceSlug: string, input: GoodsSettings): Promise<GoodsSettings> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ updateGoodsSettings: GoodsSettings }>(
      UpdateGoodsSettingsDocument,
      { input },
      { headers: { GoodsAuthorization: `Bearer ${goodsToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.updateGoodsSettings;
  }, namespaceSlug);
}
