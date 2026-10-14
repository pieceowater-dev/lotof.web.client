import { getApiBaseUrl } from '@/utils/api-base';
import { toStoredMediaPath } from '@/utils/mediaUrl';
import { buildGraphqlUploadBody } from '@/utils/graphqlMultipartUpload';
import { assertUploadSize } from '@/utils/imageCompression';

const UPLOAD_GOODS_IMAGE_MUTATION = /* GraphQL */ `
  mutation UploadGoodsImage($file: Upload!) {
    uploadGoodsImage(file: $file) {
      url key contentType size
    }
  }
`;

export type GoodsMediaUploadResult = {
  url: string;
  key: string;
  contentType: string;
  size: number;
};

export async function goodsUploadImage(goodsToken: string, namespaceSlug: string, file: File): Promise<GoodsMediaUploadResult> {
  assertUploadSize(file);
  const operations = {
    query: UPLOAD_GOODS_IMAGE_MUTATION,
    variables: { file: null },
  };

  const { body, contentType } = await buildGraphqlUploadBody(operations, { file: ['variables.file'] }, 'file', file);

  const uploadUrl = `${getApiBaseUrl('goods')}/query`;
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      GoodsAuthorization: `Bearer ${goodsToken}`,
      Namespace: namespaceSlug,
      'Content-Type': contentType,
    },
    body,
  });

  const result: any = await response.json().catch(() => ({}));
  if (!response.ok || result?.errors?.length) {
    throw new Error(String(result?.errors?.[0]?.message || `Upload failed with status ${response.status}`));
  }

  const payload = result?.data?.uploadGoodsImage;
  if (!payload?.url) throw new Error('Upload did not return an image URL');

  return {
    url: toStoredMediaPath('goods', payload.url),
    key: payload.key,
    contentType: payload.contentType,
    size: payload.size,
  };
}

const UPLOAD_GOODS_DOCUMENT_MUTATION = /* GraphQL */ `
  mutation UploadGoodsDocument($file: Upload!) {
    uploadGoodsDocument(file: $file) {
      url key contentType size
    }
  }
`;

export type GoodsDocumentUploadResult = GoodsMediaUploadResult & {
  /** The path exactly as the server stored it (what an attachment record must carry). */
  rawUrl: string;
};

// A photo or office document attached to a warehouse document.
export async function goodsUploadDocument(goodsToken: string, namespaceSlug: string, file: File): Promise<GoodsDocumentUploadResult> {
  assertUploadSize(file);
  const operations = { query: UPLOAD_GOODS_DOCUMENT_MUTATION, variables: { file: null } };
  const { body, contentType } = await buildGraphqlUploadBody(operations, { file: ['variables.file'] }, 'file', file);

  const response = await fetch(`${getApiBaseUrl('goods')}/query`, {
    method: 'POST',
    headers: { GoodsAuthorization: `Bearer ${goodsToken}`, Namespace: namespaceSlug, 'Content-Type': contentType },
    body,
  });
  const result: any = await response.json().catch(() => ({}));
  if (!response.ok || result?.errors?.length) {
    throw new Error(String(result?.errors?.[0]?.message || `Upload failed with status ${response.status}`));
  }
  const payload = result?.data?.uploadGoodsDocument;
  if (!payload?.url) throw new Error('Upload did not return a file URL');
  return {
    url: toStoredMediaPath('goods', payload.url),
    rawUrl: payload.url,
    key: payload.key,
    contentType: payload.contentType,
    size: payload.size,
  };
}
