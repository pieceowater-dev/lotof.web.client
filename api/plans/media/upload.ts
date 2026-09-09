import { getApiBaseUrl } from '@/utils/api-base';
import { buildGraphqlUploadBody } from '@/utils/graphqlMultipartUpload';
import { assertUploadSize } from '@/utils/imageCompression';

const UPLOAD_PLANS_IMAGE_MUTATION = /* GraphQL */ `
  mutation UploadPlansImage($file: Upload!) {
    uploadPlansImage(file: $file) { url key contentType size }
  }
`;

export type PlansMediaUploadResult = { url: string; key: string; contentType: string; size: number };

export async function plansUploadImage(plansToken: string, namespaceSlug: string, file: File): Promise<PlansMediaUploadResult> {
  assertUploadSize(file);
  const operations = { query: UPLOAD_PLANS_IMAGE_MUTATION, variables: { file: null } };
  const { body, contentType } = await buildGraphqlUploadBody(operations, { file: ['variables.file'] }, 'file', file);

  const response = await fetch(`${getApiBaseUrl('plans')}/query`, {
    method: 'POST',
    headers: {
      PlansAuthorization: `Bearer ${plansToken}`,
      Namespace: namespaceSlug,
      'Content-Type': contentType,
    },
    body,
  });

  const result: any = await response.json().catch(() => ({}));
  if (!response.ok || result?.errors?.length) {
    throw new Error(String(result?.errors?.[0]?.message || `Upload failed with status ${response.status}`));
  }
  const payload = result?.data?.uploadPlansImage;
  if (!payload?.url) throw new Error('Upload did not return an image URL');

  return {
    url: payload.url.startsWith('http') ? payload.url : `${getApiBaseUrl('plans')}${payload.url}`,
    key: payload.key,
    contentType: payload.contentType,
    size: payload.size,
  };
}
