import { getApiBaseUrl } from '@/utils/api-base';

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

  // The file part is named "file", not a numeric string like "0" -- Safari's
  // FormData has been observed serializing purely-numeric field names out of
  // insertion order (integer-key semantics leaking into multipart encoding),
  // which put the file part before "operations" on the wire and made
  // gqlgen's strict first-part-must-be-operations parser reject the request.
  const form = new FormData();
  form.append('operations', JSON.stringify(operations));
  form.append('map', JSON.stringify({ file: ['variables.file'] }));
  form.append('file', file, file.name);

  const uploadUrl = `${getApiBaseUrl('goods')}/query`;
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      GoodsAuthorization: `Bearer ${goodsToken}`,
      Namespace: namespaceSlug,
    },
    body: form,
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
