import { atraceClient } from '@/api/clients';


const QrGenDocument = /* GraphQL */ `
  query QrGen($input: QRGenInput!) {
    qrGen(input: $input) { qr postTitle postFullAddress }
  }
`;

export type QrGenResult = {
  qr: string;
  postTitle?: string;
  postFullAddress?: string;
};

export async function qrGenPublic(
  postId: string,
  method: string,
  secret: string,
  namespaceSlug: string
): Promise<QrGenResult | null> {
  // Pass namespaceSlug and secret in input
  const res = await atraceClient.request<{ qrGen: QrGenResult }>(
    QrGenDocument,
    { input: { postId, method, secret, namespaceSlug } }
  );
  return res.qrGen ? res.qrGen : null;
}
