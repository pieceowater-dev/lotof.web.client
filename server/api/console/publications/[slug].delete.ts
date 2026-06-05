import { getApiBaseUrl } from '../../../../utils/api-base';

type GetPublicationResponse = {
  data?: {
    consolePublicationBySlug?: {
      title?: string;
      category?: string;
      visibility?: string;
    } | null;
  };
  errors?: Array<{ message?: string }>;
};

type ArchivePublicationResponse = {
  data?: {
    updateConsolePublicationBySlug?: {
      slug?: string;
    };
  };
  errors?: Array<{ message?: string }>;
};

const GET_PUBLICATION_QUERY = `
  query ConsolePublicationBySlug($slug: String!, $includeBlocks: Boolean!) {
    consolePublicationBySlug(slug: $slug, includeBlocks: $includeBlocks) {
      title
      category
      visibility
    }
  }
`;

const ARCHIVE_MUTATION = `
  mutation ArchiveConsolePublicationBySlug($slug: String!, $publication: PublicationInput!) {
    updateConsolePublicationBySlug(slug: $slug, publication: $publication) {
      slug
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

function mapUpstreamError(message: string): { statusCode: number; statusMessage: string } {
  const msg = String(message || 'Capital GraphQL request failed');
  if (msg.includes('code = NotFound')) return { statusCode: 404, statusMessage: 'Publication not found' };
  if (msg.includes('code = InvalidArgument')) return { statusCode: 400, statusMessage: msg };
  if (msg.includes('code = Unauthenticated')) return { statusCode: 401, statusMessage: msg };
  if (msg.includes('code = PermissionDenied')) return { statusCode: 403, statusMessage: msg };
  return { statusCode: 502, statusMessage: msg };
}

export default defineEventHandler(async (event) => {
  const slug = String(getRouterParam(event, 'slug') || '').trim();
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid slug' });
  }

  const token = normalizeToken(event);
  const capitalUrl = String(getApiBaseUrl('capital') || '').replace(/\/$/, '');

  const current = await $fetch<GetPublicationResponse>(`${capitalUrl}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: token, CapitalAuthorization: token } : {}),
    },
    body: {
      query: GET_PUBLICATION_QUERY,
      variables: { slug, includeBlocks: false },
    },
  });

  if (Array.isArray(current?.errors) && current.errors.length > 0) {
    const mapped = mapUpstreamError(current.errors[0]?.message || 'Capital GraphQL request failed');
    throw createError({ statusCode: mapped.statusCode, statusMessage: mapped.statusMessage });
  }

  const publication = current?.data?.consolePublicationBySlug;
  if (!publication) {
    throw createError({ statusCode: 404, statusMessage: 'Publication not found' });
  }

  const archived = await $fetch<ArchivePublicationResponse>(`${capitalUrl}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: token, CapitalAuthorization: token } : {}),
    },
    body: {
      query: ARCHIVE_MUTATION,
      variables: {
        slug,
        publication: {
          title: String(publication.title || '').trim(),
          category: String(publication.category || 'NEWS').trim(),
          status: 'ARCHIVED',
          visibility: String(publication.visibility || 'PUBLIC').trim(),
        },
      },
    },
  });

  if (Array.isArray(archived?.errors) && archived.errors.length > 0) {
    const mapped = mapUpstreamError(archived.errors[0]?.message || 'Capital GraphQL request failed');
    throw createError({ statusCode: mapped.statusCode, statusMessage: mapped.statusMessage });
  }

  const archivedSlug = String(archived?.data?.updateConsolePublicationBySlug?.slug || '').trim();
  if (!archivedSlug) {
    throw createError({ statusCode: 404, statusMessage: 'Publication not found or already archived' });
  }

  return { ok: true, archived: true, slug: archivedSlug };
});
