import { fetchPublicationDocumentsFromUpstream, listPublicationDocuments } from '../../utils/publications';

type PublicPublicationListResponse = {
  data?: {
    publicPublications?: {
      items?: Array<{
        slug?: string;
        category?: string;
        title?: string;
        excerpt?: string;
        author?: string;
        publishedAtUnix?: string;
      }>;
    };
  };
  errors?: Array<{ message?: string }>;
};

const PUBLIC_PUBLICATIONS_QUERY = `
  query PublicPublications($filter: PublicationListFilterInput) {
    publicPublications(filter: $filter) {
      items {
        slug
        category
        title
        excerpt
        author
        publishedAtUnix
      }
    }
  }
`;

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const config = useRuntimeConfig(event);
  const category = String(query.category || '').trim().toLowerCase();
  const includeDraft = String(query.includeDraft || 'false').toLowerCase() === 'true';

  const capitalUrl = String(process.env.VITE_API_CAPITAL || 'http://localhost:8082').replace(/\/$/, '');
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
              date: dateIso,
              tags: [] as string[],
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
