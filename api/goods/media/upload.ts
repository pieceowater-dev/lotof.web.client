import { getApiBaseUrl } from '@/utils/api-base';
import { buildGraphqlUploadBody } from '@/utils/graphqlMultipartUpload';

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
  const operations = {
    query: UPLOAD_GOODS_IMAGE_MUTATION,
    variables: { file: null },
  };

  const { body, contentType } = buildGraphqlUploadBody(operations, { file: ['variables.file'] }, 'file', file);

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
    url: `${getApiBaseUrl('goods')}${payload.url}`,
    key: payload.key,
    contentType: payload.contentType,
    size: payload.size,
  };
}
