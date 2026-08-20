import { goodsClient } from '@/api/clients';
import { goodsRequestWithRefresh } from '@/api/goods/goodsRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export type GoodsSupplier = {
  id: string; name: string; phone: string; contactPerson: string; identity: string;
  contactsClientId?: string | null; isActive: boolean;
};

const SUPPLIER_FIELDS = `id name phone contactPerson identity contactsClientId isActive`;

function headers(token: string, ns: string, dev: Record<string, string>) {
  return { GoodsAuthorization: `Bearer ${token}`, Namespace: ns, ...dev };
}

const ListDocument = /* GraphQL */ `
  query Suppliers($filter: DefaultFilterInput, $search: String) {
    suppliers(filter: $filter, search: $search) { rows { ${SUPPLIER_FIELDS} } info { count } }
  }
`;

export async function goodsListSuppliers(token: string, ns: string, search?: string): Promise<{ suppliers: GoodsSupplier[]; count: number }> {
  const dev = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ suppliers: { rows: GoodsSupplier[]; info: { count: number } } }>(
      ListDocument, { filter: { pagination: { page: 1, length: 'ONE_HUNDRED' } }, search }, { headers: headers(token, ns, dev) }
    );
    return { suppliers: res.suppliers.rows, count: res.suppliers.info.count };
  }, ns);
}

const CreateDocument = /* GraphQL */ `
  mutation CreateSupplier($input: CreateSupplierInput!) {
    createSupplier(input: $input) { ${SUPPLIER_FIELDS} }
  }
`;

export type CreateSupplierInput = { name: string; phone: string; contactPerson: string; identity: string; contactsClientId?: string };

export async function goodsCreateSupplier(token: string, ns: string, input: CreateSupplierInput): Promise<GoodsSupplier> {
  const dev = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ createSupplier: GoodsSupplier }>(CreateDocument, { input }, { headers: headers(token, ns, dev) });
    return res.createSupplier;
  }, ns);
}

const UpdateDocument = /* GraphQL */ `
  mutation UpdateSupplier($input: UpdateSupplierInput!) {
    updateSupplier(input: $input) { ${SUPPLIER_FIELDS} }
  }
`;

export type UpdateSupplierInput = GoodsSupplier;

export async function goodsUpdateSupplier(token: string, ns: string, input: UpdateSupplierInput): Promise<GoodsSupplier> {
  const dev = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ updateSupplier: GoodsSupplier }>(UpdateDocument, { input }, { headers: headers(token, ns, dev) });
    return res.updateSupplier;
  }, ns);
}

const DeleteDocument = /* GraphQL */ `mutation DeleteSupplier($id: ID!) { deleteSupplier(id: $id) { success } }`;

export async function goodsDeleteSupplier(token: string, ns: string, id: string): Promise<boolean> {
  const dev = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ deleteSupplier: { success: boolean } }>(DeleteDocument, { id }, { headers: headers(token, ns, dev) });
    return res.deleteSupplier.success;
  }, ns);
}
