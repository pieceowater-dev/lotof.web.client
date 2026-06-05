import { sanitizeSlug, type EditorArticle, type EditorBlock } from '../../../utils/publications';
import { getApiBaseUrl } from '../../../../utils/api-base';

type BodyShape = {
  article?: Partial<EditorArticle>;
  blocks?: EditorBlock[];
};

type UpdatePublicationResponse = {
  data?: {
    updateConsolePublicationBySlug?: {
      slug?: string;
    };
  };
  errors?: Array<{ message?: string }>;
};

const UPDATE_MUTATION = `
  mutation UpdateConsolePublicationBySlug($slug: String!, $publication: PublicationInput!) {
    updateConsolePublicationBySlug(slug: $slug, publication: $publication) {
      slug
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

const STATUS_TO_GQL: Record<string, string> = {
  draft: 'DRAFT',
  published: 'PUBLISHED',
};

const SCHEMA_TYPE_TO_GQL: Record<string, string> = {
  Article: 'ARTICLE',
  NewsArticle: 'NEWS_ARTICLE',
  BlogPosting: 'BLOG_POSTING',
};

function normalizeToken(event: any): string {
  const cookieToken = String(getCookie(event, 'auth_token') || '').trim();
  const authHeader = String(getHeader(event, 'authorization') || '').trim();
  const token = cookieToken || authHeader;
  if (!token) return '';
  return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
}

function toUnixString(raw?: string): string | undefined {
  const value = String(raw || '').trim();
  if (!value) return undefined;
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return undefined;
  return String(Math.floor(ms / 1000));
}

function toCategory(raw?: string): string {
  const value = String(raw || '').trim().toLowerCase();
  return CATEGORY_TO_GQL[value] || 'NEWS';
}

function toStatus(raw?: string): string {
  const value = String(raw || '').trim().toLowerCase();
  return STATUS_TO_GQL[value] || 'DRAFT';
}

function toSchemaType(raw?: string): string {
  const value = String(raw || '').trim();
  return SCHEMA_TYPE_TO_GQL[value] || 'ARTICLE';
}

function randomBlockID(): string {
  return Math.random().toString(36).replace(/[^a-z0-9]/gi, '').slice(0, 6).padEnd(6, '0');
}

function normalizeBlockID(raw: unknown): string {
  const normalized = String(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 6);

  if (normalized.length === 6) return normalized;
  if (!normalized) return randomBlockID();
  return normalized.padEnd(6, '0');
}

function mapUpstreamError(message: string): { statusCode: number; statusMessage: string } {
  const msg = String(message || 'Capital GraphQL request failed');
  if (msg.includes('code = NotFound')) return { statusCode: 404, statusMessage: 'Publication not found' };
  if (msg.includes('code = InvalidArgument')) return { statusCode: 400, statusMessage: msg };
  if (msg.includes('code = Unauthenticated')) return { statusCode: 401, statusMessage: msg };
  if (msg.includes('code = PermissionDenied')) return { statusCode: 403, statusMessage: msg };
  return { statusCode: 502, statusMessage: msg };
}

function toPublicationInput(article: Partial<EditorArticle>, blocks: EditorBlock[]) {
  return {
    title: String(article.title || '').trim(),
    slug: sanitizeSlug(String(article.slug || article.title || '')),
    category: toCategory(article.category),
    status: toStatus(article.status),
    visibility: 'PUBLIC',
    excerpt: String(article.metaDescription || '').trim() || undefined,
    author: String(article.author || '').trim() || undefined,
    authorUrl: String(article.authorUrl || '').trim() || undefined,
    authorRole: String(article.authorRole || '').trim() || undefined,
    publishedAtUnix: toUnixString(article.publishedAt),
    featuredImage: String(article.featuredImage || '').trim() || undefined,
    tags: Array.isArray(article.tags)
      ? article.tags.map((tag) => String(tag).trim()).filter(Boolean)
      : [],
    focusKeyword: String(article.focusKeyword || '').trim() || undefined,
    metaTitle: String(article.metaTitle || '').trim() || undefined,
    metaDescription: String(article.metaDescription || '').trim() || undefined,
    canonicalUrl: String(article.canonicalUrl || '').trim() || undefined,
    ogImage: String(article.ogImage || '').trim() || undefined,
    schemaType: toSchemaType(article.schemaType),
    sourceUrl: String(article.sourceUrl || '').trim() || undefined,
    sourceName: String(article.sourceName || '').trim() || undefined,
    reviewedBy: String(article.reviewedBy || '').trim() || undefined,
    reviewedByUrl: String(article.reviewedByUrl || '').trim() || undefined,
    reviewedDateUnix: toUnixString(article.reviewedDate),
    publisherName: String(article.publisherName || '').trim() || undefined,
    publisherUrl: String(article.publisherUrl || '').trim() || undefined,
    publisherLogo: String(article.publisherLogo || '').trim() || undefined,
    robots: String(article.robots || '').trim() || undefined,
    blocks: (Array.isArray(blocks) ? blocks : []).map((block) => ({
      id: normalizeBlockID(block?.id),
      type: String(block?.type || 'paragraph'),
      content: String(block?.content || ''),
      attrsJson: JSON.stringify(block?.attrs || {}),
    })),
  };
}

export default defineEventHandler(async (event) => {
  const routeSlug = sanitizeSlug(getRouterParam(event, 'slug') || '');
  if (!routeSlug) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid slug' });
  }

  const body = await readBody<BodyShape>(event);
  const article = body?.article || {};
  const blocks = Array.isArray(body?.blocks) ? body.blocks : [];

  const title = String(article.title || '').trim();
  const nextSlug = sanitizeSlug(String(article.slug || title || routeSlug));
  if (!title) {
    throw createError({ statusCode: 400, statusMessage: 'Title is required' });
  }
  if (!nextSlug) {
    throw createError({ statusCode: 400, statusMessage: 'Slug is required' });
  }

  const token = normalizeToken(event);
  const capitalUrl = String(getApiBaseUrl('capital') || '').replace(/\/$/, '');

  const response = await $fetch<UpdatePublicationResponse>(`${capitalUrl}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: token, CapitalAuthorization: token } : {}),
    },
    body: {
      query: UPDATE_MUTATION,
      variables: {
        slug: routeSlug,
        publication: toPublicationInput({ ...article, title, slug: nextSlug }, blocks),
      },
    },
  });

  if (Array.isArray(response?.errors) && response.errors.length > 0) {
    const mapped = mapUpstreamError(response.errors[0]?.message || 'Capital GraphQL request failed');
    throw createError({
      statusCode: mapped.statusCode,
      statusMessage: mapped.statusMessage,
    });
  }

  const updatedSlug = String(response?.data?.updateConsolePublicationBySlug?.slug || '').trim();
  if (!updatedSlug) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Capital GraphQL returned empty publication slug',
    });
  }

  return { ok: true, slug: updatedSlug };
});
