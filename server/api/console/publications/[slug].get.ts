type ConsolePublicationResponse = {
  data?: {
    consolePublicationBySlug?: {
      slug?: string;
      title?: string;
      category?: string;
      status?: string;
      author?: string;
      authorUrl?: string;
      authorRole?: string;
      publishedAtUnix?: string;
      updatedAtUnix?: string;
      featuredImage?: string;
      tags?: string[];
      focusKeyword?: string;
      metaTitle?: string;
      metaDescription?: string;
      canonicalUrl?: string;
      ogImage?: string;
      schemaType?: string;
      sourceUrl?: string;
      sourceName?: string;
      reviewedBy?: string;
      reviewedByUrl?: string;
      reviewedDateUnix?: string;
      publisherName?: string;
      publisherUrl?: string;
      publisherLogo?: string;
      robots?: string;
      blocks?: Array<{
        id?: string;
        type?: string;
        content?: string;
        attrsJson?: string;
      }>;
    } | null;
  };
  errors?: Array<{ message?: string }>;
};

const GET_BY_SLUG_QUERY = `
  query ConsolePublicationBySlug($slug: String!, $includeBlocks: Boolean!) {
    consolePublicationBySlug(slug: $slug, includeBlocks: $includeBlocks) {
      slug
      title
      category
      status
      author
      authorUrl
      authorRole
      publishedAtUnix
      updatedAtUnix
      featuredImage
      tags
      focusKeyword
      metaTitle
      metaDescription
      canonicalUrl
      ogImage
      schemaType
      sourceUrl
      sourceName
      reviewedBy
      reviewedByUrl
      reviewedDateUnix
      publisherName
      publisherUrl
      publisherLogo
      robots
      blocks {
        id
        type
        content
        attrsJson
      }
    }
  }
`;

function normalizeToken(event: any): string {
  const cookieToken = String(getCookie(event, 'auth_token') || '').trim();
  const authHeader = String(getHeader(event, 'authorization') || '').trim();
  const token = cookieToken || authHeader;
  if (!token) return '';
  return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
}

function fromGqlCategory(raw?: string): string {
  const value = String(raw || '').trim().toUpperCase();
  switch (value) {
    case 'BLOG':
      return 'blog';
    case 'WHATSNEW':
      return 'whatsnew';
    case 'ARTICLES':
      return 'articles';
    case 'LEARNING':
      return 'learning';
    case 'NEWS':
      return 'news';
    default:
      return 'news';
  }
}

function fromGqlStatus(raw?: string): 'draft' | 'published' {
  const value = String(raw || '').trim().toUpperCase();
  return value === 'PUBLISHED' ? 'published' : 'draft';
}

function fromGqlSchemaType(raw?: string): 'Article' | 'NewsArticle' | 'BlogPosting' {
  const value = String(raw || '').trim().toUpperCase();
  if (value === 'NEWS_ARTICLE') return 'NewsArticle';
  if (value === 'BLOG_POSTING') return 'BlogPosting';
  return 'Article';
}

function unixToDate(raw?: string): string {
  const source = String(raw || '').trim();
  if (!source) return '';

  const parsed = Number(source);
  if (!Number.isFinite(parsed) || parsed <= 0) return '';

  const seconds = parsed > 1_000_000_000_000 ? Math.floor(parsed / 1000) : parsed;
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}

function mapUpstreamError(message: string): { statusCode: number; statusMessage: string } {
  const msg = String(message || 'Capital GraphQL request failed');
  if (msg.includes('code = NotFound')) return { statusCode: 404, statusMessage: 'Publication not found' };
  if (msg.includes('code = InvalidArgument')) return { statusCode: 400, statusMessage: msg };
  if (msg.includes('code = Unauthenticated')) return { statusCode: 401, statusMessage: msg };
  if (msg.includes('code = PermissionDenied')) return { statusCode: 403, statusMessage: msg };
  return { statusCode: 502, statusMessage: msg };
}

function normalizeBlockAttrs(block: { type?: string; attrs?: Record<string, unknown> }): Record<string, unknown> {
  const attrs = { ...(block.attrs || {}) };
  if (String(block.type || '') === 'image') {
    const legacySrc = String(attrs.s || '').trim();
    if (legacySrc && !String(attrs.src || '').trim()) {
      attrs.src = legacySrc;
    }
    const legacyAssetId = String(attrs.ai || '').trim();
    if (legacyAssetId && !String(attrs.assetId || '').trim()) {
      attrs.assetId = legacyAssetId;
    }
  }
  return attrs;
}

export default defineEventHandler(async (event) => {
  const slug = String(getRouterParam(event, 'slug') || '').trim();
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid slug' });
  }

  const token = normalizeToken(event);
  const capitalUrl = String(process.env.VITE_API_CAPITAL || 'http://localhost:8082').replace(/\/$/, '');

  const response = await $fetch<ConsolePublicationResponse>(`${capitalUrl}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: token, CapitalAuthorization: token } : {}),
    },
    body: {
      query: GET_BY_SLUG_QUERY,
      variables: {
        slug,
        includeBlocks: true,
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

  const publication = response?.data?.consolePublicationBySlug;
  if (!publication) {
    throw createError({ statusCode: 404, statusMessage: 'Publication not found' });
  }

  const blocks = (Array.isArray(publication.blocks) ? publication.blocks : []).map((block) => {
    let attrs: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(String(block?.attrsJson || '{}'));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        attrs = parsed as Record<string, unknown>;
      }
    } catch {
      attrs = {};
    }

    return {
      id: String(block?.id || ''),
      type: String(block?.type || 'paragraph'),
      content: String(block?.content || ''),
      attrs: normalizeBlockAttrs({ type: block?.type, attrs }),
    };
  });

  return {
    slug: String(publication.slug || slug),
    article: {
      title: String(publication.title || ''),
      slug: String(publication.slug || slug),
      status: fromGqlStatus(publication.status),
      category: fromGqlCategory(publication.category),
      author: String(publication.author || ''),
      authorUrl: String(publication.authorUrl || ''),
      authorRole: String(publication.authorRole || ''),
      publishedAt: unixToDate(publication.publishedAtUnix),
      updatedAt: unixToDate(publication.updatedAtUnix),
      featuredImage: String(publication.featuredImage || ''),
      tags: Array.isArray(publication.tags) ? publication.tags.map((tag) => String(tag)) : [],
      focusKeyword: String(publication.focusKeyword || ''),
      metaTitle: String(publication.metaTitle || ''),
      metaDescription: String(publication.metaDescription || ''),
      canonicalUrl: String(publication.canonicalUrl || ''),
      ogImage: String(publication.ogImage || ''),
      schemaType: fromGqlSchemaType(publication.schemaType),
      sourceUrl: String(publication.sourceUrl || ''),
      sourceName: String(publication.sourceName || ''),
      reviewedBy: String(publication.reviewedBy || ''),
      reviewedByUrl: String(publication.reviewedByUrl || ''),
      reviewedDate: unixToDate(publication.reviewedDateUnix),
      publisherName: String(publication.publisherName || 'Lota'),
      publisherUrl: String(publication.publisherUrl || ''),
      publisherLogo: String(publication.publisherLogo || ''),
      robots: String(publication.robots || 'index,follow'),
    },
    blocks,
  };
});
