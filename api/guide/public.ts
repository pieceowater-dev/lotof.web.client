import { capitalClient } from '@/api/clients';

export type GuideApp = 'GLOBAL' | 'LANDING' | 'ISSUES' | 'MENU' | 'CONTACTS' | 'ATRACE';
export type GuideArticleStatus = 'DRAFT' | 'PUBLISHED';

export type GuideCategory = {
  id: string;
  parentId?: string | null;
  app: GuideApp;
  slug: string;
  nameRu: string;
  nameKk: string;
  nameEn: string;
  icon: string;
  sortOrder: number;
  isActive: boolean;
  createdAtUnix: string;
  updatedAtUnix: string;
};

export type GuideArticleListItem = {
  id: string;
  categoryId?: string | null;
  app: GuideApp;
  slug: string;
  isFaq: boolean;
  status: GuideArticleStatus;
  sortOrder: number;
  titleRu: string;
  titleKk: string;
  titleEn: string;
  excerptRu: string;
  excerptKk: string;
  excerptEn: string;
  updatedAtUnix: string;
};

export type GuideArticle = GuideArticleListItem & {
  contentRu: string;
  contentKk: string;
  contentEn: string;
  createdAtUnix: string;
};

const GUIDE_CATEGORY_FIELDS = /* GraphQL */ `
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

const GUIDE_ARTICLE_LIST_ITEM_FIELDS = /* GraphQL */ `
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

const GUIDE_ARTICLE_FIELDS = /* GraphQL */ `
  ${GUIDE_ARTICLE_LIST_ITEM_FIELDS}
  contentRu
  contentKk
  contentEn
  createdAtUnix
`;

const GUIDE_CATEGORIES_QUERY = /* GraphQL */ `
  query GuideCategories($app: GuideApp!) {
    guideCategories(app: $app) { ${GUIDE_CATEGORY_FIELDS} }
  }
`;

const GUIDE_ARTICLES_QUERY = /* GraphQL */ `
  query GuideArticles($app: GuideApp!, $categoryId: String, $onlyFaq: Boolean) {
    guideArticles(app: $app, categoryId: $categoryId, onlyFaq: $onlyFaq) { ${GUIDE_ARTICLE_LIST_ITEM_FIELDS} }
  }
`;

const GUIDE_ARTICLE_BY_SLUG_QUERY = /* GraphQL */ `
  query GuideArticleBySlug($app: GuideApp!, $slug: String!) {
    guideArticleBySlug(app: $app, slug: $slug) { ${GUIDE_ARTICLE_FIELDS} }
  }
`;

export async function guideListCategories(app: GuideApp): Promise<GuideCategory[]> {
  const res = await capitalClient.request<{ guideCategories: GuideCategory[] }>(GUIDE_CATEGORIES_QUERY, { app });
  return res.guideCategories ?? [];
}

export async function guideListArticles(
  app: GuideApp,
  opts?: { categoryId?: string; onlyFaq?: boolean },
): Promise<GuideArticleListItem[]> {
  const res = await capitalClient.request<{ guideArticles: GuideArticleListItem[] }>(GUIDE_ARTICLES_QUERY, {
    app,
    categoryId: opts?.categoryId ?? null,
    onlyFaq: opts?.onlyFaq ?? null,
  });
  return res.guideArticles ?? [];
}

export async function guideGetArticleBySlug(app: GuideApp, slug: string): Promise<GuideArticle | null> {
  const res = await capitalClient.request<{ guideArticleBySlug: GuideArticle | null }>(GUIDE_ARTICLE_BY_SLUG_QUERY, { app, slug });
  return res.guideArticleBySlug ?? null;
}
