import { atraceClient } from '@/api/clients';
import { getDeviceHeaders } from '@/utils/device';

const AtraceDeletePostDocument = /* GraphQL */ `
  mutation AtraceDeletePost($id: ID!) { deletePost(id: $id) { id } }
`;

export async function atraceDeletePost(
  atraceToken: string,
  namespaceSlug: string,
  id: string
): Promise<string> {
  const devHeaders = await getDeviceHeaders();
  const res = await atraceClient.request<{ deletePost: { id: string } }>(
    AtraceDeletePostDocument,
    { id },
    {
      headers: {
        AtraceAuthorization: `Bearer ${atraceToken}`,
        Namespace: namespaceSlug,
        ...devHeaders,
      }
    }
  );
  return res.deletePost.id;
}
