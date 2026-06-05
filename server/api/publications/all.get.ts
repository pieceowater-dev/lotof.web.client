import { fetchPublicationDocumentsFromUpstream, listPublicationDocuments } from '../../utils/publications';
import { getApiBaseUrl } from '../../../utils/api-base';

type PublicPublicationListResponse = {
  data?: {
    publicPublications?: {
      items?: Array<{
        slug?: string;
        category?: string;
        title?: string;
        excerpt?: string;
        author?: string;
        authorRole?: string;
        publishedAtUnix?: string;
        featuredImage?: string;
        tags?: string[];
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
        canonicalUrl?: string;
        robots?: string;
      }>;
    };
  };
  errors?: Array<{ message?: string }>;
};

type PublicPublicationByRouteResponse = {
  data?: {
    publicPublicationByRoute?: {
      slug?: string;
      category?: string;
      title?: string;
      excerpt?: string;
      author?: string;
      authorRole?: string;
      publishedAtUnix?: string;
      featuredImage?: string;
      tags?: string[];
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
      canonicalUrl?: string;
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseAttrsJson(raw: string | undefined): Record<string, any> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function safeImageSrc(src: string): string {
  const value = String(src || '').trim();
  if (!value) return '';
  if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/')) return value;
  return '';
}

function blocksToHtml(
  blocks: Array<{ type?: string; content?: string; attrsJson?: string }> | undefined,
  fallbackText: string
): string {
  if (!Array.isArray(blocks) || !blocks.length) return fallbackText;

  const parts: string[] = [];

  for (const block of blocks) {
    const type = String(block?.type || 'paragraph').trim();
    const content = String(block?.content || '').trim();
    const attrs = parseAttrsJson(block?.attrsJson);

    if (type === 'image') {
      const src = safeImageSrc(String(attrs.src || attrs.s || ''));
      if (!src) continue;
      const alt = escapeHtml(String(attrs.alt || ''));
      const caption = String(attrs.caption || '').trim();
      parts.push(
        `<figure class="my-6">` +
        `<img src="${escapeHtml(src)}" alt="${alt}" class="w-full rounded-2xl border border-gray-200 object-cover dark:border-gray-700" loading="lazy" decoding="async" />` +
        (caption ? `<figcaption class="mt-2 text-sm text-slate-500 dark:text-slate-400">${caption}</figcaption>` : '') +
        `</figure>`
      );
      continue;
    }

    if (type === 'html') {
      if (content) parts.push(`<div class="my-4">${content}</div>`);
      continue;
    }

    if (type === 'h2' || type === 'h3' || type === 'h4' || type === 'h5') {
      if (!content) continue;
      const classes = {
        h2: 'mt-10 mb-3 text-3xl font-bold text-gray-900 dark:text-gray-100',
        h3: 'mt-8 mb-3 text-2xl font-bold text-gray-900 dark:text-gray-100',
        h4: 'mt-7 mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100',
        h5: 'mt-6 mb-2 text-lg font-semibold text-gray-800 dark:text-gray-100',
      } as const;
      parts.push(`<${type} class="${classes[type as keyof typeof classes]}">${content}</${type}>`);
      continue;
    }

    if (type === 'ul' || type === 'ol') {
      if (!content) continue;
      const listTag = type;
      parts.push(`<${listTag} class="my-4 list-${listTag === 'ul' ? 'disc' : 'decimal'} space-y-1 pl-6 text-base leading-7 text-gray-700 dark:text-gray-300">${content}</${listTag}>`);
      continue;
    }

    if (type === 'quote') {
      if (content) parts.push(`<blockquote class="my-6 border-l-4 border-blue-300 pl-5 italic text-gray-600 dark:border-blue-600 dark:text-gray-400">${content}</blockquote>`);
      continue;
    }

    if (type === 'divider') {
      parts.push('<hr class="my-8 border-slate-200 dark:border-slate-700" />');
      continue;
    }

    if (content) {
      parts.push(`<p class="my-4 text-base leading-7 text-gray-700 dark:text-gray-300">${content}</p>`);
    }
  }

  if (!parts.length) return fallbackText;
  return parts.join('');
}

const PUBLIC_PUBLICATIONS_QUERY = `
  query PublicPublications($filter: PublicationListFilterInput) {
    publicPublications(filter: $filter) {
      items {
        slug
        category
        title
        excerpt
        author
        authorRole
        publishedAtUnix
        featuredImage
        tags
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
        canonicalUrl
        robots
      }
    }
  }
`;

const PUBLIC_PUBLICATION_BY_ROUTE_QUERY = `
  query PublicPublicationByRoute($category: PublicationCategory!, $slug: String!, $includeBlocks: Boolean!) {
    publicPublicationByRoute(category: $category, slug: $slug, includeBlocks: $includeBlocks) {
      slug
      category
      title
      excerpt
      author
      authorRole
      publishedAtUnix
      featuredImage
      tags
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
      canonicalUrl
      robots
      blocks @include(if: $includeBlocks) {
        id
        type
        content
        attrsJson
      }
    }
  }
`;

const GQL_CATEGORIES = ['BLOG', 'WHATSNEW', 'ARTICLES', 'LEARNING', 'NEWS'] as const;

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const config = useRuntimeConfig(event);
  const category = String(query.category || '').trim().toLowerCase();
  const slug = String(query.slug || '').trim().toLowerCase();
  const includeDraft = String(query.includeDraft || 'false').toLowerCase() === 'true';

  const capitalUrl = String(getApiBaseUrl('capital') || '').replace(/\/$/, '');

  // Slug-first resolution works for all categories and does not depend on list permissions.
  if (slug) {
    const preferred = category ? category.toUpperCase() : '';
    const categories = [preferred, ...GQL_CATEGORIES].filter((value, index, arr) => !!value && arr.indexOf(value) === index);

    for (const gqlCategory of categories) {
      try {
        const routeResponse = await $fetch<PublicPublicationByRouteResponse>(`${capitalUrl}/query`, {
          method: 'POST',
          body: {
            query: PUBLIC_PUBLICATION_BY_ROUTE_QUERY,
            variables: {
              category: gqlCategory,
              slug,
              includeBlocks: true,
            },
          },
        });

        if (routeResponse.errors?.length) continue;

        const publication = routeResponse.data?.publicPublicationByRoute;
        if (!publication) continue;

        const dateIsoRaw = String(publication.publishedAtUnix || '').trim();
        const parsedDate = dateIsoRaw ? new Date(dateIsoRaw) : null;
        const dateIso = parsedDate && !Number.isNaN(parsedDate.getTime())
          ? parsedDate.toISOString()
          : new Date().toISOString();

        const categorySlug = String(publication.category || 'news').trim().toLowerCase();
        const resolvedSlug = String(publication.slug || slug).trim().toLowerCase();

        return {
          items: [
            {
              slug: resolvedSlug,
              category: categorySlug,
              status: 'published' as const,
              meta: {
                slug: resolvedSlug,
                category: categorySlug,
                title: String(publication.title || '').trim(),
                description: String(publication.excerpt || '').trim(),
                author: String(publication.author || 'Lota Team').trim(),
                author_role: String(publication.authorRole || '').trim(),
                date: dateIso,
                featured_image: String(publication.featuredImage || '').trim(),
                tags: Array.isArray(publication.tags) ? publication.tags : [],
                og_image: String(publication.ogImage || '').trim(),
                schema_type: String(publication.schemaType || '').trim(),
                source_url: String(publication.sourceUrl || '').trim(),
                source_name: String(publication.sourceName || '').trim(),
                reviewed_by: String(publication.reviewedBy || '').trim(),
                reviewed_by_url: String(publication.reviewedByUrl || '').trim(),
                reviewed_date: publication.reviewedDateUnix ? new Date(publication.reviewedDateUnix).toISOString() : '',
                publisher_name: String(publication.publisherName || '').trim(),
                publisher_url: String(publication.publisherUrl || '').trim(),
                publisher_logo: String(publication.publisherLogo || '').trim(),
                canonical_url: String(publication.canonicalUrl || '').trim(),
                robots: String(publication.robots || '').trim(),
              },
              body: blocksToHtml(publication.blocks, String(publication.excerpt || '').trim()),
            },
          ],
        };
      } catch {
        // Try next category candidate.
      }
    }
  }

  try {
    const response = await $fetch<PublicPublicationListResponse>(`${capitalUrl}/query`, {
      method: 'POST',
      body: {
        query: PUBLIC_PUBLICATIONS_QUERY,
        variables: {
          filter: {
            ...(category ? { category: category.toUpperCase() } : {}),
            page: 1,
            pageSize: 300,
            includeDraft,
          },
        },
      },
    });

    if (!response.errors?.length) {
      const items = (response.data?.publicPublications?.items || [])
        .map((item) => {
          const slug = String(item?.slug || '').trim().toLowerCase();
          if (!slug) return null;

          const categorySlug = String(item?.category || 'news').trim().toLowerCase();
          const dateIsoRaw = String(item?.publishedAtUnix || '').trim();
          const parsedDate = dateIsoRaw ? new Date(dateIsoRaw) : null;
          const dateIso = parsedDate && !Number.isNaN(parsedDate.getTime())
            ? parsedDate.toISOString()
            : new Date().toISOString();

          return {
            slug,
            category: categorySlug,
            status: 'published' as const,
            meta: {
              slug,
              category: categorySlug,
              title: String(item?.title || '').trim(),
              description: String(item?.excerpt || '').trim(),
              author: String(item?.author || 'Lota Team').trim(),
              author_role: String(item?.authorRole || '').trim(),
              date: dateIso,
              featured_image: String(item?.featuredImage || '').trim(),
              tags: Array.isArray(item?.tags) ? item.tags : [],
              og_image: String(item?.ogImage || '').trim(),
              schema_type: String(item?.schemaType || '').trim(),
              source_url: String(item?.sourceUrl || '').trim(),
              source_name: String(item?.sourceName || '').trim(),
              reviewed_by: String(item?.reviewedBy || '').trim(),
              reviewed_by_url: String(item?.reviewedByUrl || '').trim(),
              reviewed_date: item?.reviewedDateUnix ? new Date(item.reviewedDateUnix).toISOString() : '',
              publisher_name: String(item?.publisherName || '').trim(),
              publisher_url: String(item?.publisherUrl || '').trim(),
              publisher_logo: String(item?.publisherLogo || '').trim(),
              canonical_url: String(item?.canonicalUrl || '').trim(),
              robots: String(item?.robots || '').trim(),
            },
            body: String(item?.excerpt || '').trim(),
          };
        })
        .filter((item): item is NonNullable<typeof item> => !!item);

      return { items };
    }
  } catch {
    // Fall through to legacy sources.
  }

  const upstreamBaseUrl = String(config.publicationsBackendUrl || '').trim();
  const upstreamItems = await fetchPublicationDocumentsFromUpstream(upstreamBaseUrl, {
    includeDraft,
    category: category || undefined,
  });
  if (upstreamItems) {
    return { items: upstreamItems };
  }

  const items = await listPublicationDocuments({
    includeDraft,
    category: category || undefined,
  });

  return { items };
});
