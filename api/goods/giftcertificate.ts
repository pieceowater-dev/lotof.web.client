import { goodsClient } from '@/api/clients';
import { goodsRequestWithRefresh } from '@/api/goods/goodsRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export type GoodsGiftCertificate = {
  id: string; code: string; initialBalanceCents: number; balanceCents: number; isActive: boolean;
  expiresAt?: string | null; issuedViaSaleId?: string | null; createdAt: string;
};

const GC_FIELDS = `id code initialBalanceCents balanceCents isActive expiresAt issuedViaSaleId createdAt`;

function headers(token: string, ns: string, dev: Record<string, string>) {
  return { GoodsAuthorization: `Bearer ${token}`, Namespace: ns, ...dev };
}

const ListDocument = /* GraphQL */ `
  query GiftCertificates($filter: DefaultFilterInput) {
    giftCertificates(filter: $filter) { rows { ${GC_FIELDS} } info { count } }
  }
`;

export async function goodsListGiftCertificates(token: string, ns: string): Promise<GoodsGiftCertificate[]> {
  const dev = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ giftCertificates: { rows: GoodsGiftCertificate[] } }>(
      ListDocument, { filter: { pagination: { page: 1, length: 'FIFTY' } } }, { headers: headers(token, ns, dev) }
    );
    return res.giftCertificates.rows;
  }, ns);
}

const IssueDocument = /* GraphQL */ `
  mutation IssueGiftCertificate($initialBalanceCents: Int!, $expiresAt: String) {
    issueGiftCertificate(initialBalanceCents: $initialBalanceCents, expiresAt: $expiresAt) { ${GC_FIELDS} }
  }
`;

export async function goodsIssueGiftCertificate(token: string, ns: string, initialBalanceCents: number, expiresAt?: string): Promise<GoodsGiftCertificate> {
  const dev = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ issueGiftCertificate: GoodsGiftCertificate }>(
      IssueDocument, { initialBalanceCents, expiresAt }, { headers: headers(token, ns, dev) }
    );
    return res.issueGiftCertificate;
  }, ns);
}

const GetByCodeDocument = /* GraphQL */ `query GiftCertificate($code: String!) { giftCertificate(code: $code) { ${GC_FIELDS} } }`;

export async function goodsGetGiftCertificateByCode(token: string, ns: string, code: string): Promise<GoodsGiftCertificate | null> {
  const dev = await getDeviceHeaders();
  return goodsRequestWithRefresh(async () => {
    const res = await goodsClient.request<{ giftCertificate: GoodsGiftCertificate | null }>(GetByCodeDocument, { code }, { headers: headers(token, ns, dev) });
    return res.giftCertificate;
  }, ns);
}
