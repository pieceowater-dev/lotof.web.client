import { atraceClient } from '@/api/clients';

const AtraceCreatePostDocument = /* GraphQL */ `
  mutation AtraceCreatePost($input: CreatePostInput!) {
    createPost(input: $input) { id title description location { comment country city address latitude longitude } }
  }
`;

export type CreatePostInput = {
  title: string;
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

export async function atraceCreatePost(
  atraceToken: string,
  namespaceSlug: string,
  input: CreatePostInput
) {
  const res = await atraceClient.request<{ createPost: any }>(
    AtraceCreatePostDocument,
    { input },
    {
      headers: {
        AtraceAuthorization: `Bearer ${atraceToken}`,
        Namespace: namespaceSlug,
      }
    }
  );
  return res.createPost;
}
