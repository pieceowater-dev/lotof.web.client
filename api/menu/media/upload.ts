import { getApiBaseUrl } from '@/utils/api-base';
import { buildGraphqlUploadBody } from '@/utils/graphqlMultipartUpload';

const UPLOAD_MENU_IMAGE_MUTATION = /* GraphQL */ `
  mutation UploadMenuImage($file: Upload!) {
    uploadMenuImage(file: $file) {
      url key contentType size
    }
  }
`;

export type MenuMediaUploadResult = {
  url: string;
  key: string;
  contentType: string;
  size: number;
};

export async function menuUploadImage(menuToken: string, namespaceSlug: string, file: File): Promise<MenuMediaUploadResult> {
  const operations = {
    query: UPLOAD_MENU_IMAGE_MUTATION,
    variables: { file: null },
  };

  const { body, contentType } = buildGraphqlUploadBody(operations, { file: ['variables.file'] }, 'file', file);

  const uploadUrl = `${getApiBaseUrl('menu')}/query`;
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      MenuAuthorization: `Bearer ${menuToken}`,
      Namespace: namespaceSlug,
      'Content-Type': contentType,
    },
    body,
  });

  const result: any = await response.json().catch(() => ({}));
  if (!response.ok || result?.errors?.length) {
    throw new Error(String(result?.errors?.[0]?.message || `Upload failed with status ${response.status}`));
  }

  const payload = result?.data?.uploadMenuImage;
  if (!payload?.url) throw new Error('Upload did not return an image URL');

  return {
    url: `${getApiBaseUrl('menu')}${payload.url}`,
    key: payload.key,
    contentType: payload.contentType,
    size: payload.size,
  };
}
