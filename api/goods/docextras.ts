import { goodsClient } from '@/api/clients';
import { goodsRequestWithRefresh } from '@/api/goods/goodsRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

// Unfinished receipt / supplier-return forms and files attached to warehouse documents.

export type GoodsDocType = 'GOODS_RECEIPT' | 'SUPPLIER_RETURN' | 'WRITE_OFF' | 'STOCK_TRANSFER' | 'INVENTORY_COUNT' | 'PURCHASE_ORDER';

export type GoodsDocDraft = {
  id: string;
  docType: 'GOODS_RECEIPT' | 'SUPPLIER_RETURN';
  title: string;
  payloadJson: string;
  warehouseId?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type GoodsDocAttachment = {
  id: string;
  docType: GoodsDocType;
  docId: string;
  name: string;
  url: string;
  contentType: string;
  size: number;
  createdBy: string;
  createdAt: string;
};

const DRAFT_FIELDS = 'id docType title payloadJson warehouseId createdBy createdAt updatedAt';
const ATTACHMENT_FIELDS = 'id docType docId name url contentType size createdBy createdAt';

async function run<T>(goodsToken: string, namespaceSlug: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const devHeaders = await getDeviceHeaders();
  return goodsRequestWithRefresh(
    () => goodsClient.request<T>(query, variables, { headers: { GoodsAuthorization: `Bearer ${goodsToken}`, Namespace: namespaceSlug, ...devHeaders } }),
    namespaceSlug,
  );
}

export async function goodsListDocDrafts(token: string, ns: string, docType?: GoodsDocDraft['docType']): Promise<GoodsDocDraft[]> {
  const res = await run<{ docDrafts: GoodsDocDraft[] }>(token, ns, `query DocDrafts($docType: String) { docDrafts(docType: $docType) { ${DRAFT_FIELDS} } }`, { docType: docType ?? null });
  return res.docDrafts;
}

export async function goodsSaveDocDraft(
  token: string,
  ns: string,
  input: { id?: string; docType: GoodsDocDraft['docType']; title?: string; payloadJson: string; warehouseId?: string },
): Promise<GoodsDocDraft> {
  const res = await run<{ saveDocDraft: GoodsDocDraft }>(
    token, ns,
    `mutation SaveDocDraft($input: SaveDocDraftInput!) { saveDocDraft(input: $input) { ${DRAFT_FIELDS} } }`,
    { input: { ...input, id: input.id || null, warehouseId: input.warehouseId || null } },
  );
  return res.saveDocDraft;
}

export async function goodsDeleteDocDraft(token: string, ns: string, id: string): Promise<void> {
  await run(token, ns, `mutation DeleteDocDraft($id: ID!) { deleteDocDraft(id: $id) }`, { id });
}

export async function goodsListDocAttachments(token: string, ns: string, docType: GoodsDocType, docId: string): Promise<GoodsDocAttachment[]> {
  const res = await run<{ docAttachments: GoodsDocAttachment[] }>(
    token, ns,
    `query DocAttachments($docType: String!, $docId: ID!) { docAttachments(docType: $docType, docId: $docId) { ${ATTACHMENT_FIELDS} } }`,
    { docType, docId },
  );
  return res.docAttachments;
}

export async function goodsAddDocAttachment(
  token: string,
  ns: string,
  input: { docType: GoodsDocType; docId: string; name: string; url: string; contentType?: string; size?: number },
): Promise<GoodsDocAttachment> {
  const res = await run<{ addDocAttachment: GoodsDocAttachment }>(
    token, ns,
    `mutation AddDocAttachment($input: AddDocAttachmentInput!) { addDocAttachment(input: $input) { ${ATTACHMENT_FIELDS} } }`,
    { input },
  );
  return res.addDocAttachment;
}

export async function goodsDeleteDocAttachment(token: string, ns: string, id: string): Promise<void> {
  await run(token, ns, `mutation DeleteDocAttachment($id: ID!) { deleteDocAttachment(id: $id) }`, { id });
}
