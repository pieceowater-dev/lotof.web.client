import { atraceClient } from '@/api/clients';

const AtraceDeletePostDocument = /* GraphQL */ `
  mutation AtraceDeletePost($id: ID!) { deletePost(id: $id) { id } }
`;

export async function atraceDeletePost(
  atraceToken: string,
  namespaceSlug: string,
  id: string
): Promise<string> {
  const res = await atraceClient.request<{ deletePost: { id: string } }>(
    AtraceDeletePostDocument,
    { id },
    {
      headers: {
        AtraceAuthorization: `Bearer ${atraceToken}`,
        Namespace: namespaceSlug,
      }
    }
  );
  return res.deletePost.id;
}
