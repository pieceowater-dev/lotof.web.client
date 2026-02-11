import { atraceClient } from '@/api/clients';
import { atraceRequestWithRefresh } from '@/api/atrace/atraceRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { AtracePost } from './list';

const GET_POST = /* GraphQL */ `
  query GetPost($id: ID!) {
    getPost(id: $id) {
      id
      title
      description
      location { comment country city address latitude longitude timezone }
    }
  }
`;

export async function atraceGetPost(
  atraceToken: string,
  namespaceSlug: string,
  id: string
): Promise<AtracePost> {
  const devHeaders = await getDeviceHeaders();
  return atraceRequestWithRefresh(async () => {
    const res = await atraceClient.request<{ getPost: AtracePost }>(GET_POST, { id }, {
      headers: {
        AtraceAuthorization: `Bearer ${atraceToken}`,
        Namespace: namespaceSlug,
        ...devHeaders,
      }
    });
    return res.getPost;
  }, namespaceSlug);
}
