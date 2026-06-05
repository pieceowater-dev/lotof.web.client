import { getApiBaseUrl } from '../../../../utils/api-base';

type ConsolePublicationListItem = {
  title: string;
  slug: string;
  category: string;
  status: string;
  author: string;
  publishedAtUnix: string;
  updatedAtUnix: string;
};

type ConsolePublicationsResponse = {
  data?: {
    consolePublications?: {
      items?: ConsolePublicationListItem[];
      total?: number;
      page?: number;
      pageSize?: number;
      totalPages?: number;
      counts?: {
        all?: number;
        blog?: number;
        whatsnew?: number;
        articles?: number;
        learning?: number;
        news?: number;
      };
    };
  };
  errors?: Array<{ message?: string }>;
};

const LIST_QUERY = `
  query ConsolePublications($filter: PublicationListFilterInput) {
    consolePublications(filter: $filter) {
      items {
        title
        slug
        category
        status
        author
        publishedAtUnix
        updatedAtUnix
      }
      total
      page
      pageSize
      totalPages
      counts {
        all
        blog
        whatsnew
        articles
        learning
        news
      }
    }
  }
`;

const CATEGORY_TO_GQL: Record<string, string> = {
  blog: 'BLOG',
  whatsnew: 'WHATSNEW',
  articles: 'ARTICLES',
  learning: 'LEARNING',
  news: 'NEWS',
};

function unixToDate(raw?: string): string {
  const source = String(raw || '').trim();
  if (!source) return '';

  const parsed = Number(source);
  if (!Number.isFinite(parsed) || parsed <= 0) return '';

  const seconds = parsed > 1_000_000_000_000 ? Math.floor(parsed / 1000) : parsed;
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}

function normalizeToken(event: any): string {
  const cookieToken = String(getCookie(event, 'auth_token') || '').trim();
  const authHeader = String(getHeader(event, 'authorization') || '').trim();
  const token = cookieToken || authHeader;
  if (!token) return '';
  return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const token = normalizeToken(event);

  const categoryRaw = String(query.category || 'all').trim().toLowerCase();
  const search = String(query.search || '').trim();
  const page = Math.max(1, Number.parseInt(String(query.page || '1'), 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(String(query.pageSize || '10'), 10) || 10));

  const filter: Record<string, unknown> = {
    includeDraft: true,
    page,
    pageSize,
  };

  if (search) {
    filter.search = search;
  }

  if (categoryRaw !== 'all' && CATEGORY_TO_GQL[categoryRaw]) {
    filter.category = CATEGORY_TO_GQL[categoryRaw];
  }

  const capitalUrl = String(getApiBaseUrl('capital') || '').replace(/\/$/, '');
  const response = await $fetch<ConsolePublicationsResponse>(`${capitalUrl}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: token, CapitalAuthorization: token } : {}),
    },
    body: {
      query: LIST_QUERY,
      variables: { filter },
    },
  });

  if (Array.isArray(response?.errors) && response.errors.length > 0) {
    throw createError({
      statusCode: 502,
      statusMessage: response.errors[0]?.message || 'Capital GraphQL request failed',
    });
  }

  const payload = response?.data?.consolePublications;
  const items = Array.isArray(payload?.items) ? payload.items : [];

  return {
    items: items.map((row) => ({
      title: String(row.title || ''),
      slug: String(row.slug || ''),
      category: String(row.category || '').toLowerCase(),
      status: String(row.status || '').toLowerCase(),
      author: String(row.author || ''),
      publishedAt: unixToDate(row.publishedAtUnix),
      updatedAt: unixToDate(row.updatedAtUnix),
    })),
    total: Number(payload?.total || 0),
    page: Number(payload?.page || page),
    pageSize: Number(payload?.pageSize || pageSize),
    totalPages: Number(payload?.totalPages || 1),
    counts: {
      all: Number(payload?.counts?.all || 0),
      blog: Number(payload?.counts?.blog || 0),
      whatsnew: Number(payload?.counts?.whatsnew || 0),
      articles: Number(payload?.counts?.articles || 0),
      learning: Number(payload?.counts?.learning || 0),
      news: Number(payload?.counts?.news || 0),
    },
  };
});
