import { getApiBaseUrl } from '@/utils/api-base';
import { buildGraphqlUploadBody } from '@/utils/graphqlMultipartUpload';
import { assertUploadSize } from '@/utils/imageCompression';
import type { SiteMedia } from '@/api/pages/ops';

const UPLOAD_MUTATION = /* GraphQL */ `
  mutation UploadMedia($siteId: ID!, $file: Upload!, $alt: String) {
    uploadMedia(siteId: $siteId, file: $file, alt: $alt) { id siteId sha256 ext width height bytes alt url createdAtUnix }
  }
`;

async function attempt(token: string, ns: string, body: ArrayBuffer, contentType: string) {
  const response = await fetch(`${getApiBaseUrl('pages')}/query`, {
    method: 'POST',
    headers: { PagesAuthorization: `Bearer ${token}`, Namespace: ns, 'Content-Type': contentType },
    body,
  });
  const result: any = await response.json().catch(() => ({}));
  return { ok: response.ok && !result?.errors?.length, status: response.status, result };
}

/** Uploads an image to the site's media library; `url` is site-relative (/media/<hash>.<ext>). */
export async function pagesUploadMedia(token: string, ns: string, siteId: string, file: File, alt = ''): Promise<SiteMedia> {
  assertUploadSize(file);
  const operations = { query: UPLOAD_MUTATION, variables: { siteId, file: null, alt: alt || null } };
  const { body, contentType } = await buildGraphqlUploadBody(operations, { file: ['variables.file'] }, 'file', file);

  let res = await attempt(token, ns, body, contentType);
  if (!res.ok && res.status >= 500) {
    await new Promise((r) => setTimeout(r, 800));
    res = await attempt(token, ns, body, contentType);
  }
  if (!res.ok) throw new Error(String(res.result?.errors?.[0]?.message || `Upload failed with status ${res.status}`));
  const media = res.result?.data?.uploadMedia as SiteMedia | undefined;
  if (!media?.url) throw new Error('Upload did not return an image URL');
  return media;
}
