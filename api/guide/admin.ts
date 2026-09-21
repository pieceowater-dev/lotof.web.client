import { capitalClient, setGlobalAuthToken } from '@/api/clients';
import { getApiBaseUrl } from '@/utils/api-base';
import { buildGraphqlUploadBody } from '@/utils/graphqlMultipartUpload';
import { assertUploadSize } from '@/utils/imageCompression';
import type { GuideApp, GuideArticle, GuideArticleListItem, GuideArticleStatus, GuideCategory } from '@/api/guide/public';

export type GuideCategoryInput = {
  parentId?: string | null;
  app: GuideApp;
  slug: string;
  nameRu: string;
  nameKk?: string;
  nameEn?: string;
  icon?: string;
  sortOrder?: number;
  isActive?: boolean;
};

export type GuideArticleInput = {
  categoryId?: string | null;
  app: GuideApp;
  slug: string;
  isFaq?: boolean;
  status?: GuideArticleStatus;
  sortOrder?: number;
  titleRu: string;
  titleKk?: string;
  titleEn?: string;
  excerptRu?: string;
  excerptKk?: string;
  excerptEn?: string;
  contentRu?: string;
  contentKk?: string;
  contentEn?: string;
};

export type GuideArticleListFilter = {
  categoryId?: string;
  onlyFaq?: boolean;
  status?: GuideArticleStatus;
  search?: string;
  page?: number;
  pageSize?: number;
};

const CATEGORY_FIELDS = /* GraphQL */ `
  id
  parentId
  app
  slug
  nameRu
  nameKk
  nameEn
  icon
  sortOrder
  isActive
  createdAtUnix
  updatedAtUnix
`;

const ARTICLE_LIST_ITEM_FIELDS = /* GraphQL */ `
  id
  categoryId
  app
  slug
  isFaq
  status
  sortOrder
  titleRu
  titleKk
  titleEn
  excerptRu
  excerptKk
  excerptEn
  updatedAtUnix
`;

const ARTICLE_FIELDS = /* GraphQL */ `
  ${ARTICLE_LIST_ITEM_FIELDS}
  contentRu
  contentKk
  contentEn
  createdAtUnix
`;

const CONSOLE_GUIDE_CATEGORIES_QUERY = /* GraphQL */ `
  query ConsoleGuideCategories($app: GuideApp) {
    consoleGuideCategories(app: $app) { ${CATEGORY_FIELDS} }
  }
`;

const CONSOLE_GUIDE_ARTICLES_QUERY = /* GraphQL */ `
  query ConsoleGuideArticles($filter: GuideArticleListFilterInput, $app: GuideApp) {
    consoleGuideArticles(filter: $filter, app: $app) {
      items { ${ARTICLE_LIST_ITEM_FIELDS} }
      total
    }
  }
`;

const CONSOLE_GUIDE_ARTICLE_QUERY = /* GraphQL */ `
  query ConsoleGuideArticle($id: String!) {
    consoleGuideArticle(id: $id) { ${ARTICLE_FIELDS} }
  }
`;

const CREATE_GUIDE_CATEGORY_MUTATION = /* GraphQL */ `
  mutation CreateGuideCategory($input: GuideCategoryInput!) {
    createGuideCategory(input: $input) { ${CATEGORY_FIELDS} }
  }
`;

const UPDATE_GUIDE_CATEGORY_MUTATION = /* GraphQL */ `
  mutation UpdateGuideCategory($id: String!, $input: GuideCategoryInput!) {
    updateGuideCategory(id: $id, input: $input) { ${CATEGORY_FIELDS} }
  }
`;

const DELETE_GUIDE_CATEGORY_MUTATION = /* GraphQL */ `
  mutation DeleteGuideCategory($id: String!) {
    deleteGuideCategory(id: $id)
  }
`;

const CREATE_GUIDE_ARTICLE_MUTATION = /* GraphQL */ `
  mutation CreateGuideArticle($input: GuideArticleInput!) {
    createGuideArticle(input: $input) { ${ARTICLE_FIELDS} }
  }
`;

const UPDATE_GUIDE_ARTICLE_MUTATION = /* GraphQL */ `
  mutation UpdateGuideArticle($id: String!, $input: GuideArticleInput!) {
    updateGuideArticle(id: $id, input: $input) { ${ARTICLE_FIELDS} }
  }
`;

const DELETE_GUIDE_ARTICLE_MUTATION = /* GraphQL */ `
  mutation DeleteGuideArticle($id: String!) {
    deleteGuideArticle(id: $id)
  }
`;

export async function consoleListGuideCategories(token: string, app?: GuideApp): Promise<GuideCategory[]> {
  setGlobalAuthToken(token);
  const res = await capitalClient.request<{ consoleGuideCategories: GuideCategory[] }>(CONSOLE_GUIDE_CATEGORIES_QUERY, {
    app: app ?? null,
  });
  return res.consoleGuideCategories ?? [];
}

