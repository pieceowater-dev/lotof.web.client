import { capitalClient, setGlobalAuthToken } from '@/api/clients';
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
