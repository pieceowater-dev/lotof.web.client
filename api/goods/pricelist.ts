import { goodsClient } from '@/api/clients';
import { goodsRequestWithRefresh } from '@/api/goods/goodsRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export type GoodsPriceListType = 'RETAIL' | 'WHOLESALE' | 'CLIENT';
export type GoodsPriceListItem = { id: string; priceListId: string; goodId: string; priceCents: number };
export type GoodsPriceList = { id: string; name: string; type: GoodsPriceListType; clientId?: string | null; isActive: boolean; items: GoodsPriceListItem[] };

const PL_FIELDS = `id name type clientId isActive items { id priceListId goodId priceCents }`;

function headers(token: string, ns: string, dev: Record<string, string>) {
  return { GoodsAuthorization: `Bearer ${token}`, Namespace: ns, ...dev };
}

const ListDocument = /* GraphQL */ `
  query PriceLists($type: PriceListTypeEnum, $filter: DefaultFilterInput) {
    priceLists(type: $type, filter: $filter) { rows { ${PL_FIELDS} } info { count } }
  }
`;

export async function goodsListPriceLists(token: string, ns: string): Promise<GoodsPriceList[]> {
  const dev = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ priceLists: { rows: GoodsPriceList[] } }>(
      ListDocument, { filter: { pagination: { page: 1, length: 'ONE_HUNDRED' } } }, { headers: headers(token, ns, dev) }
    );
    return res.priceLists.rows;
  }, ns);
}

const CreateDocument = /* GraphQL */ `
  mutation CreatePriceList($input: CreatePriceListInput!) {
    createPriceList(input: $input) { ${PL_FIELDS} }
  }
`;

export async function goodsCreatePriceList(token: string, ns: string, name: string, type: GoodsPriceListType, clientId?: string): Promise<GoodsPriceList> {
  const dev = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ createPriceList: GoodsPriceList }>(CreateDocument, { input: { name, type, clientId } }, { headers: headers(token, ns, dev) });
    return res.createPriceList;
  }, ns);
}

const DeleteDocument = /* GraphQL */ `mutation DeletePriceList($id: ID!) { deletePriceList(id: $id) { success } }`;

export async function goodsDeletePriceList(token: string, ns: string, id: string): Promise<boolean> {
  const dev = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ deletePriceList: { success: boolean } }>(DeleteDocument, { id }, { headers: headers(token, ns, dev) });
    return res.deletePriceList.success;
  }, ns);
}

const SetItemDocument = /* GraphQL */ `
  mutation SetPriceListItem($priceListId: ID!, $goodId: ID!, $priceCents: Int!) {
    setPriceListItem(priceListId: $priceListId, goodId: $goodId, priceCents: $priceCents) { id priceListId goodId priceCents }
  }
`;

export async function goodsSetPriceListItem(token: string, ns: string, priceListId: string, goodId: string, priceCents: number): Promise<GoodsPriceListItem> {
  const dev = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ setPriceListItem: GoodsPriceListItem }>(SetItemDocument, { priceListId, goodId, priceCents }, { headers: headers(token, ns, dev) });
    return res.setPriceListItem;
  }, ns);
}

const RemoveItemDocument = /* GraphQL */ `
  mutation RemovePriceListItem($priceListId: ID!, $goodId: ID!) { removePriceListItem(priceListId: $priceListId, goodId: $goodId) { success } }
`;

export async function goodsRemovePriceListItem(token: string, ns: string, priceListId: string, goodId: string): Promise<boolean> {
  const dev = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ removePriceListItem: { success: boolean } }>(RemoveItemDocument, { priceListId, goodId }, { headers: headers(token, ns, dev) });
    return res.removePriceListItem.success;
  }, ns);
}
