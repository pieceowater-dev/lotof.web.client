import { atraceClient } from '@/api/clients';


const QrGenDocument = /* GraphQL */ `
  query QrGen($input: QRGenInput!) {
    qrGen(input: $input) { qr }
  }
`;

export async function qrGenPublic(
  postId: string,
  method: string,
  secret: string,
  namespaceSlug: string
): Promise<string | null> {
  // Pass namespaceSlug and secret in input
  const res = await atraceClient.request<{ qrGen: { qr: string } }>(
    QrGenDocument,
    { input: { postId, method, secret, namespaceSlug } }
  );
  return res.qrGen?.qr || null;
}