export async function consoleListGuideArticles(
  token: string,
  filter?: GuideArticleListFilter,
  app?: GuideApp,
): Promise<{ items: GuideArticleListItem[]; total: number }> {
  setGlobalAuthToken(token);
  const res = await capitalClient.request<{ consoleGuideArticles: { items: GuideArticleListItem[]; total: number } }>(
    CONSOLE_GUIDE_ARTICLES_QUERY,
    { filter: filter ?? null, app: app ?? null },
  );
  return res.consoleGuideArticles ?? { items: [], total: 0 };
}

export async function consoleGetGuideArticle(token: string, id: string): Promise<GuideArticle | null> {
  setGlobalAuthToken(token);
  const res = await capitalClient.request<{ consoleGuideArticle: GuideArticle | null }>(CONSOLE_GUIDE_ARTICLE_QUERY, { id });
  return res.consoleGuideArticle ?? null;
}

export async function guideCreateCategory(token: string, input: GuideCategoryInput): Promise<GuideCategory> {
  setGlobalAuthToken(token);
  const res = await capitalClient.request<{ createGuideCategory: GuideCategory }>(CREATE_GUIDE_CATEGORY_MUTATION, { input });
  return res.createGuideCategory;
}

export async function guideUpdateCategory(token: string, id: string, input: GuideCategoryInput): Promise<GuideCategory> {
  setGlobalAuthToken(token);
  const res = await capitalClient.request<{ updateGuideCategory: GuideCategory }>(UPDATE_GUIDE_CATEGORY_MUTATION, { id, input });
  return res.updateGuideCategory;
}

export async function guideDeleteCategory(token: string, id: string): Promise<boolean> {
  setGlobalAuthToken(token);
  const res = await capitalClient.request<{ deleteGuideCategory: boolean }>(DELETE_GUIDE_CATEGORY_MUTATION, { id });
  return !!res.deleteGuideCategory;
}

export async function guideCreateArticle(token: string, input: GuideArticleInput): Promise<GuideArticle> {
  setGlobalAuthToken(token);
  const res = await capitalClient.request<{ createGuideArticle: GuideArticle }>(CREATE_GUIDE_ARTICLE_MUTATION, { input });
  return res.createGuideArticle;
}

export async function guideUpdateArticle(token: string, id: string, input: GuideArticleInput): Promise<GuideArticle> {
  setGlobalAuthToken(token);
  const res = await capitalClient.request<{ updateGuideArticle: GuideArticle }>(UPDATE_GUIDE_ARTICLE_MUTATION, { id, input });
  return res.updateGuideArticle;
}

export async function guideDeleteArticle(token: string, id: string): Promise<boolean> {
  setGlobalAuthToken(token);
  const res = await capitalClient.request<{ deleteGuideArticle: boolean }>(DELETE_GUIDE_ARTICLE_MUTATION, { id });
  return !!res.deleteGuideArticle;
}

const UPLOAD_GUIDE_ARTICLE_IMAGE_MUTATION = /* GraphQL */ `
  mutation UploadGuideArticleImage($articleId: String!, $file: Upload!, $alt: String) {
    uploadGuideArticleImage(articleId: $articleId, file: $file, alt: $alt) {
      assetId
      url
      key
      contentType
      size
    }
  }
`;

// Uploads an image for inline use in a Guide article's markdown body (the
// article must already exist -- an unsaved "create" draft has no id yet).
// Mirrors capitalUploadPublicationImage's GraphQL-multipart shape exactly.
export async function capitalUploadGuideArticleImage(
  token: string,
  articleId: string,
  file: File,
  options?: { alt?: string },
): Promise<{ url: string; assetId: string; key: string; contentType: string; size: string }> {
  assertUploadSize(file);
  const operations = {
    query: UPLOAD_GUIDE_ARTICLE_IMAGE_MUTATION,
    variables: {
      articleId,
      file: null,
      alt: options?.alt || null,
    },
  };

  const { body, contentType } = await buildGraphqlUploadBody(operations, { file: ['variables.file'] }, 'file', file);

  const headers: Record<string, string> = { 'Content-Type': contentType };
  if (token) {
    headers.CapitalAuthorization = `Bearer ${token}`;
  }

  const uploadUrl = `${getApiBaseUrl('capital')}/query`;

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers,
    body,
    credentials: 'omit',
  });

  const result: any = await response.json().catch(() => ({}));
  const lastMessage = String(result?.errors?.[0]?.message || result?.message || `Upload failed with status ${response.status}`);
  if (!response.ok) {
    throw new Error(lastMessage);
  }

  if (!result || result?.errors?.length) {
    throw new Error(lastMessage || 'Upload failed');
  }

  const payload = result?.data?.uploadGuideArticleImage;
  if (!payload?.url) {
    throw new Error('Upload did not return image URL');
  }

  return {
    url: String(payload.url),
    assetId: String(payload.assetId || ''),
    key: String(payload.key || ''),
    contentType: String(payload.contentType || ''),
    size: String(payload.size || ''),
  };
}
