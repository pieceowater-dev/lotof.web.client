import { atraceClient } from '@/api/clients';
import { getDeviceHeaders } from '@/utils/device';

const AtraceCreatePostDocument = /* GraphQL */ `
  mutation AtraceCreatePost($input: CreatePostInput!) {
    createPost(input: $input) { id title description location { comment country city address latitude longitude timezone } }
  }
`;

export type CreatePostInput = {
  title: string;
  description?: string | null;
  phrase?: string;
  location?: {
    comment?: string | null;
    country?: string | null;
    city?: string | null;
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    timezone?: string | null;
  } | null;
};

export async function atraceCreatePost(
  atraceToken: string,
  namespaceSlug: string,
  input: CreatePostInput
) {
  const devHeaders = await getDeviceHeaders();
  const res = await atraceClient.request<{ createPost: any }>(
    AtraceCreatePostDocument,
    { input },
    {
      headers: {
        AtraceAuthorization: `Bearer ${atraceToken}`,
        Namespace: namespaceSlug,
        ...devHeaders,
      }
    }
  );
  return res.createPost;
}
