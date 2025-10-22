import { atraceClient } from '@/api/clients';
import { getDeviceHeaders } from '@/utils/device';

export type UpdatePostInput = {
  id: string;
  title?: string;
  description?: string | null;
  location?: {
    comment?: string | null;
    country?: string | null;
    city?: string | null;
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
};

const AtraceUpdatePostDocument = /* GraphQL */ `
  mutation AtraceUpdatePost($input: UpdatePostInput!) {
    updatePost(input: $input) { id title description location { comment country city address latitude longitude } }
  }
`;

export async function atraceUpdatePost(
  atraceToken: string,
  namespaceSlug: string,
  input: UpdatePostInput
) {
  const devHeaders = await getDeviceHeaders();
  const res = await atraceClient.request<{ updatePost: any }>(
    AtraceUpdatePostDocument,
    { input },
    {
      headers: {
        AtraceAuthorization: `Bearer ${atraceToken}`,
        Namespace: namespaceSlug,
        ...devHeaders,
      }
    }
  );
  return res.updatePost;
}
