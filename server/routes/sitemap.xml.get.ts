import { getApiBaseUrl } from '../../utils/api-base';
import { fromGqlCategory } from '../../utils/publicationCategory';

type PublicPublicationsResponse = {
  data?: {
    publicPublications?: {
      items?: Array<{
        slug?: string;
        category?: string;
        publishedAtUnix?: string;
        updatedAtUnix?: string;
      }>;
      page?: number;
      totalPages?: number;
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
        publishedAtUnix
        updatedAtUnix
      }
      page
      totalPages
    }
  }
`;

function unixToIsoDate(raw: string | undefined): string {
  const value = Number(String(raw || '').trim());
  if (!Number.isFinite(value) || value <= 0) return '';
  const date = new Date(value * 1000);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function xmlUrl(loc: string, lastmod: string, changefreq: string, priority: string): string {
  const lines = [
    '  <url>',
    `    <loc>${loc}</loc>`,
  ];
  if (lastmod) lines.push(`    <lastmod>${lastmod}</lastmod>`);
  lines.push(
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    '  </url>',
  );
  return lines.join('\n');
}

async function fetchAllPublishedArticles(capitalEndpoint: string): Promise<Array<{ category: string; slug: string; lastmod: string }>> {
  const results: Array<{ category: string; slug: string; lastmod: string }> = [];
  let page = 1;
  const pageSize = 200;

  // Bounded loop: sitemap generation must never hang the response even if the
  // backend reports an inconsistent/never-decreasing totalPages.
  for (let iteration = 0; iteration < 25; iteration += 1) {
    const response = await $fetch<PublicPublicationsResponse>(capitalEndpoint, {
      method: 'POST',
      body: {
        query: PUBLIC_PUBLICATIONS_QUERY,
        variables: { filter: { page, pageSize } },
      },
    });

    // A GraphQL-level error (HTTP 200 with an errors[] body -- wrong schema,
    // resolver failure, misconfigured proxy) is NOT the same thing as "zero
    // published articles". Throwing here lets the caller's candidate loop
    // retry the next endpoint instead of silently shipping an empty sitemap.
    if (response?.errors?.length) {
      throw new Error(`publicPublications returned errors: ${response.errors.map((e) => e?.message).join('; ')}`);
    }
    const payload = response?.data?.publicPublications;
    const items = Array.isArray(payload?.items) ? payload!.items! : [];

    for (const item of items) {
      const slug = String(item?.slug || '').trim().toLowerCase();
      if (!slug) continue;
      const category = fromGqlCategory(item?.category);
      const lastmod = unixToIsoDate(item?.updatedAtUnix) || unixToIsoDate(item?.publishedAtUnix);
      results.push({ category, slug, lastmod });
    }

    const totalPages = Number(payload?.totalPages || 1);
    if (!items.length || page >= totalPages) break;
    page += 1;
  }

  return results;
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  const siteUrl = String(config.public.siteUrl || 'https://lota.tools').replace(/\/$/, '');
  const forwardedHost = String(getHeader(event, 'x-forwarded-host') || '').trim();
  const host = String(getHeader(event, 'host') || '').trim();
  const forwardedProto = String(getHeader(event, 'x-forwarded-proto') || '').trim().toLowerCase();
  const proto = forwardedProto === 'https' ? 'https' : 'http';
  const requestOrigin = (forwardedHost || host) ? `${proto}://${forwardedHost || host}`.replace(/\/$/, '') : '';
  const capitalUrl = String(getApiBaseUrl('capital') || '').replace(/\/$/, '');
  const envCapital = String(process.env.VITE_API_CAPITAL || '').trim().replace(/\/$/, '');
  const localDevCapital = process.env.NODE_ENV !== 'production' ? 'http://127.0.0.1:8082' : '';

  // Same-origin request first: on a locally-running server this proxies to the
  // local backend via the Nuxt server's own /api-capital/** route rule; in
  // production it round-trips through the deployed domain, which proxies to
  // the real backend. Only fall through to the next candidate on an actual
  // request failure — an empty (but successful) result is a valid answer and
  // must not trigger trying a different, possibly unrelated backend.
  const endpointCandidates = [
    requestOrigin ? `${requestOrigin}/api-capital/query` : '',
    localDevCapital ? `${localDevCapital}/query` : '',
    envCapital ? `${envCapital}/query` : '',
    `${capitalUrl}/query`,
  ].filter((value, index, arr) => !!value && arr.indexOf(value) === index);

  const today = new Date().toISOString().slice(0, 10);
  let articles: Array<{ category: string; slug: string; lastmod: string }> = [];
  let lastError: unknown = null;
  let succeeded = false;

  for (const endpoint of endpointCandidates) {
    try {
      articles = await fetchAllPublishedArticles(endpoint);
      succeeded = true;
      break;
    } catch (err) {
      lastError = err;
      // Try next endpoint candidate.
    }
  }

  // Every candidate failed: the sitemap still ships (static pages only) so
  // crawlers never see a 5xx, but this must not fail silently -- a healthy
  // deploy should always have at least one working candidate.
  if (!succeeded) {
    console.error('[sitemap.xml] all endpoint candidates failed', {
      candidates: endpointCandidates,
      lastError: lastError instanceof Error ? lastError.message : lastError,
    });
  }

  const urls = [
    xmlUrl(`${siteUrl}/`, today, 'daily', '1.0'),
    xmlUrl(`${siteUrl}/feed`, today, 'daily', '0.9'),
    xmlUrl(`${siteUrl}/news`, today, 'daily', '0.9'),
    ...articles.map((article) =>
      xmlUrl(`${siteUrl}/${article.category}/${article.slug}`, article.lastmod || today, 'monthly', '0.8')
    ),
  ];

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');

  setHeader(event, 'content-type', 'application/xml; charset=utf-8');
  return xml;
});
