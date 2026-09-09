import { getApiBaseUrl } from '@/utils/api-base';
import { buildGraphqlUploadBody } from '@/utils/graphqlMultipartUpload';
import { assertUploadSize } from '@/utils/imageCompression';

const UPLOAD_PLANS_IMAGE_MUTATION = /* GraphQL */ `
  mutation UploadPlansImage($file: Upload!) {
    uploadPlansImage(file: $file) { url key contentType size }
  }
`;

export type PlansMediaUploadResult = { url: string; key: string; contentType: string; size: number };

async function attempt(plansToken: string, namespaceSlug: string, body: ArrayBuffer, contentType: string) {
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
  return { ok: response.ok && !result?.errors?.length, status: response.status, result };
}

export async function plansUploadImage(plansToken: string, namespaceSlug: string, file: File): Promise<PlansMediaUploadResult> {
  assertUploadSize(file);
  const operations = { query: UPLOAD_PLANS_IMAGE_MUTATION, variables: { file: null } };
  const { body, contentType } = await buildGraphqlUploadBody(operations, { file: ['variables.file'] }, 'file', file);

  // One retry: a reset connection mid-body (seen during a gateway restart)
  // truncates the multipart stream and gqlgen answers 422 "first part must
  // be operations" — a fresh POST of the same bytes then succeeds.
  let res = await attempt(plansToken, namespaceSlug, body, contentType);
  if (!res.ok && (res.status === 422 || res.status === 502 || res.status === 503 || res.status >= 500)) {
    await new Promise((r) => setTimeout(r, 800));
    res = await attempt(plansToken, namespaceSlug, body, contentType);
  }

  if (!res.ok) {
    throw new Error(String(res.result?.errors?.[0]?.message || `Upload failed with status ${res.status}`));
  }
  const payload = res.result?.data?.uploadPlansImage;
  if (!payload?.url) throw new Error('Upload did not return an image URL');

  return {
    url: payload.url.startsWith('http') ? payload.url : `${getApiBaseUrl('plans')}${payload.url}`,
    key: payload.key,
    contentType: payload.contentType,
    size: payload.size,
  };
}
